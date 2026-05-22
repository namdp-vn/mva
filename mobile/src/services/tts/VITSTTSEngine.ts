import {createStreamingTTS} from 'react-native-sherpa-onnx/tts';
import type {SupportedTargetLanguage} from '../../shared/store/settingsStore';
import type {TtsRate} from './TTSService';
import {getVITSModelPath} from './VITSModelManager';

const VITS_SPEED: Record<TtsRate, number> = {
  slow: 0.75,
  normal: 1.0,
  fast: 1.4,
};

// StreamingTtsEngine type — inferred from createStreamingTTS return
type VITSEngine = Awaited<ReturnType<typeof createStreamingTTS>>;

type EngineCache = {
  language: SupportedTargetLanguage;
  engine: VITSEngine;
  sampleRate: number;
  pcmStarted: boolean;
};

let cache: EngineCache | null = null;

async function getOrCreateEngine(
  language: SupportedTargetLanguage,
): Promise<EngineCache> {
  if (cache?.language === language) {
    return cache;
  }
  if (cache) {
    try {
      if (cache.pcmStarted) await cache.engine.stopPcmPlayer();
      await cache.engine.destroy();
    } catch {}
    cache = null;
  }

  const modelPath = await getVITSModelPath(language);
  if (!modelPath) {
    throw new Error(`VITS model not downloaded for language: ${language}`);
  }

  const engine = await createStreamingTTS({
    modelPath: {type: 'file', path: modelPath},
    modelType: 'vits',
    numThreads: 2,
  });

  const sampleRate = await engine.getSampleRate();
  cache = {language, engine, sampleRate, pcmStarted: false};
  return cache;
}

export async function speakVITS(
  text: string,
  language: SupportedTargetLanguage,
  rate: TtsRate,
): Promise<void> {
  const entry = await getOrCreateEngine(language);
  const {engine, sampleRate} = entry;

  if (!entry.pcmStarted) {
    await engine.startPcmPlayer(sampleRate, 1);
    entry.pcmStarted = true;
  }

  return new Promise((resolve, reject) => {
    engine
      .generateSpeechStream(
        text,
        {speed: VITS_SPEED[rate]},
        {
          onChunk: (chunk) => {
            engine.writePcmChunk(chunk.samples).catch(() => {});
          },
          onEnd: () => resolve(),
          onError: (e) => reject(new Error(e.message ?? 'VITS generation error')),
        },
      )
      .catch(reject);
  });
}

export async function stopVITS(): Promise<void> {
  if (!cache) return;
  try {
    await cache.engine.cancelSpeechStream();
    if (cache.pcmStarted) {
      await cache.engine.stopPcmPlayer();
      cache.pcmStarted = false;
    }
  } catch {}
}

export async function destroyVITSEngine(): Promise<void> {
  if (!cache) return;
  const entry = cache;
  cache = null;
  try {
    if (entry.pcmStarted) await entry.engine.stopPcmPlayer();
    await entry.engine.destroy();
  } catch {}
}
