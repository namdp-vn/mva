package com.vibevoicenative.translation

import java.io.File

/**
 * SentencePiece tokenizer for Opus-MT (Marian NMT) models.
 * Opus-MT uses separate source and target vocabularies.
 */
class OpusMtTokenizer(sourceVocabPath: String, targetVocabPath: String) {

    private val sourcePieceToId = mutableMapOf<String, Int>()
    private val sourceIdToPiece = mutableMapOf<Int, String>()
    private val targetPieceToId = mutableMapOf<String, Int>()
    private val targetIdToPiece = mutableMapOf<Int, String>()

    private var sourceVocabSize = 0
    private var targetVocabSize = 0

    // BOS/EOS tokens for Marian
    val bosId: Int
    val eosId: Int

    init {
        loadVocab(sourceVocabPath, isSource = true)
        loadVocab(targetVocabPath, isSource = false)
        // Marian models use <s> for BOS and </s> for EOS
        bosId = sourcePieceToId["<s>"] ?: sourcePieceToId["<pad>"] ?: 0
        eosId = sourcePieceToId["</s>"] ?: sourcePieceToId["<pad>"] ?: 0
    }

    private fun loadVocab(path: String, isSource: Boolean) {
        val json = File(path).readText()
        val map = parseVocabJson(json)

        if (isSource) {
            sourcePieceToId.putAll(map)
            sourceIdToPiece.putAll(map.entries.associate { it.value to it.key })
            sourceVocabSize = map.size
        } else {
            targetPieceToId.putAll(map)
            targetIdToPiece.putAll(map.entries.associate { it.value to it.key })
            targetVocabSize = map.size
        }
    }

    // Vocab JSON format from opus-tools: {"piece": id, ...}
    private fun parseVocabJson(json: String): Map<String, Int> {
        val result = mutableMapOf<String, Int>()
        // Simple JSON parsing for vocab format: {" piece ": 0, " piece2 ": 1, ...}
        val regex = """"([^"]+)""\s*:\s*(\d+)""".toRegex()
        regex.findAll(json).forEach { match ->
            result[match.groupValues[1].trim()] = match.groupValues[2].toInt()
        }
        return result
    }

    /**
     * Encode source text to token IDs using source vocabulary.
     * Opus-MT prepends SR or RB tokens for language identification (omitted for simplicity).
     */
    fun encodeSource(text: String): List<Int> {
        val normalized = text.trim()
        if (normalized.isEmpty()) return listOf(eosId)

        // Simple whitespace tokenization + unknown handling
        // In production, use true SentencePiece unigram model
        val words = normalized.split(Regex("\\s+")).filter { it.isNotEmpty() }
        val ids = mutableListOf<Int>()
        for (word in words) {
            ids.add(sourcePieceToId[word] ?: sourcePieceToId[word.lowercase()] ?: 3) // 3 = unk
        }
        return listOf(bosId) + ids + listOf(eosId)
    }

    /**
     * Decode target token IDs to text using target vocabulary.
     */
    fun decodeTarget(ids: List<Int>): String {
        val pieces = ids.filter { it != bosId && it != eosId }
            .map { targetIdToPiece[it] ?: "" }
            .filter { it.isNotEmpty() }

        return pieces.joinToString("")
            .replace("@@ ", "")  // SentencePiece continuation marker
            .replace("@@", "")
            .trim()
    }

    fun getTargetVocabSize(): Int = targetVocabSize
}