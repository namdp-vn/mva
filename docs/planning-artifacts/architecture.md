# Architecture Decision Document — Meeting Voice Assistant

**Author:** nghinh  
**Date:** 2026-04-18  
**Version:** 4.0 (Offline — Platform-Native Translation)  
**Status:** Approved  
**Change from v3.0:** Whisper-Small replaces SenseVoice, Apple Translation + Opus-MT replace NLLB, speaker diarization added, meeting minutes added, models bundled in app.

---

## 1. Architecture Overview

### 1.1 Design Philosophy

**Everything on-device, nothing on the network.** MVA runs as a self-contained mobile application with zero server dependencies. All AI models execute on the phone's CPU/NPU. No audio or text ever leaves the device boundary. All models are bundled in the app binary — no download step for users.

### 1.2 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Mobile Device (React Native)                   │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                        JS Layer                             │  │
│  │  ┌───────────┐ ┌────────────────┐ ┌──────────────────┐    │  │
│  │  │ Zustand    │ │ Pipeline       │ │ UI (2-lane)      │    │  │
│  │  │ Store      │ │ Orchestrator   │ │ + Speaker Badges │    │  │
│  │  └───────────┘ └────────────────┘ │ + Summary Card   │    │  │
│  │                                    └──────────────────┘    │  │
│  │  ┌────────────────────────────────────────────────────┐    │  │
│  │  │ MeetingSummarizer (TypeScript)                      │    │  │
│  │  │ KeywordExtractor + SentenceScorer + ActionDetector  │    │  │
│  │  │ + TopicSegmenter + SpeakerClusterService            │    │  │
│  │  └────────────────────────────────────────────────────┘    │  │
│  └───────┬───────────────┬──────────────────┬────────────────┘  │
│          │ TurboModule    │ TurboModule       │ TurboModule      │
│  ┌───────▼───────────┐ ┌─▼────────────────┐ ┌▼───────────────┐ │
│  │ react-native-     │ │ TranslationSvc   │ │ SpeakerEmbed   │ │
│  │ sherpa-onnx        │ │ (platform-split) │ │ Module         │ │
│  │ ┌───────────────┐ │ │                  │ │ ┌────────────┐ │ │
│  │ │ Audio Capture  │ │ │ iOS:             │ │ │ CAM++      │ │ │
│  │ │ + Silero VAD   │ │ │  Apple Translate │ │ │ 30MB ONNX  │ │ │
│  │ ├───────────────┤ │ │  Framework       │ │ │ + pyannote │ │ │
│  │ │ Whisper-Small  │ │ │  (~30-50MB RAM)  │ │ │ 5MB ONNX   │ │ │
│  │ │ int8 (244MB)   │ │ │                  │ │ └────────────┘ │ │
│  │ │ EN/JA/KO/ZH/VI │ │ │ Android:         │ │                │ │
│  │ └───────────────┘ │ │  Opus-MT tiny    │ │ 192-dim embed  │ │
│  │ Native C++ Layer   │ │  4 × ~50MB ONNX │ │ per utterance  │ │
│  └───────────────────┘ │  (~120MB RAM)    │ └────────────────┘ │
│                         └──────────────────┘                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Local Storage (SQLite)                                     │  │
│  │  Sessions, Utterances (+ speaker_id), Translations,         │  │
│  │  Meeting Summaries, Settings                                │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Bundled Models (in app binary, no download)                │  │
│  │  whisper-small-int8/      (244MB)                           │  │
│  │  speaker-diarization/     (35MB)                            │  │
│  │  opus-mt/ (Android only)  (200MB)                           │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘

Network: NONE (airplane mode compatible)
Server: NONE
```

### 1.3 Data Flow — Single Utterance

```
MIC → PCM 16kHz → Silero VAD → Whisper-Small → text + lang
                                     │
                          ┌──────────┼──────────┐
                          ▼          ▼          ▼
                    JS Store    Translation   Speaker Embed
                    (Zustand)   (platform)    (CAM++)
                          │          │          │
                          ▼          ▼          ▼
                    Transcript   Translation  Speaker Label
                    Lane UI      Lane UI      (S1/S2/S3)
                          │          │          │
                          └──────────┼──────────┘
                                     ▼
                                  SQLite
```

---

## 2. Component Architecture

### 2.1 STT Component — Whisper-Small via react-native-sherpa-onnx

| Aspect | Detail |
|--------|--------|
| Package | `react-native-sherpa-onnx` |
| Model | Whisper-Small int8 (~244MB: encoder 50MB + decoder 194MB) |
| Languages | EN, JA, KO, ZH, VI auto-detect (99 languages supported) |
| Audio | 16kHz mono PCM, 80ms chunks |
| VAD | Silero VAD (bundled) |
| Architecture | Autoregressive (seq2seq) |
| Latency | ~1-2s per utterance on iPhone 14 Pro Max |
| RAM | ~400-500MB |
| Task | `transcribe` (NOT translate — translation handled separately) |
| Bundled | Yes — in app binary, no download |

**Trade-off vs SenseVoice-Small:** Whisper is ~5x slower (autoregressive vs non-autoregressive) but gains Vietnamese + Chinese support. Acceptable for meeting pace.

### 2.2 Translation Component — Platform-Native

#### iOS: Apple Translation Framework

| Aspect | Detail |
|--------|--------|
| Framework | `Translation` (iOS 17.4+) |
| API | `TranslationSession.translate(text)` |
| Engine | Apple Neural Engine (16-core on A16) |
| RAM | ~30-50MB (managed by OS, not app) |
| Latency | 50-200ms per sentence |
| Languages | EN↔VI, JA↔VI, KO↔VI, ZH↔VI — all supported natively |
| Model files | None in app bundle — language packs managed by iOS Settings |
| License | Free for all iOS apps |
| Offline | Yes, after language packs downloaded (one-time ~50MB per pair) |

#### Android: Opus-MT Tiny (Helsinki-NLP)

| Aspect | Detail |
|--------|--------|
| Architecture | MarianMT (Transformer encoder-decoder) |
| Parameters | 25.4M per model |
| Models needed | opus-mt-en-vi, opus-mt-ja-en, opus-mt-ko-en, opus-mt-zh-en |
| Model size | ~50MB each (int8 ONNX), ~200MB total |
| RAM | ~80MB per loaded model, max 2 loaded at once (~160MB) |
| Strategy | EN→VI direct; JA/KO/ZH→EN→VI two-hop |
| Latency | 100-300ms (direct) / 200-500ms (two-hop) |
| License | CC-BY 4.0 (commercial OK) |
| Bundled | Yes — in app binary, no download |

**Model swapping:** Only `opus-mt-en-vi` (always needed) + the active source-to-EN model are loaded. When STT detects language change (e.g., JA→KO), the old source model is unloaded and new one loaded (~200ms swap).

### 2.3 Speaker Diarization — pyannote + CAM++ via sherpa-onnx

| Aspect | Detail |
|--------|--------|
| Segmentation model | pyannote-segmentation-3.0 (~5MB ONNX) |
| Embedding model | 3dspeaker_speech_campplus_sv_en_voxceleb_16k (~30MB ONNX) |
| Output | 192-dim float vector per utterance |
| Clustering | TypeScript — cosine similarity, 3-zone threshold, temporal bias, auto-merge |
| RAM | ~70MB total |
| Latency | ~10-30ms per utterance |
| Bundled | Yes — in app binary |
| Non-blocking | Runs in parallel with translation. Failure does not affect core pipeline. |

### 2.4 Meeting Minutes — TypeScript (No AI)

| Component | Purpose | Latency |
|-----------|---------|---------|
| KeywordExtractor | TF-IDF on Vietnamese translations | <100ms |
| SentenceScorer | 6-signal scoring (keywords, length, position, numbers, action, question) | <50ms |
| ActionItemDetector | Multilingual pattern matching ("need to", "cần phải", "してください") | <50ms |
| TopicSegmenter | Time-gap + keyword-shift segmentation | <30ms |
| MeetingSummarizer | Orchestrates above, generates structured minutes | <500ms total |

Zero additional RAM. Pure text processing on data already in SQLite.

### 2.5 Pipeline Orchestrator

Key behaviors:
1. **STT partial (≥5 words)** → fire translation, display as "draft"
2. **STT final** → cancel partial, fire final translation + speaker embedding extraction
3. **Speaker diarization** → runs in parallel with translation, assigns label after embedding extracted
4. **Vietnamese detected** → skip translation, copy to Translation Lane with "native" indicator
5. **Every 10 utterances** → recalculate all speaker clusters retroactively
6. **Session end** → generate meeting minutes (MeetingSummarizer), save to SQLite

### 2.6 Local Storage — SQLite

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `sessions` | id, started_at, ended_at, status | Meeting sessions |
| `utterances` | id, session_id, text, lang, is_final, speaker_id, speaker_label, timestamp | STT results with speaker |
| `translations` | id, utterance_id, text, is_draft, source ('device'/'native'), latency_ms | Translations |
| `meeting_summaries` | id, session_id, key_points, action_items, keywords, topics, speaker_stats | Generated minutes |
| `settings` | key, value | User preferences |

### 2.7 UI Architecture

**2-lane layout** with speaker badges:

| Lane | Content | Color Accent |
|------|---------|-------------|
| Transcript | Original text with speaker badge (S1/S2) + language badge (EN/JA/KO/ZH/VI) + timestamp | Blue (#3B82F6) |
| Translation | Vietnamese translation (draft → final) with matching speaker color | Amber (#F59E0B) |

Language badge colors: EN=#3B82F6 (blue), JA=#EF4444 (red), KO=#22C55E (green), ZH=#F97316 (orange), VI=#8B5CF6 (purple).

Speaker badge colors: S1=#A29BFE (purple), S2=#34D399 (teal), S3=#F87171 (coral), S4=#FBBF24 (amber), S5+=#9895AD (gray).

---

## 3. Key Architecture Decisions

### ADR-001: 100% Offline — No Server

**Decision:** Run all inference on-device. Remove all server components.
**Consequences:** Zero latency, airplane mode, absolute privacy. Trade-off: lower model quality than cloud.

### ADR-002: Whisper-Small over SenseVoice-Small

**Context:** SenseVoice-Small supports only ZH/EN/JA/KO/YUE — no Vietnamese.
**Decision:** Use Whisper-Small int8 (~244MB) which supports 99 languages including all 5 targets (EN/JA/KO/ZH/VI).
**Trade-off:** ~5x slower than SenseVoice (autoregressive vs non-autoregressive). Acceptable for meeting pace on iPhone 14 Pro Max with CoreML.

### ADR-003: Platform-Native Translation over NLLB

**Context:** NLLB-600M consumes ~650MB RAM, crashes iPhone 14 Pro Max. Also uses CC-BY-NC license (non-commercial only).
**Decision:** iOS uses Apple Translation Framework (built-in, ~30-50MB RAM, 50-200ms). Android uses Opus-MT tiny (25.4M params, ~160MB RAM for 2 models, CC-BY 4.0).
**Consequences:**
- (+) RAM reduced from ~650MB to ~50MB (iOS) / ~160MB (Android)
- (+) Latency improved 3-10x on iOS
- (+) License issue resolved (NLLB CC-BY-NC → Apple free / Opus-MT CC-BY 4.0)
- (+) App bundle reduced by 600-800MB
- (-) Android requires two-hop for JA/KO/ZH (slightly lower quality)
- (-) iOS requires one-time language pack download (~50MB per pair, managed by iOS)

### ADR-004: Models Bundled in App Binary

**Context:** Download step creates friction, requires internet on first launch, needs resume logic.
**Decision:** Bundle all models in app binary. User installs and everything is ready immediately.
**Trade-off:** Larger install size (~350MB iOS / ~550MB Android) but zero first-launch friction.

### ADR-005: Speaker Diarization (Anonymous Labels)

**Decision:** Add per-utterance speaker labels (Speaker 1, 2, 3...) using pyannote + CAM++ bundled models (~35MB, ~70MB RAM).
**Non-blocking:** If diarization fails, utterance still displays normally.

### ADR-006: Extractive Meeting Minutes (No AI)

**Decision:** Use pure TypeScript text processing (TF-IDF, pattern matching) for meeting minutes instead of LLM.
**Rationale:** LLM (even Qwen2-0.5B at ~500MB RAM) would exceed device budget. Extractive approach uses zero additional RAM and completes in <500ms.

---

## 4. Project Structure

```
meeting-voice-assistant/
├── android/
│   └── app/src/main/
│       ├── assets/models/
│       │   ├── whisper-small-int8/         # STT (~244MB)
│       │   ├── speaker-diarization/        # pyannote + CAM++ (~35MB)
│       │   └── opus-mt/                    # Translation (~200MB)
│       │       ├── en-vi/                  # Direct EN→VI
│       │       ├── ja-en/                  # JA→EN (for two-hop)
│       │       ├── ko-en/                  # KO→EN
│       │       └── zh-en/                  # ZH→EN
│       └── java/com/mva/translation/
│           ├── OpusMtTranslatorModule.kt
│           ├── OpusMtTranslatorHelper.kt
│           ├── OpusMtTokenizer.kt
│           └── OpusMtTranslatorPackage.kt
├── ios/
│   ├── Models/
│   │   ├── whisper-small-int8/             # STT (~244MB)
│   │   └── speaker-diarization/            # pyannote + CAM++ (~35MB)
│   │   # No translation models — Apple Translation is built into iOS
│   ├── AppleTranslatorModule.swift
│   └── AppleTranslatorModule.mm
├── src/
│   ├── native/
│   │   ├── NativeAppleTranslator.ts        # iOS TurboModule interface
│   │   └── NativeOpusMtTranslator.ts       # Android TurboModule interface
│   ├── services/
│   │   ├── TranslationService.ts           # Platform-agnostic wrapper
│   │   ├── PipelineOrchestrator.ts         # STT → translate → diarize → UI
│   │   ├── SpeakerClusterService.ts        # Cosine similarity clustering
│   │   ├── SpeakerEmbeddingService.ts      # Wrap native embedding extraction
│   │   ├── MeetingSummarizer.ts            # Orchestrates minutes generation
│   │   ├── KeywordExtractor.ts             # TF-IDF keywords
│   │   ├── SentenceScorer.ts               # Multi-signal sentence ranking
│   │   ├── ActionItemDetector.ts           # Multilingual pattern matching
│   │   └── TopicSegmenter.ts               # Time-gap topic grouping
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── MeetingScreen.tsx               # 2-lane with speaker badges
│   │   ├── ReviewScreen.tsx                # Summary card + transcript + export
│   │   ├── SettingsScreen.tsx
│   │   └── SplashScreen.tsx                # Model warm-up (no download)
│   ├── components/
│   │   ├── TranscriptLane.tsx
│   │   ├── TranslationLane.tsx
│   │   ├── SessionCard.tsx
│   │   ├── LangBadge.tsx                   # EN/JA/KO/ZH/VI badges
│   │   ├── SpeakerBadge.tsx                # S1/S2/S3 colored badges
│   │   ├── SummaryCard.tsx                 # Key points + action items
│   │   ├── TopicSegmentList.tsx
│   │   ├── ActionItemList.tsx
│   │   └── KeywordPills.tsx
│   ├── data/
│   │   └── stopwords.ts                    # Vietnamese + English + Chinese stopwords
│   ├── store/
│   │   ├── conversationStore.ts            # Utterances + translations + speakers
│   │   └── settingsStore.ts
│   ├── db/
│   │   ├── schema.ts                       # SQLite tables (incl. meeting_summaries)
│   │   └── queries.ts
│   └── App.tsx
└── package.json
```

---

## 5. Resource Budget

### 5.1 Memory (RAM) — iPhone 14 Pro Max (6GB)

| Component | RAM | Notes |
|-----------|-----|-------|
| Whisper-Small int8 STT | ~450MB | Loaded at app start |
| Apple Translation Framework | ~30-50MB | Managed by iOS |
| Speaker Diarization (pyannote + CAM++) | ~70MB | Loaded at app start |
| React Native runtime | ~80MB | JS engine + UI |
| Meeting Minutes engine | ~0MB | Pure TypeScript computation |
| **Total iOS** | **~650MB** | ✅ Well within 6GB device |

### 5.2 Memory (RAM) — Android (6GB)

| Component | RAM | Notes |
|-----------|-----|-------|
| Whisper-Small int8 STT | ~450MB | Loaded at app start |
| Opus-MT (2 models max loaded) | ~160MB | en-vi always + active source model |
| Speaker Diarization | ~70MB | Loaded at app start |
| React Native runtime | ~80MB | JS engine + UI |
| **Total Android** | **~760MB** | ✅ Within budget |

### 5.3 Storage (App Bundle)

| Asset | iOS | Android | Notes |
|-------|-----|---------|-------|
| Whisper-Small int8 | 244MB | 244MB | Bundled |
| Speaker Diarization | 35MB | 35MB | Bundled |
| Opus-MT models | — | 200MB | Android only |
| App binary | 30MB | 30MB | |
| **Total install** | **~310MB** | **~510MB** | |

### 5.4 Latency Budget

| Stage | iOS | Android |
|-------|-----|---------|
| Audio chunk | 80ms | 80ms |
| VAD decision | 30ms | 30ms |
| STT (Whisper-Small) | ~1,000ms | ~1,500ms |
| Translation | 50-200ms | 200-500ms |
| Speaker embedding | 10-30ms | 10-30ms |
| UI render | 16ms | 16ms |
| **End-to-end** | **~1,200ms** | **~2,100ms** |
