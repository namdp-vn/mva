# Story 2.2: Capture Microphone Audio Continuously in the Native Layer

Status: ready-for-dev

## Story

As a user, I want the app to capture room audio from the device microphone continuously at 16kHz while the meeting session is active, so that all speech is processed for transcription.

## Acceptance Criteria

1. **Given** mic permission granted and meeting active, **When** audio is present, **Then** PCM chunks (16kHz, mono) are delivered to STT engine within 80ms.
2. **Given** active session, **When** user scrolls history or views settings, **Then** audio capture continues uninterrupted.
3. **Given** any app state, **When** inspecting device storage and network, **Then** zero audio data is persisted or transmitted.

## Tasks

- [ ] Configure react-native-sherpa-onnx audio capture (16kHz mono PCM, 80ms chunks)
- [ ] Ensure audio pipeline stays entirely in native C++ layer (no JS bridge crossing for audio data)
- [ ] Retain utterance audio in native ring buffer for speaker embedding extraction (memory only, discarded after use)
- [ ] Verify audio is never written to disk or transmitted

## Dev Notes

- Audio buffer retention is new in v4.0: needed for speaker embedding extraction (CAM++ needs the raw audio of each utterance)
- Buffer is overwritten per utterance — only current utterance audio is retained, previous is discarded
