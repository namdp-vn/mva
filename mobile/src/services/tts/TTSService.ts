import {speakText, stopTTS} from '../../native/tts/NativeTTSSpeaker';
import {speakVITS, stopVITS} from './VITSTTSEngine';
import type {SupportedTargetLanguage} from '../../shared/store/settingsStore';

export type TtsRate = 'slow' | 'normal' | 'fast';
export type TtsEngine = 'system' | 'vits';

const RATE_MAP: Record<TtsRate, number> = {
  slow: 0.42,
  normal: 0.52,
  fast: 0.62,
};

class TTSService {
  private engine: TtsEngine = 'system';
  private vitsBusy = false;
  private vitsQueue: Array<{
    text: string;
    language: SupportedTargetLanguage;
    rate: TtsRate;
  }> = [];

  speak(text: string, language: string, rate: TtsRate): void {
    if (this.engine === 'vits') {
      this.enqueueVITS(text, language as SupportedTargetLanguage, rate);
    } else {
      speakText(text, language, RATE_MAP[rate]);
    }
  }

  stop(): void {
    if (this.engine === 'vits') {
      this.vitsQueue = [];
      this.vitsBusy = false;
      stopVITS().catch(() => {});
    } else {
      stopTTS();
    }
  }

  setEngine(engine: TtsEngine): void {
    if (this.engine !== engine) {
      this.stop();
      this.engine = engine;
    }
  }

  getEngine(): TtsEngine {
    return this.engine;
  }

  private enqueueVITS(
    text: string,
    language: SupportedTargetLanguage,
    rate: TtsRate,
  ): void {
    this.vitsQueue.push({text, language, rate});
    if (!this.vitsBusy) {
      this.drainVITSQueue();
    }
  }

  private drainVITSQueue(): void {
    if (this.vitsQueue.length === 0) {
      this.vitsBusy = false;
      return;
    }
    this.vitsBusy = true;
    const item = this.vitsQueue.shift()!;
    speakVITS(item.text, item.language, item.rate)
      .then(() => this.drainVITSQueue())
      .catch(() => this.drainVITSQueue());
  }
}

export const ttsService = new TTSService();
