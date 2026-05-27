import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ViSpeechNativeModule = NativeModules.ViSpeechModule as {
  requestPermission(): Promise<boolean>;
  startListening(sessionId: string): Promise<boolean>;
  stopListening(): Promise<boolean>;
} | undefined;

/**
 * NativeEventEmitter for ViSpeechModule.
 * Emits: 'vi_speech_partial', 'vi_speech_final'
 * Only available on iOS — returns a no-op emitter on Android.
 */
export const viSpeechEmitter =
  Platform.OS === 'ios' && ViSpeechNativeModule
    ? new NativeEventEmitter(NativeModules.ViSpeechModule)
    : null;

/**
 * Request microphone + speech recognition permissions.
 * Resolves to true if both are granted, false otherwise.
 * iOS only — resolves to false on Android.
 */
export async function requestViPermission(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !ViSpeechNativeModule) return false;
  return ViSpeechNativeModule.requestPermission();
}

/**
 * Start continuous Vietnamese speech recognition for the given session.
 * iOS only — rejects with an error on Android.
 */
export async function startViListening(sessionId: string): Promise<boolean> {
  if (Platform.OS !== 'ios' || !ViSpeechNativeModule) {
    throw new Error('ViSpeechModule is only available on iOS.');
  }
  return ViSpeechNativeModule.startListening(sessionId);
}

/**
 * Stop the ongoing recognition session.
 * iOS only — resolves immediately on Android.
 */
export async function stopViListening(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !ViSpeechNativeModule) return true;
  return ViSpeechNativeModule.stopListening();
}
