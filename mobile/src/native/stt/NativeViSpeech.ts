import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ViSpeechNativeModule = NativeModules.ViSpeechModule as {
  /** Resolves true when both mic + speech recognition are granted.
   *  Rejects with code 'MIC_PERMISSION_DENIED' or 'SPEECH_PERMISSION_DENIED'. */
  requestPermission(): Promise<boolean>;
  startListening(sessionId: string): Promise<boolean>;
  stopListening(): Promise<boolean>;
} | undefined;

export type ViPermissionDeniedReason =
  | 'MIC_PERMISSION_DENIED'
  | 'SPEECH_PERMISSION_DENIED'
  | 'UNKNOWN';

/**
 * NativeEventEmitter for ViSpeechModule.
 * Emits: 'vi_speech_partial', 'vi_speech_final'
 * Only available on iOS — returns a no-op emitter on Android.
 */
export const viSpeechEmitter =
  Platform.OS === 'ios' && ViSpeechNativeModule
    ? new NativeEventEmitter(NativeModules.ViSpeechModule)
    : null;

export type ViPermissionResult =
  | {granted: true}
  | {granted: false; reason: ViPermissionDeniedReason};

/**
 * Request microphone + speech recognition permissions (iOS only).
 *
 * Returns {granted: true} when both permissions are authorized.
 * Returns {granted: false, reason} when denied — reason identifies which
 * permission was denied so the caller can show a targeted "Open Settings" prompt.
 *
 * On Android always returns {granted: false, reason: 'UNKNOWN'}.
 */
export async function requestViPermission(): Promise<ViPermissionResult> {
  if (Platform.OS !== 'ios' || !ViSpeechNativeModule) {
    return {granted: false, reason: 'UNKNOWN'};
  }
  try {
    await ViSpeechNativeModule.requestPermission();
    return {granted: true};
  } catch (e: unknown) {
    const code =
      e != null && typeof e === 'object' && 'code' in e
        ? (e as {code: string}).code
        : 'UNKNOWN';
    const reason: ViPermissionDeniedReason =
      code === 'MIC_PERMISSION_DENIED' || code === 'SPEECH_PERMISSION_DENIED'
        ? (code as ViPermissionDeniedReason)
        : 'UNKNOWN';
    return {granted: false, reason};
  }
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
