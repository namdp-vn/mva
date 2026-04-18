# Meeting Voice Assistant — Story Catalog

**Architecture:** v4.0 (100% Offline, Platform-Native Translation, Speaker Diarization)
**Generated:** 2026-04-18

## Architecture Summary

Everything runs on the user's phone. No server, no network, no cloud APIs. All models bundled in app binary.
- **STT:** react-native-sherpa-onnx + Whisper-Small int8 (EN/JA/KO/ZH/VI — 5 languages)
- **Translation (iOS):** Apple Translation Framework (built-in, Neural Engine, ~30-50MB RAM)
- **Translation (Android):** Opus-MT tiny × 4 models (Helsinki-NLP, CC-BY 4.0, ~160MB RAM)
- **Speaker Diarization:** pyannote segmentation + CAM++ embedding via sherpa-onnx (~70MB RAM)
- **Meeting Minutes:** Extractive summary (TypeScript, TF-IDF, pattern matching, zero RAM)
- **UI:** 2-lane layout (Transcript + Translation) with speaker badges (S1/S2/S3) + 5 language badges

## Changes from v3.0

| Removed | Reason |
|---------|--------|
| Model download stories (1-3 old) | All models bundled in app — no download step |
| NLLB-600M TurboModule (3-1 old) | Crashes iPhone 14 Pro Max (~650MB RAM). CC-BY-NC license. |
| NLLB greedy/KV-cache (3-2 old) | NLLB entirely removed |
| NLLB model preparation (3-6 old) | NLLB entirely removed |
| SenseVoice references | Replaced with Whisper-Small for Vietnamese + Chinese support |

| Added | Reason |
|-------|--------|
| Epic 3: Platform-native translation (7 stories) | Apple Translation (iOS) + Opus-MT (Android) replace NLLB |
| Story 3-7: Vietnamese passthrough | Vietnamese speech needs no translation |
| Epic 5: Speaker Diarization (5 stories) | Label speakers as Speaker 1/2/3 per utterance |
| Epic 6: Meeting Minutes (4 stories) | Extractive summary, action items, topic segments, Markdown export |
| 5 language badges (ZH orange, VI purple) | Chinese + Vietnamese added to STT |

## Epic Map

| Epic | Stories | Points | Focus |
|------|---------|--------|-------|
| Epic 1: Foundation (Bundled Models) | 1-1 to 1-3 | 10 | Project init, model warm-up, security baseline |
| Epic 2: On-Device STT (Whisper-Small) | 2-1 to 2-5 | 17 | Audio capture, VAD, streaming STT, 5-language detection |
| Epic 3: Platform-Native Translation | 3-1 to 3-7 | 35 | Apple Translation (iOS), Opus-MT (Android), unified service, drafts, cancellation, VI passthrough |
| Epic 4: Meeting UI | 4-1 to 4-6 | 21 | 2-lane + speaker badges, recording, scroll, stop + minutes, accessibility |
| Epic 5: Speaker Diarization | 5-1 to 5-5 | 23 | CAM++ embeddings, clustering service, speaker badges, fault tolerance, recalculate |
| Epic 6: Meeting Minutes | 6-1 to 6-4 | 21 | Summarizer, summary card, Markdown export, topic segments |
| Epic 7: Sessions, Settings & Polish | 7-1 to 7-8 | 23 | SQLite, session list, review, deletion, settings, encryption, dev mode, theming |
| **Total** | **38 stories** | **~150 pts** | |

## Sprint Plan (9 weeks)

| Sprint | Stories | Goal |
|--------|---------|------|
| Week 1 | 1-1, 1-2, 1-3 | Foundation: project init + models warm up from bundle |
| Week 2 | 2-1, 2-2, 2-3, 2-4, 2-5 | STT: Whisper-Small streaming transcription with 5 languages |
| Week 3 | 3-1, 3-2 | Translation native modules: Apple (iOS) + Opus-MT (Android) — parallel dev |
| Week 4 | 3-3, 3-4, 3-5, 3-6, 3-7 | Translation integration: unified service, drafts, cancellation, VI passthrough |
| Week 5 | 4-1, 4-2, 4-3, 4-4, 4-5, 4-6 | Meeting UI: 2-lane + badges + scroll + stop flow + accessibility |
| Week 6 | 5-1, 5-2, 5-3, 5-4, 5-5 | Speaker diarization: embeddings + clustering + badges + recalculate |
| Week 7 | 6-1, 6-2, 6-3, 6-4 | Meeting minutes: summarizer + summary card + export + topics |
| Week 8 | 7-1, 7-2, 7-3, 7-4 | Sessions: SQLite + list + review + deletion |
| Week 9 | 7-5, 7-6, 7-7, 7-8 | Polish: settings + encryption + dev mode + theming |

## Critical Path

```
1-1 → 1-2 → 3-1/3-2 (parallel iOS+Android) → 3-3 → 3-4 → 4-1 → 4-4 → 7-1
```

**Story 3-1 (Apple Translation, 8pts)** and **Story 3-2 (Opus-MT, 8pts)** are the highest-complexity items — platform-specific native modules. They can be developed in parallel by iOS and Android developers.

**Secondary critical path:** 5-1 → 5-2 (SpeakerClusterService, 8pts) → 5-3. Runs independently from translation track.

## File List

```
stories/
├── 1-1-initialize-mobile-project-and-offline-architecture-baseline.md
├── 1-2-implement-app-bootstrap-and-model-warm-up.md
├── 1-3-establish-offline-only-configuration-and-security-baseline.md
├── 2-1-start-and-stop-meeting-capture-from-the-meeting-screen.md
├── 2-2-capture-microphone-audio-continuously-in-the-native-layer.md
├── 2-3-process-audio-chunks-through-vad-and-filter-silence.md
├── 2-4-emit-streaming-partial-transcript-during-active-speech.md
├── 2-5-emit-final-transcript-and-detected-language-at-utterance-end.md
├── 3-1-build-apple-translator-module-for-ios.md
├── 3-2-build-opus-mt-translator-module-for-android.md
├── 3-3-build-unified-translation-service.md
├── 3-4-translate-final-stt-results-to-vietnamese-on-device.md
├── 3-5-translate-partial-stt-results-as-draft-translations.md
├── 3-6-implement-translation-cancellation-and-concurrency-control.md
├── 3-7-implement-vietnamese-passthrough-without-translation.md
├── 4-1-build-meeting-screen-with-two-lane-layout.md
├── 4-2-implement-recording-indicator-and-session-timer.md
├── 4-3-implement-auto-scroll-and-jump-to-latest.md
├── 4-4-implement-stop-meeting-and-session-save-flow.md
├── 4-5-build-waiting-state-before-speech-detected.md
├── 4-6-deliver-accessibility-and-dark-mode-for-meeting-screen.md
├── 5-1-extract-speaker-embeddings-from-each-utterance.md
├── 5-2-implement-speaker-cluster-service.md
├── 5-3-display-speaker-badges-in-ui.md
├── 5-4-ensure-non-blocking-fault-tolerance.md
├── 5-5-recalculate-speakers-on-review-screen.md
├── 6-1-build-meeting-summarizer-service.md
├── 6-2-display-summary-card-on-review-screen.md
├── 6-3-export-meeting-minutes-as-markdown.md
├── 6-4-display-topic-segments-on-review-screen.md
├── 7-1-persist-meeting-data-to-sqlite.md
├── 7-2-build-session-history-list-on-home-screen.md
├── 7-3-build-session-review-detail-screen.md
├── 7-4-implement-session-deletion-and-data-cleanup.md
├── 7-5-build-settings-screen.md
├── 7-6-implement-local-storage-encryption.md
├── 7-7-implement-developer-mode-metrics-overlay.md
├── 7-8-implement-light-and-dark-mode-theming.md
└── index.md
```

## RAM Budget (Reference: iPhone 14 Pro Max, 6GB)

| Component | iOS RAM | Android RAM |
|-----------|---------|-------------|
| Whisper-Small STT | ~450MB | ~450MB |
| Translation | ~50MB (Apple) | ~160MB (Opus-MT ×2) |
| Speaker Diarization | ~70MB | ~70MB |
| RN Runtime | ~80MB | ~80MB |
| Meeting Minutes | ~0MB | ~0MB |
| **Total** | **~650MB** | **~760MB** |
