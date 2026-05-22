import {
  ModelCategory,
  isModelDownloadedByCategory,
  getLocalModelPathByCategory,
  ensureModelByCategory,
  type DownloadProgress,
} from 'react-native-sherpa-onnx/download';
import type {SupportedTargetLanguage} from '../../shared/store/settingsStore';

export type VITSModelConfig = {
  id: string;
  language: SupportedTargetLanguage;
  sizeMB: number;
};

// JA has no suitable small VITS model — falls back to system iOS
const VITS_MODELS: Partial<Record<SupportedTargetLanguage, VITSModelConfig>> = {
  vi: {id: 'vits-piper-vi_VN-25hours_single-low', language: 'vi', sizeMB: 64},
  en: {id: 'vits-piper-en_US-libritts_r-medium', language: 'en', sizeMB: 78},
  ko: {id: 'vits-mimic3-ko_KO-kss_low', language: 'ko', sizeMB: 64},
  zh: {id: 'vits-melo-tts-zh_en', language: 'zh', sizeMB: 159},
};

export function getVITSModelConfig(
  language: SupportedTargetLanguage,
): VITSModelConfig | null {
  return VITS_MODELS[language] ?? null;
}

export async function isVITSModelDownloaded(
  language: SupportedTargetLanguage,
): Promise<boolean> {
  const config = getVITSModelConfig(language);
  if (!config) return false;
  try {
    return await isModelDownloadedByCategory(ModelCategory.Tts, config.id);
  } catch {
    return false;
  }
}

export async function downloadVITSModel(
  language: SupportedTargetLanguage,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const config = getVITSModelConfig(language);
  if (!config) {
    throw new Error(`No VITS model available for language: ${language}`);
  }
  await ensureModelByCategory(ModelCategory.Tts, config.id, {onProgress, signal});
}

export async function getVITSModelPath(
  language: SupportedTargetLanguage,
): Promise<string | null> {
  const config = getVITSModelConfig(language);
  if (!config) return null;
  try {
    return await getLocalModelPathByCategory(ModelCategory.Tts, config.id);
  } catch {
    return null;
  }
}
