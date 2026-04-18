# Product Requirements Document — Meeting Voice Assistant

**Author:** nghinh  
**Date:** 2026-04-18  
**Version:** 4.0 (Offline — Platform-Native Translation)  
**Status:** Approved  
**Change from v3.0:** STT → Whisper-Small (5 languages), NLLB → Apple Translation (iOS) + Opus-MT (Android), speaker diarization added, meeting minutes added, models bundled in app.

---

## 1. Executive Summary

### 1.1 Purpose

This PRD defines requirements for **Meeting Voice Assistant (MVA)** — a mobile app enabling Vietnamese executives to understand multilingual meetings in real time via on-device speech recognition, translation, and speaker identification, entirely offline.

### 1.2 Problem Statement

Senior directors at Vietnamese telecom corporations frequently attend meetings with Japanese, Korean, Chinese, and international partners. Language barriers cause missed context, delayed responses, and reliance on human interpreters. Existing translation apps require internet, introduce privacy risks, and suffer from network-dependent latency.

### 1.3 Solution Overview

MVA runs entirely on the user's smartphone with no internet connection required:
- **On-device STT**: Captures room audio and transcribes EN/JA/KO/ZH/VI using Whisper-Small via `react-native-sherpa-onnx`
- **On-device Translation**: Translates to Vietnamese using Apple Translation Framework (iOS) / Opus-MT (Android)
- **Speaker Diarization**: Labels speakers (Speaker 1, 2, 3...) per utterance using pyannote + CAM++ via sherpa-onnx
- **Meeting Minutes**: Generates extractive summary, action items, topic segmentation when session ends
- **2-lane UI**: Displays original transcript + Vietnamese translation with speaker badges

All models bundled in the app binary — no download step. No audio or text ever leaves the phone.

### 1.4 What This Product Is NOT

- NOT a conferencing/video-call app
- NOT a cloud-connected service
- NOT an AI assistant (no LLM)
- NOT a voice interpreter (no TTS)
- NOT a speaker identification system (anonymous labels only)

### 1.5 Success Metrics

| Metric | Target |
|--------|--------|
| STT Word Error Rate (quiet room) | ≤ 15% across EN/JA/KO/ZH/VI |
| Translation display latency | ≤ 500ms (iOS) / ≤ 1s (Android) |
| Speaker diarization accuracy (DER) | ≤ 25% for 2-4 speakers |
| App cold start (models loaded) | ≤ 8s on iPhone 14 Pro Max |
| RAM usage (all models loaded) | ≤ 700MB (iOS) / ≤ 750MB (Android) |
| Battery drain per hour | ≤ 6% |
| App crash rate | < 0.5% per session |

---

## 2. Target User & Use Cases

### 2.1 Primary Persona

**Nghi, 42, Director of Digital Solution Center** — attends 3-5 international meetings per week with Japanese, Korean, and Chinese partners. Places iPhone 14 Pro Max on meeting table. Needs privacy, offline operation, and post-meeting review with speaker attribution.

### 2.2 Use Cases

| ID | Use Case | Description |
|----|----------|-------------|
| UC-01 | Live meeting translation | Transcribe EN/JA/KO/ZH/VI, translate to Vietnamese with speaker labels |
| UC-02 | Offline operation | Works identically in airplane mode |
| UC-03 | Meeting review | Review transcript + translations with speaker labels and summary |
| UC-04 | Meeting minutes | Auto-generated minutes with key points, action items, topics |
| UC-05 | Transcript export | Export meeting minutes as Markdown file |

---

## 3. Functional Requirements

### 3.1 Audio Capture

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Capture audio at 16kHz mono PCM. Audio stays in native layer. | Must |
| FR-002 | Audio capture continues while user navigates within app. | Must |
| FR-003 | Audio never stored to disk, never transmitted. Retained in memory only for speaker embedding, then discarded. | Must |

### 3.2 Speech-to-Text

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-010 | On-device STT using Whisper-Small int8 via react-native-sherpa-onnx. 5 languages: EN/JA/KO/ZH/VI. | Must |
| FR-011 | Partial results emitted during speech. | Must |
| FR-012 | Final result emitted on silence > 600ms. | Must |
| FR-013 | Auto-detect source language per utterance. | Must |
| FR-014 | VAD filters silence. | Must |

### 3.3 Translation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-020 | iOS: Apple Translation Framework (on-device, Neural Engine). Latency ~50-200ms. | Must |
| FR-020a | Android: Opus-MT tiny (Helsinki-NLP) via ONNX Runtime. EN→VI direct, JA/KO/ZH→EN→VI two-hop. | Must |
| FR-021 | Supported pairs: EN→VI, JA→VI, KO→VI, ZH→VI. | Must |
| FR-022 | Partial translation for STT partial ≥ 5 words. | Should |
| FR-023 | Translation cancellation when new STT arrives. | Must |
| FR-024 | Vietnamese speech: skip translation, show "native" indicator. | Must |

### 3.4 Speaker Diarization

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-070 | Extract 192-dim embedding per utterance using CAM++ via sherpa-onnx. | Should |
| FR-071 | Cluster embeddings (cosine similarity, 3-zone threshold, temporal bias) for speaker labels. | Should |
| FR-072 | Colored speaker badges (S1/S2/S3) in both lanes. | Should |
| FR-073 | Speaker count in session cards. | Should |
| FR-074 | Non-fatal: diarization failure does not affect STT/translation. | Must |
| FR-075 | "Recalculate Speakers" button on Review Screen. | Should |

### 3.5 Meeting Minutes

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-080 | Extractive summary: top 5-7 sentences by TF-IDF + multi-signal scoring. | Should |
| FR-081 | Action item detection: multilingual pattern matching. | Should |
| FR-082 | Topic segmentation: time-gap + keyword-shift based. | Should |
| FR-083 | Summary card on Review Screen. | Should |
| FR-084 | Export as Markdown with full meeting minutes format. | Should |

### 3.6 User Interface

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-030 | Two-lane layout: Transcript (with lang + speaker badges) + Translation. Independent scroll. | Must |
| FR-031 | Language badges: EN=blue, JA=red, KO=green, ZH=orange, VI=purple. | Must |
| FR-031a | Speaker badges: S1=purple, S2=teal, S3=coral, S4=amber, S5+=gray. | Should |
| FR-032 | Auto-scroll with "Jump to latest" pill. | Must |
| FR-033 | Start/Stop controls with recording indicator. | Must |
| FR-034 | Draft indicator for partial translations. | Should |

### 3.7 Session Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-040 | Save session (text + translations + speaker labels + summary) to SQLite. | Must |
| FR-041 | Session list with date, duration, languages, speaker count. | Must |
| FR-042 | Export as Markdown meeting minutes. | Should |
| FR-043 | Delete individual or all sessions. | Must |

### 3.8 Settings

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-060 | Display model info: Whisper-Small, Apple Translation/Opus-MT, CAM++. All bundled. | Should |
| FR-061 | Show 5 supported languages and 4 translation pairs. | Should |
| FR-062 | Diarization sensitivity slider. | Should |
| FR-063 | Dev mode with real-time metrics overlay. | Could |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Metric | Target | Maximum |
|--------|--------|---------|
| STT latency (Whisper-Small) | 300ms | 2,000ms |
| Translation latency (iOS) | 100ms | 500ms |
| Translation latency (Android two-hop) | 300ms | 1,000ms |
| Speaker embedding extraction | 20ms | 50ms |
| End-to-end (speech → translation) | 600ms | 1,500ms |
| UI frame rate | 60fps | 30fps min |
| Cold start | 5s | 8s |
| RAM - iOS | 600MB | 700MB |
| RAM - Android | 650MB | 750MB |
| Meeting minutes generation | 300ms | 500ms |

### 4.2 Privacy & Security

- Zero network transmission. Airplane mode compatible.
- No telemetry or analytics.
- Local storage encrypted via platform keychain.
- No third-party SDKs with network access.
- Audio never written to disk.

### 4.3 Compatibility

- **iOS:** 17.4+ with A15 chip or later (iPhone 13+). Reference: iPhone 14 Pro Max.
- **Android:** 10+ (API 29) with ≥ 6GB RAM.

---

## 5. Technical Constraints

### 5.1 Fixed Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| Framework | React Native 0.76+ (New Architecture) | TurboModules required |
| STT | Whisper-Small int8 (~244MB) via react-native-sherpa-onnx | 5 languages. Bundled. |
| Translation (iOS) | Apple Translation Framework | Zero bundle cost. Neural Engine. |
| Translation (Android) | Opus-MT tiny (25.4M params) × 4 models (~200MB) | CC-BY 4.0. Bundled. |
| Speaker Diarization | pyannote (~5MB) + CAM++ (~30MB) via sherpa-onnx | Bundled. |
| Meeting Minutes | TypeScript (TF-IDF, pattern matching) | No AI/LLM. Zero RAM. |
| State | Zustand | |
| Local DB | SQLite | |

### 5.2 Explicitly Excluded

| Excluded | Reason |
|----------|--------|
| NLLB-600M | Crashes iPhone 14 Pro Max (650MB RAM). CC-BY-NC license. |
| SenseVoice-Small | No Vietnamese support. |
| Model download step | All models bundled. |
| Server/backend | 100% offline. |
| AI/LLM summarization | RAM too tight. |

---

## 6. Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Whisper ~5x slower than SenseVoice | Certain | Medium | ~1-2s per utterance acceptable for meetings. CoreML accelerates on iPhone. |
| Apple Translation pack not pre-installed | Medium | Medium | Trigger download on first use. One-time ~50MB per pair. |
| Opus-MT two-hop quality lower | Medium | Medium | EN pivot well-supported. Acceptable for comprehension. |
| Speaker diarization degrades >6 speakers | Medium | Low | Documented limitation. Works best 2-4 speakers. |
| App size ~550MB (Android) | Low | Medium | Essential for offline. No reduction possible. |
