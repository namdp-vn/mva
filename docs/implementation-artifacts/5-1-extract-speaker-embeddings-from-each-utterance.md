# Story 5.1: Extract Speaker Embeddings from Each Utterance

Status: ready-for-dev

## Story

As a developer, I want to extract a 192-dim speaker embedding from each utterance using CAM++ model, so that speakers can be clustered and labeled.

## Acceptance Criteria

1. **Given** utterance ≥1 second, **When** embedding extracted, **Then** 192-dim float vector produced within 30ms on iPhone 14 Pro Max.
2. **Given** utterance <1 second, **Then** diarization skipped (embedding too unreliable).
3. **Given** embedding extraction fails, **Then** utterance still displays normally without speaker label (non-fatal).

## Tasks

- [ ] Implement SpeakerEmbeddingService wrapping sherpa-onnx speaker embedding API (or native module if RN API unavailable)
- [ ] Load CAM++ model (`3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx`, 28.3MB) from bundle
- [ ] Load pyannote segmentation model (`model.onnx`, 5MB) from bundle
- [ ] Extract embedding after VAD end-of-utterance, in parallel with translation
- [ ] Pass utterance audio samples from native ring buffer to embedding extractor
- [ ] Discard audio immediately after embedding extracted
- [ ] Guard: skip utterances shorter than 1.0 second

## Dev Notes

- Recommended model: `campplus_sv_zh_en_16k-common_advanced.onnx` (trained on ZH+EN, better for multilingual meetings)
- Download: https://huggingface.co/csukuangfj/speaker-embedding-models
- Embedding extraction is NON-BLOCKING — runs in parallel with translation pipeline
