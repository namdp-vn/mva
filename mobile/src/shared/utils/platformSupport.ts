import {Platform} from 'react-native';

/** Apple Translation (TranslationSession) requires iOS 18.0+. */
export function isAppleTranslationAvailable(): boolean {
  if (Platform.OS !== 'ios') return true;
  const major = parseInt(String(Platform.Version).split('.')[0], 10);
  return !isNaN(major) && major >= 18;
}

/** Returns the iOS version string (e.g. "16.7.10"), or empty string on non-iOS. */
export function getIOSVersion(): string {
  if (Platform.OS !== 'ios') return '';
  return String(Platform.Version);
}
