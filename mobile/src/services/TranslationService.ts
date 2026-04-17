import {Platform} from 'react-native';
import {SourceLanguage, TargetLanguage, UtteranceId} from '../shared/types';
import getNativeAppleTranslator, {LanguagePackStatus} from '../native/NativeAppleTranslator';
import getNativeOpusMtTranslator from '../native/NativeOpusMtTranslator';

// Re-export types from LiveMeetingTranslator for consumers
export type {LiveTranslationTask, LiveTranslationResult, LiveTranslationSkipped, LiveTranslationSkippedReason} from './LiveMeetingTranslator';

export type {Adapter} from './LiveMeetingTranslator';

export type {LanguagePackStatus} from '../native/NativeAppleTranslator';

/**
 * TranslationResult with latency tracking.
 */
export interface TranslationResult {
  text: string;
  latencyMs: number;
}

/**
 * TranslationService — platform-agnostic translation interface.
 *
 * iOS: Uses Apple Translation framework (Apple Neural Engine, ~30-50MB RAM)
 * Android: Uses Opus-MT Helsinki-NLP models via ONNX Runtime (~100MB RAM max)
 *
 * Both platforms translate from EN/JA/KO/ZH to VI.
 */
class TranslationService {
  private static readonly TARGET_LANG: TargetLanguage = 'vi';

  /**
   * Initialize the native translation module.
   * iOS: Checks language pack availability.
   * Android: Loads the en-vi model (always needed).
   */
  async initialize(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const module = getNativeAppleTranslator();
      if (!module) {
        return false;
      }
      return module.initialize();
    } else {
      const module = getNativeOpusMtTranslator();
      if (!module) {
        return false;
      }
      return module.initialize();
    }
  }

  /**
   * Translate text from source language to target language.
   *
   * @param text Source text to translate
   * @param srcLang Source language (en | ja | ko | zh)
   * @param targetLang Target language (default: 'vi')
   * @returns Translated text + latency
   */
  async translate(text: string, srcLang: SourceLanguage, targetLang: TargetLanguage = 'vi'): Promise<TranslationResult> {
    const startedAt = Date.now();

    // Skip if source language equals target language
    if (srcLang === targetLang) {
      return {text, latencyMs: Date.now() - startedAt};
    }

    if (Platform.OS === 'ios') {
      const module = getNativeAppleTranslator();
      if (!module) {
        throw new Error('Apple Translator not available');
      }

      // iOS Apple Translation handles all pairs directly.
      // Map our lang codes to what the native module expects.
      const translated = await module.translate(
        text,
        this.mapLangToApple(srcLang),
        this.mapLangToApple(targetLang),
      );

      return {
        text: translated,
        latencyMs: Date.now() - startedAt,
      };
    } else {
      // Android Opus-MT
      const module = getNativeOpusMtTranslator();
      if (!module) {
        throw new Error('OpusMT Translator not available');
      }

      // Android Opus-MT models are pre-trained for specific language pairs
      // Currently only supports Vietnamese as target language
      if (targetLang !== 'vi') {
        return {text, latencyMs: Date.now() - startedAt};
      }

      const translated = await module.translate(text, srcLang);

      return {
        text: translated,
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  /**
   * Translate multiple texts in batch.
   * Used for session review / backfill.
   */
  async translateBatch(texts: string[], srcLang: SourceLanguage | 'vi', targetLang: TargetLanguage = 'vi'): Promise<TranslationResult[]> {
    const startedAt = Date.now();

    // Skip if source language equals target language
    if (srcLang === targetLang) {
      return texts.map((text) => ({text, latencyMs: 0}));
    }

    if (Platform.OS === 'ios') {
      const module = getNativeAppleTranslator();
      if (!module) {
        throw new Error('Apple Translator not available');
      }

      const translated = await module.translateBatch(
        texts,
        this.mapLangToApple(srcLang),
        this.mapLangToApple(targetLang),
      );

      return translated.map((text) => ({text, latencyMs: Date.now() - startedAt}));
    } else {
      // Android: translate sequentially
      const module = getNativeOpusMtTranslator();
      if (!module) {
        throw new Error('OpusMT Translator not available');
      }

      // Android Opus-MT only supports Vietnamese as target
      if (targetLang !== 'vi') {
        return texts.map((text) => ({text, latencyMs: Date.now() - startedAt}));
      }

      const results: TranslationResult[] = [];
      for (const text of texts) {
        const t = await module.translate(text, srcLang);
        results.push({text: t, latencyMs: Date.now() - startedAt});
      }
      return results;
    }
  }

  /**
   * Check if a language pair is available for translation.
   * iOS: Returns whether the language pack is downloaded.
   * Android: Returns whether the model files exist.
   */
  async isAvailable(srcLang: SourceLanguage, tgtLang: TargetLanguage = 'vi'): Promise<boolean> {
    // Accept 'vi' even though SourceLanguage doesn't include it (targetLanguage can be 'vi')
    const lang = srcLang as string;
    if (lang === 'vi') {
      return true;
    }

    if (Platform.OS === 'ios') {
      const module = getNativeAppleTranslator();
      if (!module) {
        return false;
      }
      return module.isLanguageAvailable(this.mapLangToApple(srcLang), this.mapLangToApple(tgtLang));
    } else {
      const module = getNativeOpusMtTranslator();
      if (!module) {
        return false;
      }
      // Use language-pair-specific check to verify source model is loaded for CJK languages
      // The Spec interface includes isLanguagePairReady for this purpose
      return module.isLanguagePairReady(srcLang, tgtLang);
    }
  }

  /**
   * Unload translation resources.
   * iOS: Clear cached sessions.
   * Android: Unload all ONNX sessions.
   */
  async unload(): Promise<void> {
    if (Platform.OS === 'ios') {
      const module = getNativeAppleTranslator();
      module?.unload();
    } else {
      const module = getNativeOpusMtTranslator();
      module?.unload();
    }
  }

  /**
   * Get the native module for platform-specific operations.
   * Returns null if not available.
   */
  getNativeModule(): ReturnType<typeof getNativeAppleTranslator> | ReturnType<typeof getNativeOpusMtTranslator> | null {
    if (Platform.OS === 'ios') {
      return getNativeAppleTranslator();
    } else {
      return getNativeOpusMtTranslator();
    }
  }

  /**
   * Map app language codes to platform-specific codes.
   * Apple uses standard locale identifiers.
   */
  private mapLangToApple(lang: SourceLanguage | TargetLanguage): string {
    switch (lang) {
      case 'en':
        return 'en';
      case 'ja':
        return 'ja';
      case 'ko':
        return 'ko';
      case 'zh':
        return 'zh-Hans';
      case 'vi':
        return 'vi';
      default:
        return 'en';
    }
  }
}

export const translationService = new TranslationService();