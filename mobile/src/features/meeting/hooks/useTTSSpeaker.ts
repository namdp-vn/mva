import {useEffect, useRef, useState} from 'react';
import {TTSSpeakerEmitter} from '../../../native/tts/NativeTTSSpeaker';
import {ttsService} from '../../../services/tts/TTSService';
import {useTtsEnabled, useTtsRate, useTtsEngine} from '../../../shared/store/settingsStore';
import type {TranslationEntry} from '../state/meetingStore';

interface UseTTSSpeakerResult {
  isSpeaking: boolean;
}

export function useTTSSpeaker(
  translations: TranslationEntry[],
  isActive: boolean,
  targetLanguage: string,
): UseTTSSpeakerResult {
  const ttsEnabled = useTtsEnabled();
  const ttsRate = useTtsRate();
  const ttsEngine = useTtsEngine();
  const lastSpokenIdRef = useRef<string | null>(null);

  // Keep service engine in sync with persisted store value
  useEffect(() => {
    if (ttsService.getEngine() !== ttsEngine) {
      ttsService.setEngine(ttsEngine);
    }
  }, [ttsEngine]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Subscribe to native TTS events for speaking indicator
  useEffect(() => {
    if (!TTSSpeakerEmitter) return;
    const startSub = TTSSpeakerEmitter.addListener('tts_started', () => setIsSpeaking(true));
    const finishSub = TTSSpeakerEmitter.addListener('tts_finished', () => setIsSpeaking(false));
    return () => {
      startSub.remove();
      finishSub.remove();
    };
  }, []);

  // Stop TTS when session becomes inactive
  useEffect(() => {
    if (!isActive) {
      ttsService.stop();
      setIsSpeaking(false);
      lastSpokenIdRef.current = null;
    }
  }, [isActive]);

  // Speak new final translations
  useEffect(() => {
    if (!ttsEnabled || !isActive) return;

    const finalEntries = translations.filter((e) => e.isFinal && e.translatedText?.trim());
    if (finalEntries.length === 0) return;

    const latest = finalEntries[finalEntries.length - 1];
    if (latest.id === lastSpokenIdRef.current) return;

    // Find all unspoken final entries and queue them in order
    const lastIdx = lastSpokenIdRef.current
      ? finalEntries.findIndex((e) => e.id === lastSpokenIdRef.current)
      : -1;

    const newEntries = lastIdx === -1 ? [latest] : finalEntries.slice(lastIdx + 1);

    for (const entry of newEntries) {
      ttsService.speak(entry.translatedText, targetLanguage, ttsRate);
    }

    lastSpokenIdRef.current = latest.id;
  }, [translations, ttsEnabled, isActive, targetLanguage, ttsRate]);

  return {isSpeaking};
}
