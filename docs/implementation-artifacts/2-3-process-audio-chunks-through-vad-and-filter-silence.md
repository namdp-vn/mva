# Story 2.3: Process Audio Chunks Through VAD and Filter Silence

Status: ready-for-dev

## Story

As a user, I want Voice Activity Detection to filter out silence and background noise, so that I don't see false transcriptions when nobody is talking.

## Acceptance Criteria

1. **Given** room noise without speech, **When** VAD processes audio, **Then** no STT results are emitted.
2. **Given** speaker finishes a sentence, **When** silence > 600ms, **Then** VAD signals end-of-utterance.
3. **Given** brief pause (<600ms) within a sentence, **When** speaker continues, **Then** VAD does NOT split the utterance.

## Tasks

- [ ] Configure Silero VAD within react-native-sherpa-onnx (32ms chunks)
- [ ] Set end-of-utterance silence threshold to 600ms
- [ ] Verify no false positives in typical meeting room noise (HVAC, paper shuffling)
- [ ] When VAD signals end-of-utterance, capture the utterance audio segment for speaker embedding extraction
