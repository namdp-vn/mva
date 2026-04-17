package com.vibevoicenative.translation

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import ai.onnxruntime.TensorInfo
import android.content.Context
import java.io.File
import java.nio.FloatBuffer
import java.nio.LongBuffer
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock
import kotlin.math.max
import kotlin.math.min

/**
 * Exception thrown when translation cannot proceed due to model loading or initialization failure.
 */
class TranslationException(message: String) : Exception(message)

/**
 * Opus-MT (Marian NMT) inference engine with model swapping.
 *
 * Architecture:
 * - enViSession: Always loaded (~50MB RAM). Handles EN→VI directly.
 * - sourceToEnSession: Loaded on demand (~50MB RAM). Handles JA/KO/ZH→EN.
 *
 * Two-hop flow for JA/KO/ZH:
 *   JA → [ja-en model] → EN → [en-vi model] → VI
 */
class OpusMtTranslatorHelper(private val context: Context) {

    private val assets = context.assets
    private val modelDir: String = context.filesDir.absolutePath + "/models/opus-mt"

    private val ortEnv = OrtEnvironment.getEnvironment()

    // Lock for thread-safe model loading/unloading
    private val modelLock = ReentrantLock()

    // Always-loaded: EN → VI
    private var enViSession: OrtSession? = null
    private var enViTokenizer: OpusMtTokenizer? = null

    // On-demand: source language → EN (only one loaded at a time)
    @Volatile private var currentSourceLang: String? = null
    private var sourceToEnSession: OrtSession? = null
    private var sourceToEnTokenizer: OpusMtTokenizer? = null

    private val MAX_LENGTH = 128

    // Session binding names (resolved after session creation)
    private var encoderInputIdsName: String? = null
    private var encoderAttentionMaskName: String? = null
    private var decoderInputIdsName: String? = null
    private var decoderEncoderHiddenStatesName: String? = null
    private var decoderAttentionMaskName: String? = null
    private var decoderLogitsOutputName: String? = null

    // Map app lang codes to model subdirectories
    private val modelSubdirs = mapOf(
        "en" to "en-vi",
        "ja" to "ja-en",
        "ko" to "ko-en",
        "zh" to "zh-en"
    )

    fun initialize(): Boolean {
        return try {
            // Check if model files exist in assets before attempting to load
            if (!areModelFilesAvailable("en-vi")) {
                android.util.Log.w("OpusMtTranslator", "Opus-MT en-vi model files not found in assets")
                return false
            }
            loadModel("en-vi", isSourceToEn = false)
            true
        } catch (e: Exception) {
            android.util.Log.e("OpusMtTranslator", "Failed to initialize Opus-MT", e)
            false
        }
    }

    private fun areModelFilesAvailable(subdir: String): Boolean {
        return try {
            val assetPath = "models/opus-mt/$subdir/model.onnx"
            assets.open(assetPath).close()
            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Translate text from source language to Vietnamese.
     * JA/KO/ZH use two-hop: srcLang→EN then EN→VI.
     * EN uses direct EN→VI.
     * VI returns text unchanged.
     *
     * @throws TranslationException if en-vi model is not loaded or source model loading fails
     */
    fun translate(text: String, srcLang: String): String {
        if (srcLang == "vi") return text

        // Hold lock during translation to prevent model unload mid-inference
        return modelLock.withLock {
            val enViSess = enViSession
            if (enViSess == null) {
                throw TranslationException("Translation not available - Opus-MT en-vi model not loaded. Please ensure model files are bundled in assets.")
            }
            val enViTok = enViTokenizer ?: throw TranslationException("en-vi tokenizer not loaded. Call initialize() first.")

            if (srcLang == "en") {
                return@withLock translateWithModel(text, enViSess, enViTok)
            }

            // Two-hop: srcLang → EN → VI
            // ensureSourceModel is called while holding the lock
            val sourceReady = ensureSourceModelUnsafe(srcLang)
            if (!sourceReady) {
                throw TranslationException("Failed to load source model for: $srcLang")
            }

            // At this point, sourceToEnSession and sourceToEnTokenizer are guaranteed non-null
            // because ensureSourceModelUnsafe only returns true after successful loading
            val sourceSess = sourceToEnSession
            val sourceTok = sourceToEnTokenizer
            if (sourceSess == null || sourceTok == null) {
                throw TranslationException("Source model not properly loaded for: $srcLang")
            }

            val englishText = translateWithModel(text, sourceSess, sourceTok)

            val vietnameseText = translateWithModel(
                englishText,
                enViSess,
                enViTok
            )

            return vietnameseText
        }
    }

    /**
     * Ensures the source-to-English model is loaded for the given language.
     * MUST be called while holding modelLock.
     * @return true if model is ready, false if loading failed
     */
    private fun ensureSourceModelUnsafe(lang: String): Boolean {
        if (currentSourceLang == lang && sourceToEnSession != null) return true

        // Unload previous source model
        sourceToEnSession?.close()
        sourceToEnSession = null
        sourceToEnTokenizer = null
        currentSourceLang = null

        // Load new source → EN model
        val subdir = modelSubdirs[lang] ?: return false

        return try {
            loadModel(subdir, isSourceToEn = true)
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun loadModel(subdir: String, isSourceToEn: Boolean) {
        val basePath = "$modelDir/$subdir"

        // Check if asset exists before trying to extract
        if (!isAssetAvailable("models/opus-mt/$subdir/model.onnx")) {
            throw TranslationException("Model asset not found: models/opus-mt/$subdir/model.onnx")
        }

        // Extract from assets if not already extracted
        extractAssetIfNeeded("models/opus-mt/$subdir/model.onnx", "$basePath/model.onnx")
        extractAssetIfNeeded("models/opus-mt/$subdir/source_vocab.json", "$basePath/source_vocab.json")
        extractAssetIfNeeded("models/opus-mt/$subdir/target_vocab.json", "$basePath/target_vocab.json")

        val sessionOptions = OrtSession.SessionOptions().apply {
            setIntraOpNumThreads(4)
            try { addNnapi() } catch (e: Exception) {
                android.util.Log.w("OpusMtTranslator", "NNAPI not available, falling back to CPU", e)
            }
        }

        val session = ortEnv.createSession("$basePath/model.onnx", sessionOptions)
        resolveSessionBindings(session)

        val tokenizer = OpusMtTokenizer(
            "$basePath/source_vocab.json",
            "$basePath/target_vocab.json"
        )

        if (isSourceToEn) {
            sourceToEnSession = session
            sourceToEnTokenizer = tokenizer
            currentSourceLang = subdir.substringBefore("-")
        } else {
            enViSession = session
            enViTokenizer = tokenizer
        }
    }

    private fun isAssetAvailable(assetPath: String): Boolean {
        return try {
            assets.open(assetPath).close()
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun resolveSessionBindings(session: OrtSession) {
        val inputNames = session.inputNames.toList()
        val outputNames = session.outputNames.toList()

        // Resolve encoder input names
        encoderInputIdsName = resolveInputName(inputNames, "input_ids", "encoder_input_ids", "source_ids")
        encoderAttentionMaskName = resolveInputName(inputNames, "attention_mask", "encoder_attention_mask", "src_mask")

        // Resolve decoder input/output names
        decoderInputIdsName = resolveInputName(inputNames, "decoder_input_ids", "tokens", "tgt_ids")
        decoderEncoderHiddenStatesName = resolveInputName(inputNames, "encoder_hidden_states", "hidden_states", "encoder_output")
        decoderAttentionMaskName = resolveInputName(inputNames, "attention_mask", "decoder_attention_mask")

        decoderLogitsOutputName = resolveOutputName(outputNames, "logits", "lm_logits", "output", "output0")
    }

    private fun resolveInputName(inputNames: List<String>, vararg candidates: String): String? {
        candidates.forEach { candidate ->
            inputNames.firstOrNull { normalizeName(it) == normalizeName(candidate) }?.let { return it }
        }
        candidates.forEach { candidate ->
            inputNames.firstOrNull { normalizeName(it).contains(normalizeName(candidate)) }?.let { return it }
        }
        return inputNames.firstOrNull()
    }

    private fun resolveOutputName(outputNames: List<String>, vararg candidates: String): String? {
        candidates.forEach { candidate ->
            outputNames.firstOrNull { normalizeName(it) == normalizeName(candidate) }?.let { return it }
        }
        candidates.forEach { candidate ->
            outputNames.firstOrNull { normalizeName(it).contains(normalizeName(candidate)) }?.let { return it }
        }
        return outputNames.firstOrNull { !normalizeName(it).contains("present") && !normalizeName(it).contains("cache") }
            ?: outputNames.firstOrNull()
    }

    private fun normalizeName(name: String): String =
        name.lowercase().replace(Regex("[^a-z0-9]"), "")

    private fun extractAssetIfNeeded(assetPath: String, destPath: String) {
        val destFile = File(destPath)
        if (destFile.exists()) return

        synchronized(this) {
            // Double-check after acquiring lock
            if (destFile.exists()) return@synchronized
            destFile.parentFile?.mkdirs()
            assets.open(assetPath).use { input ->
                destFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
        }
    }

    /**
     * Run ONNX inference for Opus-MT model.
     * Opus-MT (Marian) is a standard seq2seq model with encoder-decoder.
     * We perform autoregressive decoding with greedy strategy.
     */
    private fun translateWithModel(
        text: String,
        session: OrtSession,
        tokenizer: OpusMtTokenizer
    ): String {
        try {
            val inputIds = tokenizer.encodeSource(text)

            // Run encoder to get source hidden states
            val encoderState = runEncoder(session, inputIds)
                ?: throw TranslationException("Encoder failed to produce hidden states")

            // Run decoder autoregressively (greedy decode)
            val generated = greedyDecode(encoderState, session, tokenizer)

            return tokenizer.decodeTarget(generated)
        } catch (e: TranslationException) {
            throw e  // Re-throw TranslationException as-is
        } catch (e: Exception) {
            throw TranslationException("Translation inference failed: ${e.message}")
        }
    }

    private data class EncoderState(
        val values: FloatArray,
        val shape: LongArray,
        val attentionMask: LongArray,
    )

    private fun runEncoder(session: OrtSession, inputIds: List<Int>): EncoderState? {
        val inputName = encoderInputIdsName ?: return null
        val maskName = encoderAttentionMaskName

        val attentionMask = LongArray(inputIds.size) { 1L }
        val shape = longArrayOf(1L, inputIds.size.toLong())

        val ortInputs = mutableMapOf<String, OnnxTensor>()

        OnnxTensor.createTensor(ortEnv, LongBuffer.wrap(inputIds.map { it.toLong() }.toLongArray()), shape).use { inputTensor ->
            ortInputs[inputName] = inputTensor
            if (maskName != null) {
                OnnxTensor.createTensor(ortEnv, LongBuffer.wrap(attentionMask), shape).use { maskTensor ->
                    ortInputs[maskName] = maskTensor
                    return runEncoderWithInputs(session, ortInputs, attentionMask)
                }
            }
            return runEncoderWithInputs(session, ortInputs, attentionMask)
        }
    }

    private fun runEncoderWithInputs(
        session: OrtSession,
        inputs: Map<String, OnnxTensor>,
        attentionMask: LongArray,
    ): EncoderState? {
        session.run(inputs).use { outputs ->
            val tensor = extractFloatTensor(session, outputs, "last_hidden_state", "encoder_hidden_states", "hidden_states", "output")
                ?: return null
            val info = tensor.info as? TensorInfo ?: return null
            val buffer = tensor.floatBuffer
            buffer.rewind()
            val values = FloatArray(buffer.remaining())
            buffer.get(values)
            return if (values.isEmpty()) null else EncoderState(values, info.shape, attentionMask)
        }
    }

    private fun greedyDecode(
        encoderState: EncoderState,
        session: OrtSession,
        tokenizer: OpusMtTokenizer
    ): List<Int> {
        val generated = mutableListOf<Int>()
        var currentToken = tokenizer.bosId
        var step = 0

            while (step < MAX_LENGTH) {
            val nextTokenId = runDecoderStep(
                session,
                currentToken,
                encoderState,
                tokenizer
            )

            if (nextTokenId == tokenizer.eosId) break
            generated.add(nextTokenId)
            currentToken = nextTokenId
            step++
        }

        return generated
    }

    private fun runDecoderStep(
        session: OrtSession,
        tokenId: Int,
        encoderState: EncoderState,
        tokenizer: OpusMtTokenizer,
    ): Int {
        val tokenName = decoderInputIdsName ?: return tokenizer.eosId
        val hiddenName = decoderEncoderHiddenStatesName ?: return tokenizer.eosId
        val maskName = decoderAttentionMaskName
        val logitsName = decoderLogitsOutputName ?: "logits"

        val ortInputs = mutableMapOf<String, OnnxTensor>()

        OnnxTensor.createTensor(ortEnv, LongBuffer.wrap(longArrayOf(tokenId.toLong())), longArrayOf(1L, 1L)).use { tokenTensor ->
            ortInputs[tokenName] = tokenTensor
            OnnxTensor.createTensor(ortEnv, FloatBuffer.wrap(encoderState.values), encoderState.shape).use { hiddenTensor ->
                ortInputs[hiddenName] = hiddenTensor
                if (maskName != null) {
                    OnnxTensor.createTensor(
                        ortEnv,
                        LongBuffer.wrap(encoderState.attentionMask),
                        longArrayOf(1L, encoderState.attentionMask.size.toLong())
                    ).use { maskTensor ->
                        ortInputs[maskName] = maskTensor
                        return runDecoderWithInputs(session, ortInputs, logitsName, tokenizer)
                    }
                }
                return runDecoderWithInputs(session, ortInputs, logitsName, tokenizer)
            }
        }
    }

    private fun runDecoderWithInputs(
        session: OrtSession,
        inputs: Map<String, OnnxTensor>,
        logitsName: String,
        tokenizer: OpusMtTokenizer
    ): Int {
        session.run(inputs).use { outputs ->
            val tensor = extractFloatTensor(session, outputs, logitsName, "logits", "lm_logits", "output", "output0")
                ?: return tokenizer.eosId
            val info = tensor.info as? TensorInfo ?: return tokenizer.eosId
            val shape = info.shape
            val floatBuffer = tensor.floatBuffer
            floatBuffer.rewind()
            val values = FloatArray(floatBuffer.remaining())
            floatBuffer.get(values)
            if (values.isEmpty()) return tokenizer.eosId

            // Find argmax over vocabulary
            val vocabSize = when {
                shape.isNotEmpty() && shape.last() > 0 -> min(values.size, shape.last().toInt())
                else -> values.size
            }
            val safeVocab = max(1, vocabSize)
            val offset = max(0, values.size - safeVocab)
            var bestIndex = 0
            var bestValue = Float.NEGATIVE_INFINITY
            for (i in 0 until safeVocab) {
                val value = values[offset + i]
                if (value > bestValue) {
                    bestValue = value
                    bestIndex = i
                }
            }
            return bestIndex
        }
    }

    private fun extractFloatTensor(session: OrtSession, outputs: OrtSession.Result, vararg candidates: String): OnnxTensor? {
        val names = session.outputNames.toList()
        val resolvedName = candidates.firstNotNullOfOrNull { candidate ->
            names.firstOrNull { normalizeName(it) == normalizeName(candidate) || normalizeName(it).contains(normalizeName(candidate)) }
        }
        resolvedName?.let { name ->
            val tensor = outputs[name]
            if (tensor is OnnxTensor) return tensor
        }
        for (index in 0 until outputs.size()) {
            val tensor = outputs[index]
            if (tensor is OnnxTensor) {
                val info = tensor.info as? TensorInfo
                if (info != null && info.type.name.contains("FLOAT", ignoreCase = true)) {
                    return tensor
                }
            }
        }
        return null
    }

    fun unload() {
        modelLock.withLock {
            enViSession?.close()
            enViSession = null
            enViTokenizer?.let { /* tokenizer is stateless, no cleanup */ }
            enViTokenizer = null
            sourceToEnSession?.close()
            sourceToEnSession = null
            sourceToEnTokenizer = null
            currentSourceLang = null
            ortEnv.close()
        }
    }

    /**
     * Checks if a specific language pair is ready for translation.
     * For VI source or matching source/target, no translation is needed → return true.
     * For EN→VI: return enViSession != null
     * For JA/KO/ZH→VI: return enViSession != null AND source model for that language is loaded.
     */
    fun isLanguagePairReady(srcLang: String, tgtLang: String): Boolean {
        if (srcLang == tgtLang || srcLang == "vi") return true
        if (tgtLang != "vi") return false // Only VI is supported as target

        // Read with lock to ensure consistent view of model state
        return modelLock.withLock {
            if (srcLang == "en") {
                return@withLock enViSession != null
            }
            // JA, KO, ZH → VI requires both en-vi and source-to-en models
            return@withLock enViSession != null && sourceToEnSession != null && currentSourceLang == srcLang
        }
    }

    fun isLoaded(): Boolean = enViSession != null
}