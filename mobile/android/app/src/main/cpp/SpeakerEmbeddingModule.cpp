#include <jni.h>
#include <android/log.h>
#include <mutex>
#include <string>
#include <vector>

#include "sherpa-onnx/c-api/c-api.h"

namespace {
std::mutex g_mutex;
const SherpaOnnxSpeakerEmbeddingExtractor *g_extractor = nullptr;
int32_t g_embedding_dim = 0;
}

void LogError(const char *msg) {
  __android_log_print(ANDROID_LOG_ERROR, "VibeVoiceSpeakerEmbedding", "%s", msg);
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_vibevoicenative_speaker_SpeakerEmbeddingModule_initializeNative(
    JNIEnv *env,
    jobject /*thiz*/,
    jstring modelPath,
    jint numThreads,
    jstring provider) {
  std::lock_guard<std::mutex> lock(g_mutex);

  if (g_extractor) {
    SherpaOnnxDestroySpeakerEmbeddingExtractor(g_extractor);
    g_extractor = nullptr;
  }

  const char *model_path = env->GetStringUTFChars(modelPath, nullptr);
  const char *provider_str = env->GetStringUTFChars(provider, nullptr);

  SherpaOnnxSpeakerEmbeddingExtractorConfig config;
  memset(&config, 0, sizeof(config));
  config.model = model_path;
  config.num_threads = numThreads;
  config.debug = 0;
  config.provider = provider_str;

  g_extractor = SherpaOnnxCreateSpeakerEmbeddingExtractor(&config);

  env->ReleaseStringUTFChars(modelPath, model_path);
  env->ReleaseStringUTFChars(provider, provider_str);

  if (!g_extractor) {
    LogError("Failed to create speaker embedding extractor");
    return JNI_FALSE;
  }

  g_embedding_dim = SherpaOnnxSpeakerEmbeddingExtractorDim(g_extractor);
  return JNI_TRUE;
}

extern "C" JNIEXPORT jfloatArray JNICALL
Java_com_vibevoicenative_speaker_SpeakerEmbeddingModule_extractEmbeddingNative(
    JNIEnv *env,
    jobject /*thiz*/,
    jfloatArray samples,
    jint sampleRate) {
  std::lock_guard<std::mutex> lock(g_mutex);

  if (!g_extractor) {
    LogError("Speaker embedding extractor not initialized");
    return nullptr;
  }

  const jsize sample_count = env->GetArrayLength(samples);
  std::vector<float> pcm(sample_count);
  env->GetFloatArrayRegion(samples, 0, sample_count, pcm.data());

  const SherpaOnnxOnlineStream *stream =
      SherpaOnnxSpeakerEmbeddingExtractorCreateStream(g_extractor);
  if (!stream) {
    LogError("Failed to create embedding stream");
    return nullptr;
  }

  SherpaOnnxOnlineStreamAcceptWaveform(stream, sampleRate, pcm.data(), sample_count);
  SherpaOnnxOnlineStreamInputFinished(stream);

  if (!SherpaOnnxSpeakerEmbeddingExtractorIsReady(g_extractor, stream)) {
    SherpaOnnxDestroyOnlineStream(stream);
    LogError("Not enough audio samples for embedding");
    return nullptr;
  }

  const float *embedding =
      SherpaOnnxSpeakerEmbeddingExtractorComputeEmbedding(g_extractor, stream);

  SherpaOnnxDestroyOnlineStream(stream);

  if (!embedding) {
    LogError("Failed to compute embedding");
    return nullptr;
  }

  jfloatArray out = env->NewFloatArray(g_embedding_dim);
  std::vector<float> flat(g_embedding_dim);
  for (int32_t i = 0; i < g_embedding_dim; ++i) {
    flat[i] = embedding[i];
  }

  SherpaOnnxSpeakerEmbeddingExtractorDestroyEmbedding(embedding);

  env->SetFloatArrayRegion(out, 0, g_embedding_dim, flat.data());
  return out;
}

extern "C" JNIEXPORT jint JNICALL
Java_com_vibevoicenative_speaker_SpeakerEmbeddingModule_getEmbeddingDimNative(
    JNIEnv * /*env*/,
    jobject /*thiz*/) {
  std::lock_guard<std::mutex> lock(g_mutex);
  return g_embedding_dim;
}

extern "C" JNIEXPORT void JNICALL
Java_com_vibevoicenative_speaker_SpeakerEmbeddingModule_unloadNative(
    JNIEnv * /*env*/,
    jobject /*thiz*/) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (g_extractor) {
    SherpaOnnxDestroySpeakerEmbeddingExtractor(g_extractor);
    g_extractor = nullptr;
  }
  g_embedding_dim = 0;
}