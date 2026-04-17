import {TurboModule, TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  initialize(): Promise<boolean>;
  translate(text: string, srcLang: string): Promise<string>;
  isLoaded(): Promise<boolean>;
  isLanguagePairReady(srcLang: string, tgtLang: string): Promise<boolean>;
  unload(): Promise<void>;
}

let cachedModule: Spec | null | undefined;

export default function getNativeOpusMtTranslator(): Spec | null {
  if (cachedModule !== undefined) {
    return cachedModule;
  }
  cachedModule = TurboModuleRegistry.getEnforcing<Spec>('OpusMtTranslatorModule');
  return cachedModule;
}