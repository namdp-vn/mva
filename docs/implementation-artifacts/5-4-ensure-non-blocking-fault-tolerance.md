# Story 5.4: Ensure Speaker Diarization is Non-Blocking and Fault-Tolerant

Status: ready-for-dev

## Story

As a developer, I want speaker diarization to never block or degrade the core STT + Translation experience, even when it fails.

## Acceptance Criteria

1. **Given** embedding extraction throws error, **Then** utterance displays with text + translation, just no speaker badge.
2. **Given** CAM++ model fails to load at startup, **Then** meeting still works fully — just without speaker labels.
3. **Given** rapid speech (3 utterances in 5 seconds), **Then** diarization queue does not block translation pipeline.

## Tasks

- [ ] Wrap all diarization calls in try/catch in PipelineOrchestrator
- [ ] Log diarization errors but do not propagate to UI
- [ ] Handle CAM++ model load failure gracefully — set diarizationAvailable=false flag
- [ ] Ensure diarization runs asynchronously after translation dispatch (not serial)
