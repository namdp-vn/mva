import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import en from './locales/en.json';
import vi from './locales/vi.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import zh from './locales/zh.json';

export const SUPPORTED_LANGUAGES = ['vi', 'en', 'ja', 'ko', 'zh'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<AppLanguage, {label: string; nativeLabel: string; flag: string}> = {
  vi: {label: 'Vietnamese', nativeLabel: 'Tiếng Việt', flag: '🇻🇳'},
  en: {label: 'English', nativeLabel: 'English', flag: '🇬🇧'},
  ja: {label: 'Japanese', nativeLabel: '日本語', flag: '🇯🇵'},
  ko: {label: 'Korean', nativeLabel: '한국어', flag: '🇰🇷'},
  zh: {label: 'Chinese', nativeLabel: '中文', flag: '🇨🇳'},
};

export function detectDeviceLanguage(): AppLanguage {
  // 1. getLocales() (RN 0.73+) — reads NSLocale.preferredLanguages, user's
  //    actual language preference (independent of region setting).
  try {
    type Locale = {languageCode: string; countryCode?: string};
    const rn = require('react-native') as {getLocales?: () => Locale[]};
    const locales = rn.getLocales?.();
    if (locales && locales.length > 0) {
      const lang = locales[0].languageCode as AppLanguage;
      if (SUPPORTED_LANGUAGES.includes(lang)) {
        return lang;
      }
    }
  } catch {}

  // 2. Intl.DateTimeFormat — fallback only. On iOS this reads NSLocale.currentLocale
  //    which is region-based and may differ from the language preference.
  try {
    if (typeof Intl !== 'undefined') {
      const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
      if (intlLocale) {
        const lang = intlLocale.split(/[-_]/)[0] as AppLanguage;
        if (SUPPORTED_LANGUAGES.includes(lang)) {
          return lang;
        }
      }
    }
  } catch {}

  return 'vi';
}

// Initialize at module load time — i18next v26 with in-memory resources is synchronous.
// This ensures t() works correctly from the very first render.
i18n.use(initReactI18next).init({
  resources: {
    en: {meeting: en.meeting, settings: en.settings, history: en.history, splash: en.splash},
    vi: {meeting: vi.meeting, settings: vi.settings, history: vi.history, splash: vi.splash},
    ja: {meeting: ja.meeting, settings: ja.settings, history: ja.history, splash: ja.splash},
    ko: {meeting: ko.meeting, settings: ko.settings, history: ko.history, splash: ko.splash},
    zh: {meeting: zh.meeting, settings: zh.settings, history: zh.history, splash: zh.splash},
  },
  lng: detectDeviceLanguage(),
  fallbackLng: 'vi',
  ns: ['meeting', 'settings', 'history', 'splash'],
  defaultNS: 'meeting',
  interpolation: {escapeValue: false},
});

/** Call after Zustand store hydrates to apply the persisted app language. */
export function initI18n(language?: AppLanguage): void {
  if (language && language !== i18n.language) {
    i18n.changeLanguage(language);
  }
}

export function changeAppLanguage(language: AppLanguage): void {
  i18n.changeLanguage(language);
}

export {i18n};
export default i18n;
