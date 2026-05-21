import {speakText, stopTTS} from '../../native/tts/NativeTTSSpeaker';

export type TtsRate = 'slow' | 'normal' | 'fast';
type TtsEngine = 'system';

const RATE_MAP: Record<TtsRate, number> = {
  slow: 0.42,
  normal: 0.52,
  fast: 0.62,
};

class TTSService {
  private engine: TtsEngine = 'system';

  speak(text: string, language: string, rate: TtsRate): void {
    speakText(text, language, RATE_MAP[rate]);
  }

  stop(): void {
    stopTTS();
  }

  setEngine(engine: TtsEngine): void {
    this.engine = engine;
  }
}

export const ttsService = new TTSService();
