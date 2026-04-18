# Story 3.6: Implement Translation Cancellation and Concurrency Control

Status: ready-for-dev

## Story

As a developer, I want translation requests to be cancellable, so that when new STT arrives while old translation is in progress, the old one is cancelled and replaced.

## Acceptance Criteria

1. **Given** translation in progress for utterance A, **When** STT final for utterance B arrives, **Then** translation A is cancelled and B starts within 50ms.
2. **Given** rapid speech (multiple utterances in quick succession), **Then** no translation queue overflow and UI stays responsive at 60fps.

## Tasks

- [ ] Implement version counter pattern in PipelineOrchestrator
- [ ] Cancel in-flight translation when new STT final arrives
- [ ] (Android) Handle Opus-MT ONNX session thread safety for concurrent cancel/start
- [ ] (iOS) Handle TranslationSession invalidation on cancel
- [ ] Test with rapid speech: 3 utterances in 5 seconds
