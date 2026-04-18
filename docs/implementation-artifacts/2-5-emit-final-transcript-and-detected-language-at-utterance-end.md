# Story 2.5: Emit Final Transcript and Detected Language at Utterance End

Status: ready-for-dev

## Story

As a user, I want to see the finalized transcription with a language badge (EN/JA/KO/ZH/VI) when the speaker finishes a sentence, so that I know what was said and in which language.

## Acceptance Criteria

1. **Given** speaker finishes sentence (silence > 600ms), **When** STT emits final, **Then** final text replaces partial in Transcript Lane and is marked as complete.
2. **Given** speech in Japanese, **When** final result emitted, **Then** `lang: "ja"` is included with ≥ 90% accuracy for utterances ≥ 3 words.
3. **Given** speech in any of 5 languages (EN/JA/KO/ZH/VI), **When** detected, **Then** corresponding colored badge appears: EN=blue, JA=red, KO=green, ZH=orange, VI=purple.

## Tasks

- [ ] Wire STT final event → Zustand store (utterance marked as isFinal=true)
- [ ] Extract language code from Whisper result metadata
- [ ] Build LangBadge component with 5 language colors
- [ ] Create LanguageMapper service mapping Whisper codes → app codes → badge config
- [ ] Display final text with language badge + timestamp in Transcript Lane
- [ ] Trigger translation pipeline on final STT (unless language is Vietnamese)
- [ ] Trigger speaker embedding extraction on final STT
- [ ] Pass utterance audio samples + duration to PipelineOrchestrator

## Dev Notes

- Whisper language codes: 'en', 'ja', 'ko', 'zh', 'vi'
- Vietnamese utterances skip translation (FR-024)
- Speaker embedding extraction runs in parallel with translation (non-blocking)
