import {speakText, stopTTS} from '../../native/tts/NativeTTSSpeaker';

export type TtsRate = 'slow' | 'normal' | 'fast';

const RATE_MAP: Record<TtsRate, number> = {
  slow: 0.42,
  normal: 0.52,
  fast: 0.62,
};

class TTSService {
  speak(text: string, language: string, rate: TtsRate): void {
    speakText(text, language, RATE_MAP[rate]);
  }

  stop(): void {
    stopTTS();
  }
}

export const ttsService = new TTSService();
