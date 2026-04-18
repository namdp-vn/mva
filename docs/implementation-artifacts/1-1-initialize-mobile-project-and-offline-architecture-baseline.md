# Story 1.1: Initialize Mobile Project and Offline Architecture Baseline

Status: ready-for-dev

## Story

As a developer, I want the React Native project initialized with New Architecture (TurboModules), bundled AI models, and offline-only configuration, so that all subsequent stories build on a solid foundation.

## Acceptance Criteria

1. **Given** a fresh clone, **When** `yarn install && cd ios && pod install`, **Then** project builds successfully on both platforms.
2. **Given** the project structure, **When** inspecting the codebase, **Then** all bundled model directories exist: `whisper-small-int8/` (STT, ~244MB), `speaker-diarization/` (pyannote + CAM++, ~35MB), and `opus-mt/` (Android only, ~200MB).
3. **Given** the app configuration, **When** checking network permissions, **Then** zero network entitlements are declared (no HTTP, no WebSocket).

## Tasks

- [ ] Initialize React Native 0.76+ project with New Architecture enabled
- [ ] Configure TurboModule support for translation and speaker embedding native modules
- [ ] Add `react-native-sherpa-onnx` dependency
- [ ] Bundle Whisper-Small int8 model files into iOS (Bundle Resources) and Android (assets)
- [ ] Bundle speaker diarization models (pyannote + CAM++) into both platforms
- [ ] Bundle Opus-MT models (en-vi, ja-en, ko-en, zh-en) into Android assets only
- [ ] Set up Zustand store skeleton (conversationStore, settingsStore)
- [ ] Set up SQLite schema (sessions, utterances, translations, meeting_summaries, settings)
- [ ] Create folder structure per architecture.md v4.0
- [ ] Verify zero-network configuration (no NSAllowsArbitraryLoads, no INTERNET permission beyond default)

## Dev Notes

- All models are bundled in the app binary — no download/cache/resume logic needed
- iOS Translation uses Apple Translation Framework (built-in) — no model files to bundle for translation on iOS
- Android Translation uses Opus-MT tiny models — 4 model directories (~50MB each) bundled in assets
- Reference device: iPhone 14 Pro Max (6GB RAM, A16 Bionic)
