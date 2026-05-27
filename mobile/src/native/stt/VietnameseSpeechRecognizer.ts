import type {EmitterSubscription} from 'react-native';
import {Alert, Linking, NativeModules, Platform} from 'react-native';
import type {SessionId, UtteranceId} from '../../shared/types/common';
import type {MeetingPipelineEvent} from '../../shared/types/meeting';
import {warnLog} from '../../shared/utils/logger';
import {requestViPermission, startViListening, stopViListening, viSpeechEmitter} from './NativeViSpeech';

/**
 * Minimal interface for AudioSessionModule native calls.
 * Mirrors the subset used by RealSpeechRecognizer — keeps VietnameseSpeechRecognizer
 * consistent with the existing audio session lifecycle.
 */
type AudioSessionNative = {
  activateRecordingSession?: () => Promise<boolean>;
  deactivateRecordingSession?: () => Promise<boolean>;
};

const audioSessionModule: AudioSessionNative | undefined =
  Platform.OS === 'ios'
    ? (NativeModules.AudioSessionModule as AudioSessionNative | undefined)
    : undefined;

/**
 * VietnameseSpeechRecognizer
 *
 * Wraps the native ViSpeechModule (SFSpeechRecognizer, vi-VN locale) and
 * presents the same start/stop/pause/resume interface as RealSpeechRecognizer,
 * emitting the same MeetingPipelineEvent types (stt_partial / stt_final).
 *
 * Limitations (MVP):
 *  - iOS only: startListening rejects on Android.
 *  - Speaker diarization is disabled (audio_samples is always empty).
 *  - pause() stops the engine; resume() restarts it with a fresh session cycle.
 */
export class VietnameseSpeechRecognizer {
  private partialSub: EmitterSubscription | null = null;
  private finalSub: EmitterSubscription | null = null;
  private emitFn: ((event: MeetingPipelineEvent) => void) | null = null;
  private sessionId: SessionId | null = null;
  private paused = false;

  // ────────────────────────────────────────────────────────────────────────────
  // Public API (matches RealSpeechRecognizer)
  // ────────────────────────────────────────────────────────────────────────────

  async start(sessionId: SessionId, emit: (event: MeetingPipelineEvent) => void): Promise<void> {
    this.sessionId = sessionId;
    this.emitFn = emit;
    this.paused = false;

    const permResult = await requestViPermission();
    if (!permResult.granted) {
      const isMic = permResult.reason === 'MIC_PERMISSION_DENIED';
      const title = isMic ? 'Cần quyền Microphone' : 'Cần quyền Speech Recognition';
      const message = isMic
        ? 'Ứng dụng cần quyền Microphone để nhận diện tiếng Việt.\n\nVào Settings → Privacy & Security → Microphone → bật cho ứng dụng này.'
        : 'Ứng dụng cần quyền Speech Recognition để nhận diện tiếng Việt.\n\nVào Settings → Privacy & Security → Speech Recognition → bật cho ứng dụng này.';
      Alert.alert(title, message, [
        {text: 'Huỷ', style: 'cancel'},
        {text: 'Mở Settings', onPress: () => Linking.openSettings()},
      ]);
      throw new Error(
        `VietnameseSpeechRecognizer: permission denied (${permResult.reason})`,
      );
    }

    // Activate audio session before starting the native STT engine.
    // This mirrors what RealSpeechRecognizer does and ensures:
    //   1. .playAndRecord category → TTS can play through headphones while recording
    //   2. .allowBluetoothA2DP → translation audio reaches BT headphones
    //   3. beginBackgroundTask → non-audio CPU work (translation) survives background
    //   4. enforceBuiltInMic → prevents BT HFP mic taking over the input
    if (audioSessionModule?.activateRecordingSession) {
      await audioSessionModule.activateRecordingSession().catch((err) => {
        warnLog('[VietnameseSpeechRecognizer] AudioSession activation failed:', err);
      });
    }

    this.subscribeToNativeEvents(emit);
    await startViListening(sessionId);
  }

  async stop(): Promise<void> {
    this.unsubscribeAll();
    await stopViListening().catch(() => undefined);

    // Deactivate audio session after native STT stops.
    // Mirrors RealSpeechRecognizer.deactivateAudioSession().
    if (audioSessionModule?.deactivateRecordingSession) {
      await audioSessionModule.deactivateRecordingSession().catch((err) => {
        warnLog('[VietnameseSpeechRecognizer] AudioSession deactivation failed:', err);
      });
    }

    this.emitFn = null;
    this.sessionId = null;
    this.paused = false;
  }

  async pause(): Promise<void> {
    if (this.paused) return;
    this.paused = true;
    await stopViListening().catch(() => undefined);
  }

  async resume(): Promise<void> {
    if (!this.paused || !this.sessionId || !this.emitFn) return;
    this.paused = false;
    // Re-subscribe (listeners were kept; native module was stopped).
    await startViListening(this.sessionId).catch((err) => {
      warnLog('[VietnameseSpeechRecognizer] Failed to resume:', err);
    });
  }

  /**
   * Speaker diarization is not supported for Vietnamese input — always returns
   * an empty buffer so useMeetingSession can call it without branching.
   */
  getSessionAudioBuffer(): number[] {
    return [];
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────────────────────────────────

  private subscribeToNativeEvents(emit: (event: MeetingPipelineEvent) => void): void {
    this.unsubscribeAll();

    if (!viSpeechEmitter) {
      warnLog('[VietnameseSpeechRecognizer] NativeEventEmitter not available — iOS only.');
      return;
    }

    this.partialSub = viSpeechEmitter.addListener('vi_speech_partial', (body) => {
      emit({
        type: 'stt_partial',
        session_id: body.session_id as SessionId,
        utterance_id: body.utterance_id as UtteranceId,
        text: body.text as string,
        language: 'vi',
        timestamp_ms: body.timestamp_ms as number,
        offset_ms: (body.offset_ms as number) ?? 0,
        revision: body.revision as number,
      });
    });

    this.finalSub = viSpeechEmitter.addListener('vi_speech_final', (body) => {
      emit({
        type: 'stt_final',
        session_id: body.session_id as SessionId,
        utterance_id: body.utterance_id as UtteranceId,
        text: body.text as string,
        language: 'vi',
        confidence: (body.confidence as number) ?? 0.8,
        timestamp_ms: body.timestamp_ms as number,
        offset_ms: (body.offset_ms as number) ?? 0,
        start_ms: (body.start_ms as number) ?? body.timestamp_ms,
        end_ms: (body.end_ms as number) ?? body.timestamp_ms,
        revision: body.revision as number,
        audio_samples: [],
        sample_rate: 16000,
      });
    });
  }

  private unsubscribeAll(): void {
    this.partialSub?.remove();
    this.partialSub = null;
    this.finalSub?.remove();
    this.finalSub = null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Singleton helpers — mirrors getRealSpeechRecognizer / releaseRealSpeechRecognizer
// ──────────────────────────────────────────────────────────────────────────────

let singletonInstance: VietnameseSpeechRecognizer | null = null;

export function getVietnameseSpeechRecognizer(): VietnameseSpeechRecognizer {
  if (!singletonInstance) {
    singletonInstance = new VietnameseSpeechRecognizer();
  }
  return singletonInstance;
}

export function releaseVietnameseSpeechRecognizer(): void {
  if (singletonInstance) {
    singletonInstance.stop().catch(() => undefined);
    singletonInstance = null;
  }
}
