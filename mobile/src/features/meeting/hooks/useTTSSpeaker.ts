import {useEffect, useRef, useState} from 'react';
import {TTSSpeakerEmitter} from '../../../native/tts/NativeTTSSpeaker';
import {ttsService} from '../../../services/tts/TTSService';
import {useTtsEnabled, useTtsRate} from '../../../shared/store/settingsStore';
import type {TranslationEntry} from '../state/meetingStore';

interface UseTTSSpeakerResult {
  isSpeaking: boolean;
}

export function useTTSSpeaker(
  translations: TranslationEntry[],
  isActive: boolean,
  targetLanguage: string,
  ttsPaused: boolean,
): UseTTSSpeakerResult {
  const ttsEnabled = useTtsEnabled();
  const ttsRate = useTtsRate();
  const lastSpokenIdRef = useRef<string | null>(null);
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

  // Stop TTS when session becomes inactive or paused in meeting
  useEffect(() => {
    if (!isActive || ttsPaused) {
      ttsService.stop();
      setIsSpeaking(false);
      lastSpokenIdRef.current = null;
    }
  }, [isActive, ttsPaused]);

  // Speak new final translations
  useEffect(() => {
    if (!ttsEnabled || !isActive || ttsPaused) return;

    const finalEntries = translations.filter((e) => e.isFinal && e.translatedText?.trim());
    if (finalEntries.length === 0) return;

    const latest = finalEntries[finalEntries.length - 1];
    if (latest.id === lastSpokenIdRef.current) return;

    const lastIdx = lastSpokenIdRef.current
      ? finalEntries.findIndex((e) => e.id === lastSpokenIdRef.current)
      : -1;

    const newEntries = lastIdx === -1 ? [latest] : finalEntries.slice(lastIdx + 1);

    for (const entry of newEntries) {
      ttsService.speak(entry.translatedText, targetLanguage, ttsRate);
    }

    lastSpokenIdRef.current = latest.id;
  }, [translations, ttsEnabled, isActive, targetLanguage, ttsRate, ttsPaused]);

  return {isSpeaking};
}
