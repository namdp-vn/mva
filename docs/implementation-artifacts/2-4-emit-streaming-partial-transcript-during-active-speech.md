# Story 2.4: Emit Streaming Partial Transcript During Active Speech

Status: ready-for-dev

## Story

As a user, I want to see partial (in-progress) transcription text updating in real time as someone speaks, so that I can follow the conversation before the speaker finishes.

## Acceptance Criteria

1. **Given** meeting active and Whisper-Small model loaded, **When** speaker talks in EN/JA/KO/ZH/VI, **Then** partial text appears in Transcript Lane within 500ms of speech onset.
2. **Given** active speech, **When** Whisper processes audio, **Then** updated partial text is emitted to JS layer.
3. **Given** partial text displayed, **When** compared to final text, **Then** partial is a prefix/subset of the final transcription.

## Tasks

- [ ] Configure react-native-sherpa-onnx partial result emission for Whisper-Small
- [ ] Forward partial results to Zustand store → Transcript Lane
- [ ] Display partial text with cursor blink animation at end
- [ ] Include detected language code with partial results

## Dev Notes

- Whisper-Small is autoregressive (~5x slower than SenseVoice) — partial latency target is 500ms (vs 300ms for SenseVoice)
- Whisper auto-detects language per utterance — `language: ''` (empty = auto-detect), `task: 'transcribe'`
