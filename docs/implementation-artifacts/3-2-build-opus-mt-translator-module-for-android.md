# Story 3.2: Build Opus-MT Translator TurboModule for Android

Status: ready-for-dev

## Story

As a developer (Android), I want an `OpusMtTranslatorModule` TurboModule that wraps Helsinki-NLP Opus-MT tiny models via ONNX Runtime, with two-hop translation strategy for JA/KO/ZH, so that Android has on-device translation matching iOS capability.

## Acceptance Criteria

1. **Given** models bundled in assets, **When** JS calls `OpusMtTranslator.translate("Hello world", "en")`, **Then** Vietnamese translation returned within 500ms.
2. **Given** Japanese speech detected, **When** translating, **Then** two-hop: JA→EN (opus-mt-ja-en) → EN→VI (opus-mt-en-vi). Total latency ≤ 1000ms.
3. **Given** language changes from JA to KO mid-meeting, **When** new language detected, **Then** old source model unloaded, new model loaded (~200ms swap), RAM stays ≤ 160MB.
4. **Given** opus-mt-en-vi always loaded, **Then** maximum 2 models loaded simultaneously at any time.

## Tasks

- [ ] Create `OpusMtTranslatorModule.kt` — TurboModule entry: `initialize()`, `translate(text, srcLang)`, `isModelLoaded()`, `unload()`
- [ ] Create `OpusMtTranslatorHelper.kt` — ONNX Runtime inference with NNAPI EP, model loading/swapping
- [ ] Create `OpusMtTokenizer.kt` — SentencePiece tokenizer (reuse or adapt existing SentencePiece code)
- [ ] Create `OpusMtTranslatorPackage.kt` — Module registration
- [ ] Implement always-loaded strategy: opus-mt-en-vi loaded at startup
- [ ] Implement on-demand loading: ja-en, ko-en, zh-en loaded when STT detects corresponding language
- [ ] Implement model swapping: unload old source model before loading new one
- [ ] Copy assets to internal storage on first launch (ONNX Runtime needs file:// paths)
- [ ] Run inference on `Dispatchers.Default` (background thread)
- [ ] Test all paths: EN→VI (direct), JA→EN→VI, KO→EN→VI, ZH→EN→VI

## Dev Notes

- Models: Helsinki-NLP opus-mt tiny (25.4M params each), ~50MB int8 ONNX per model
- 4 models bundled: en-vi, ja-en, ko-en, zh-en. Total ~200MB in APK
- License: CC-BY 4.0 (commercial use OK)
- Two-hop latency: ~200-300ms per hop → ~400-600ms total. Acceptable for meetings.
- MarianMT architecture — standard encoder-decoder, SentencePiece tokenization
