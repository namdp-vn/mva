import {NativeModules, Platform} from 'react-native';

/**
 * Language pack download status
 */
export type LanguagePackStatus = 'installed' | 'available' | 'unsupported' | 'unknown';

/**
 * Apple Translation native module interface (iOS only).
 * Uses legacy Bridge Native Module pattern.
 */
interface NativeAppleTranslatorModule {
  initialize(): Promise<boolean>;
  translate(text: string, srcLang: string, tgtLang: string): Promise<string>;
  translateBatch(texts: string[], srcLang: string, tgtLang: string): Promise<string[]>;
  isLanguageAvailable(srcLang: string, tgtLang: string): Promise<boolean>;
  downloadLanguageIfNeeded(srcLang: string, tgtLang: string): Promise<boolean>;
  getLanguagePackStatus(srcLang: string, tgtLang: string): Promise<LanguagePackStatus>;
  unload(): Promise<void>;
}

let cachedModule: NativeAppleTranslatorModule | null | undefined;

/**
 * Returns the native Apple Translator module, or null if not on iOS or not available.
 */
export default function getNativeAppleTranslator(): NativeAppleTranslatorModule | null {
  if (Platform.OS !== 'ios') {
    return null;
  }
  if (cachedModule !== undefined) {
    return cachedModule;
  }
  try {
    cachedModule = NativeModules.AppleTranslatorModule as NativeAppleTranslatorModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}