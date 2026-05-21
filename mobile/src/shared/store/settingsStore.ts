import {localStorage as AsyncStorage} from '../utils/localStorage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {type AppLanguage, detectDeviceLanguage, changeAppLanguage} from '../../i18n';

export type AppThemeMode = 'system' | 'dark' | 'light';

/**
 * Supported target translation languages.
 * Currently limited to Vietnamese (v1 offline build).
 * Expansion path: add 'zh', 'ko', 'ja', etc. when native translation models support them.
 */
export type SupportedTargetLanguage = 'en' | 'vi' | 'zh' | 'ko' | 'ja';

export interface LanguageOption {
  code: SupportedTargetLanguage;
  label: string;
  nativeLabel: string;
}

/**
 * Available target language options.
 * Vietnamese is default per Story S-602 AC.
 */
export const TARGET_LANGUAGE_OPTIONS: LanguageOption[] = [
  {code: 'en', label: 'English', nativeLabel: 'English'},
  {code: 'vi', label: 'Vietnamese', nativeLabel: 'Tiếng Việt'},
  {code: 'zh', label: 'Chinese', nativeLabel: '中文'},
  {code: 'ko', label: 'Korean', nativeLabel: '한국어'},
  {code: 'ja', label: 'Japanese', nativeLabel: '日本語'},
];

export const DEFAULT_TARGET_LANGUAGE: SupportedTargetLanguage = 'vi';

export function getLanguageOption(code: SupportedTargetLanguage): LanguageOption {
  return TARGET_LANGUAGE_OPTIONS.find((opt) => opt.code === code) ?? TARGET_LANGUAGE_OPTIONS[0];
}

/**
 * Speaker diarization sensitivity threshold.
 * Controls how aggressively the model clusters speaker segments.
 * - Lower values (0.3): Fewer speaker labels — may merge different speakers into one
 * - Higher values (0.9): More speaker labels — may split same speaker into multiple
 *
 * The algorithm blends this value (30%) with its internal calibrated default (70%),
 * so the slider adjusts sensitivity without over-riding the core clustering logic.
 *
 * @default 0.55
 * @range [0.3, 0.9]
 */
export const DIARIZATION_THRESHOLD_MIN = 0.3;
export const DIARIZATION_THRESHOLD_MAX = 0.9;
export const DEFAULT_DIARIZATION_THRESHOLD = 0.55;

export type SttEngineType = 'sense_voice';
export const DEFAULT_STT_ENGINE: SttEngineType = 'sense_voice';

export type {AppLanguage};

interface SettingsState {
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
  themeMode: AppThemeMode;
  setThemeMode: (mode: AppThemeMode) => void;
  /** Target translation language preference (default: Vietnamese) */
  targetLanguage: SupportedTargetLanguage;
  setTargetLanguage: (lang: SupportedTargetLanguage) => void;
  /** Speaker diarization sensitivity threshold (default: 0.55, range: 0.3-0.9) */
  diarizationThreshold: number;
  setDiarizationThreshold: (threshold: number) => void;
  /** STT engine: SenseVoice (EN/JA/KO/ZH). */
  sttEngine: SttEngineType;
  setSttEngine: (engine: SttEngineType) => void;
  /** App UI language — auto-detected from device locale on first run. */
  appLanguage: AppLanguage;
  setAppLanguage: (lang: AppLanguage) => void;
  /** True when app should follow device language automatically (user hasn't picked manually). */
  appLanguageIsAuto: boolean;
  setAppLanguageAuto: (lang: AppLanguage) => void;
  /** Reset to auto mode: re-detect device language and clear manual override. */
  resetToAutoLanguage: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      developerMode: false,
      setDeveloperMode: (enabled) => set({developerMode: enabled}),
      themeMode: 'system',
      setThemeMode: (mode) => set({themeMode: mode}),
      targetLanguage: DEFAULT_TARGET_LANGUAGE,
      setTargetLanguage: (lang) => set({targetLanguage: lang}),
      diarizationThreshold: DEFAULT_DIARIZATION_THRESHOLD,
      setDiarizationThreshold: (threshold) =>
        set({diarizationThreshold: Math.max(DIARIZATION_THRESHOLD_MIN, Math.min(DIARIZATION_THRESHOLD_MAX, threshold))}),
      sttEngine: DEFAULT_STT_ENGINE,
      setSttEngine: (engine) => set({sttEngine: engine}),
      appLanguage: detectDeviceLanguage(),
      setAppLanguage: (lang) => {
        set({appLanguage: lang, appLanguageIsAuto: false});
        changeAppLanguage(lang);
      },
      appLanguageIsAuto: true,
      setAppLanguageAuto: (lang) => {
        set({appLanguage: lang});
        changeAppLanguage(lang);
      },
      resetToAutoLanguage: () => {
        const lang = detectDeviceLanguage();
        set({appLanguage: lang, appLanguageIsAuto: true});
        changeAppLanguage(lang);
      },
    }),
    {
      name: 'vibevoice-settings-store',
      version: 6,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        developerMode: state.developerMode,
        themeMode: state.themeMode,
        targetLanguage: state.targetLanguage,
        diarizationThreshold: state.diarizationThreshold,
        sttEngine: state.sttEngine,
        appLanguage: state.appLanguage,
        appLanguageIsAuto: state.appLanguageIsAuto,
      }),
      migrate: (persistedState: unknown, version) => {
        const state = (persistedState ?? {}) as Partial<SettingsState>;
        const persistedThreshold = typeof state.diarizationThreshold === 'number'
          ? state.diarizationThreshold
          : DEFAULT_DIARIZATION_THRESHOLD;

        const upgradedThreshold =
          version < 3
            ? DEFAULT_DIARIZATION_THRESHOLD
            : Math.max(DIARIZATION_THRESHOLD_MIN, Math.min(DIARIZATION_THRESHOLD_MAX, persistedThreshold));

        return {
          developerMode: state.developerMode ?? false,
          themeMode: state.themeMode ?? 'system',
          targetLanguage: state.targetLanguage ?? DEFAULT_TARGET_LANGUAGE,
          diarizationThreshold: upgradedThreshold,
          sttEngine: DEFAULT_STT_ENGINE,
          appLanguage: version < 5 ? detectDeviceLanguage() : ((state as SettingsState).appLanguage ?? detectDeviceLanguage()),
          appLanguageIsAuto: version < 6 ? true : ((state as SettingsState).appLanguageIsAuto ?? true),
        } as SettingsState;
      },
    }
  )
);

export const useDeveloperMode = () => useSettingsStore((state) => state.developerMode);
export const useThemeMode = () => useSettingsStore((state) => state.themeMode);
export const useTargetLanguage = () => useSettingsStore((state) => state.targetLanguage);
export const useDiarizationThreshold = () => useSettingsStore((state) => state.diarizationThreshold);
export const useSttEngine = () => useSettingsStore((state) => state.sttEngine);
export const useAppLanguage = () => useSettingsStore((state) => state.appLanguage);
export const useAppLanguageIsAuto = () => useSettingsStore((state) => state.appLanguageIsAuto);
