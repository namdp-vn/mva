# UX Design Specification — Meeting Voice Assistant

**Author:** nghinh  
**Date:** 2026-04-18  
**Version:** 4.0 (Offline — Platform-Native Translation)  
**Status:** Approved  
**Change from v3.0:** 5 language badges (added ZH/VI), speaker badges (S1/S2/S3), summary card on Review, no Model Download screen, meeting minutes export.

---

## 1. Design Strategy

### 1.1 Product Context

- **Type:** Single-purpose utility — real-time meeting transcription + translation + speaker tracking
- **Users:** Senior executives (40-55), moderate tech literacy, time-constrained
- **Context:** Phone on meeting table in dimly-lit conference room, glanced at periodically
- **Interaction model:** Passive consumption (read-only during meeting), active review (post-meeting)

### 1.2 Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Glanceable** | User glances 2-3 seconds — text hierarchy + speaker colors must be instantly clear |
| **Non-distracting** | No attention-grabbing animations, sounds, or bright elements during meetings |
| **Dark mode first** | Conference rooms are dim; reduce screen glare on the meeting table |
| **One-hand ready** | Start/stop meeting with single tap; no complex gestures needed |
| **Offline-confident** | Never show "connecting" or "downloading" states — everything is bundled and ready |

### 1.3 Information Architecture

```
App
├── Splash Screen (model warm-up, no download)
│   └── Permission Request (microphone)
├── Home (Session List)
│   ├── Start New Meeting → Meeting Screen
│   ├── Past Session → Review Screen
│   └── Settings → Settings Screen
├── Meeting Screen (2-lane live view)
│   ├── Transcript Lane (EN/JA/KO/ZH/VI + Speaker badges)
│   └── Translation Lane (VI + matching speaker colors)
├── Review Screen (post-meeting)
│   ├── Summary Card (key points + action items + keywords)
│   ├── Topic Segments
│   ├── Unified timeline with transcript + translation + speaker labels
│   └── Export (Markdown meeting minutes)
└── Settings Screen
    ├── Model Info (Whisper-Small, Apple/Opus-MT, CAM++)
    ├── Speaker Detection sensitivity
    ├── Target Language
    └── About / Storage
```

---

## 2. Design System

### 2.1 Color Palette

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--bg-primary` | #FAFAFA | #0A0A0F | App background |
| `--bg-surface` | #FFFFFF | #12121A | Cards, panels |
| `--bg-elevated` | #F5F5F5 | #1A1A26 | Section headers |
| `--text-primary` | #1A1A2E | #E4E2EE | Body text, transcriptions |
| `--text-secondary` | #6B7280 | #9895AD | Timestamps, labels |
| `--text-tertiary` | #9CA3AF | #6B6880 | Hints, placeholders |
| `--accent-primary` | #6C5CE7 | #A29BFE | Primary actions, brand |
| `--accent-transcript` | #3B82F6 | #60A5FA | Transcript lane accent |
| `--accent-translation` | #F59E0B | #FBBF24 | Translation lane accent |
| `--accent-success` | #10B981 | #34D399 | Model ready, recording active |
| `--accent-warning` | #F59E0B | #FBBF24 | Draft indicator |
| `--accent-danger` | #EF4444 | #F87171 | Stop button, errors |
| `--lang-en` | #3B82F6 | #60A5FA | English badge |
| `--lang-ja` | #EF4444 | #F87171 | Japanese badge |
| `--lang-ko` | #22C55E | #34D399 | Korean badge |
| `--lang-zh` | #F97316 | #FB923C | Chinese badge |
| `--lang-vi` | #8B5CF6 | #A78BFA | Vietnamese badge |
| `--speaker-1` | — | #A29BFE | Speaker 1 (purple) |
| `--speaker-2` | — | #34D399 | Speaker 2 (teal) |
| `--speaker-3` | — | #F87171 | Speaker 3 (coral) |
| `--speaker-4` | — | #FBBF24 | Speaker 4 (amber) |
| `--speaker-5` | — | #9895AD | Speaker 5+ (gray) |
| `--border` | rgba(0,0,0,0.08) | rgba(255,255,255,0.08) | Dividers |

### 2.2 Typography

| Style | Font | Size | Weight | Usage |
|-------|------|------|--------|-------|
| H1 | Inter | 24px | 700 | Screen titles |
| H2 | Inter | 18px | 600 | Section headers |
| Body | Inter | 15px | 400 | Transcript + translation text |
| Caption | Inter | 12px | 400 | Timestamps, metadata |
| Badge | Inter | 11px | 600 | Language badges (EN/JA/KO/ZH/VI), Speaker badges (S1/S2) |
| Mono | JetBrains Mono | 11px | 400 | Dev mode metrics |

---

## 3. Screen Specifications

### 3.1 Splash Screen — Model Warm-Up (NO download)

```
┌─────────────────────────────┐
│                             │
│      [App Icon - MVA]       │
│                             │
│    Meeting Voice Assistant  │
│   "Understand every voice"  │
│                             │
│   Loading speech engine...  │ ← Status text (cycles through)
│   [████████████░░░░] 75%    │ ← Overall progress
│                             │
│   100% Offline • 5 Languages│
│                             │
└─────────────────────────────┘
```

- **No model download.** Models are bundled. Warm-up only (load ONNX sessions + dummy inference).
- Status cycles: "Loading speech engine..." → "Loading speaker detection..." → "Ready!"
- Warm-up takes ~3-5s on iPhone 14 Pro Max. After complete → navigate to Home.

### 3.2 Home Screen — Session List

```
┌─────────────────────────────┐
│  MVA                    ⚙️  │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │ Apr 12 • 14:30-15:45  │  │
│  │ 1h 15m  EN JA ZH      │  │
│  │ 3 speakers • 47 utt   │  │ ← Speaker count added
│  │ "Báo cáo quý cho th..." │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Apr 11 • 09:00-10:20  │  │
│  │ 1h 20m  EN KO VI      │  │ ← VI badge when Vietnamese detected
│  │ 2 speakers • 52 utt   │  │
│  │ "Chúng ta cần hoàn..." │  │
│  └───────────────────────┘  │
│                             │
│                 ┌─────────┐ │
│                 │  🎙 New │ │ ← FAB
│                 │ Meeting │ │
│                 └─────────┘ │
└─────────────────────────────┘
```

Session cards now include: language badges (5 colors), **speaker count**, utterance count.

### 3.3 Meeting Screen — Live 2-Lane View

```
┌─────────────────────────────┐
│ ● Recording  00:12:34   ZH  │ ← Top bar + detected lang (orange for ZH)
├─────────────────────────────┤
│▎ ORIGINAL                   │ ← Blue left border
│▎                            │
│▎ S1 ZH 我们需要完成合同       │ ← Speaker badge + Lang badge + text
│▎                   14:33:15 │
│▎                            │
│▎ S2 VI  Tôi đồng ý          │ ← Vietnamese: purple badge
│▎                   14:33:28 │
│▎                            │
│▎ S1 JA  四半期の報告書は...    │
│▎                   14:32:07 │
├─────────────────────────────┤
│▎ BẢN DỊCH                  │ ← Amber left border
│▎                            │
│▎ Chúng ta cần hoàn tất...   │
│▎                   14:33:15 │
│▎                            │
│▎ Tôi đồng ý        native  │ ← "native" badge (VI = no translation)
│▎                   14:33:28 │
│▎                            │
│▎ Báo cáo quý cho thấy...   │
│▎                   14:32:07 │
├─────────────────────────────┤
│  [ ■  Stop Meeting ]        │
│  STT: 1.2s  Trans: 120ms   │ ← Dev mode only
└─────────────────────────────┘
```

**Changes from v3.0:**
- **Speaker badges** (S1/S2/S3 colored pills) before language badges
- **5 language badges** (EN=blue, JA=red, KO=green, ZH=orange, VI=purple)
- **"native" indicator** for Vietnamese utterances (no translation performed)
- **Speaker colors match** across Transcript and Translation lanes

### 3.4 Meeting Screen — Waiting State

```
┌─────────────────────────────┐
│ ● Recording  00:00:00       │
├─────────────────────────────┤
│                             │
│       ~ ~ ~ ~ ~ ~          │
│       Listening...          │
│                             │
│   Speak in any supported    │
│   language (EN/JA/KO/ZH/VI) │ ← Updated for 5 languages
│                             │
│▎ ORIGINAL                   │
│▎ (waiting for speech...)    │
├─────────────────────────────┤
│▎ BẢN DỊCH                  │
│▎ (waiting for speech...)    │
├─────────────────────────────┤
│  [ ■  Stop Meeting ]        │
└─────────────────────────────┘
```

### 3.5 Review Screen — Post-Meeting (with Summary)

```
┌─────────────────────────────┐
│  ←  Meeting Apr 12    📤 ⟳ │ ← Back + Export + Recalculate Speakers
├─────────────────────────────┤
│  Duration: 1h 15m           │
│  Languages: EN(20) JA(12)   │
│    ZH(8) VI(5) KO(2)       │ ← 5 languages
│  Speakers: 3 • Utterances: 47│
├─────────────────────────────┤
│                             │
│  📋 Tóm tắt cuộc họp       │ ← NEW: Summary Card
│                             │
│  Điểm chính:                │
│  • Tăng trưởng 15% trong Q3 │
│  • Đối tác Softbank — Fri   │
│  • Focus thị trường ĐNA     │
│                             │
│  Hành động:                 │
│  □ Hoàn tất thỏa thuận (S1) │
│  □ Chuẩn bị báo cáo (S2)   │
│                             │
│  Từ khóa: quarterly,        │
│  partnership, Southeast Asia │
│                             │
├─────────────────────────────┤
│  📑 Chủ đề thảo luận       │ ← NEW: Topic segments
│  1. Kết quả Q3 (14:30-42)  │
│  2. Đối tác (14:42-15:10)  │
│  3. Chiến lược ĐNA (15:10) │
├─────────────────────────────┤
│                             │
│  📝 Nội dung chi tiết       │ ← Full transcript
│                             │
│  14:30:05                   │
│  S1 EN  Good morning        │ ← Speaker + Lang + text
│  ➜ Chào buổi sáng           │
│                             │
│  14:30:18                   │
│  S2 JA  今日は第3四半期の... │
│  ➜ Hôm nay chúng ta thảo... │
│                             │
│  14:33:28                   │
│  S1 VI  Tôi đồng ý          │ ← Vietnamese
│  ➜ (Ngôn ngữ gốc)          │ ← Italic, secondary color
│                             │
├─────────────────────────────┤
│ [Export Biên bản] [Export TXT]│
└─────────────────────────────┘
```

### 3.6 Settings Screen

```
┌─────────────────────────────┐
│  ←  Settings                │
├─────────────────────────────┤
│                             │
│  Speech Recognition         │
│  ┌───────────────────────┐  │
│  │ Whisper-Small (int8)   │  │ ← Changed from SenseVoice
│  │ 244 MB • ✅ Bundled     │  │
│  │ EN, JA, KO, ZH, VI    │  │ ← 5 languages
│  └───────────────────────┘  │
│                             │
│  Translation                │
│  ┌───────────────────────┐  │
│  │ iOS: Apple Translation │  │ ← Platform-specific
│  │ Android: Opus-MT       │  │
│  │ EN→VI JA→VI KO→VI ZH→VI│ │ ← 4 pairs
│  │ VI = no translation     │  │
│  └───────────────────────┘  │
│                             │
│  Speaker Detection          │
│  ┌───────────────────────┐  │
│  │ CAM++ (3D-Speaker)     │  │
│  │ 35 MB • ✅ Bundled      │  │
│  │ Sensitivity [████░░] 0.55│ │ ← Adjustable
│  └───────────────────────┘  │
│                             │
│  Storage                    │
│  Models: Bundled (310 MB)   │ ← No separate download size
│  Sessions: 12 MB            │
│  [Delete All Sessions]      │
│                             │
│  Developer Mode     [○    ] │
│                             │
│  About                      │
│  Version 2.0 • 100% Offline │
│  5 Languages • 3 AI Models  │
│                             │
└─────────────────────────────┘
```

---

## 4. Interaction Patterns

### 4.1 Meeting Lifecycle

```
Home → [Tap FAB "New Meeting"]
  → Permission check (mic)
  → Meeting Screen (waiting state)
  → [Speech detected] → live transcription + translation + speaker labels
  → [Tap "Stop Meeting"]
  → Generate meeting minutes (<500ms)
  → Session saved to SQLite
  → Navigate to Review Screen (with summary card visible)
```

### 4.2 Draft → Final Transition (unchanged from v3.0)

1. Translation at 0.75 opacity with "draft" label
2. Final replaces: fade out old (150ms) → fade in new (150ms) → remove "draft"
3. If identical: simply remove "draft" label

### 4.3 Vietnamese Utterance Handling

When STT detects Vietnamese:
- Transcript Lane: shows text with VI badge (purple)
- Translation Lane: shows same text with "native" badge (purple, small)
- No translation API called — zero latency for VI utterances

### 4.4 Speaker Color Consistency

- Speaker badges use consistent colors within a session (S1 always purple)
- If clusters are recalculated (auto every 10 utterances, or manual "⟳" button), all utterances update to new labels
- Colors reset per session — S1 in Meeting A is unrelated to S1 in Meeting B

### 4.5 Error States

| State | UI Treatment |
|-------|-------------|
| Mic permission denied | Alert + "Open Settings" button |
| Apple Translation pack not installed | Banner: "Downloading language pack..." (iOS auto-manages) |
| Translation fails | Banner: "Translation unavailable — transcription still active" |
| Speaker diarization fails | Utterance displays normally without speaker badge |
| Device too hot | Subtle warning: "Device warm — performance may be reduced" |
| Storage full | Alert when session can't be saved |

---

## 5. Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Text size | Respect system Dynamic Type / font scale |
| Contrast | WCAG AA (4.5:1 ratio) in both modes |
| Screen reader | All elements have accessibility labels |
| Reduce motion | Honor `prefers-reduced-motion` |
| Color independence | Lane distinction via border position + header label, speaker via badge text (S1/S2) not color alone |

---

## 6. Responsive Considerations

| Device | Adaptation |
|--------|-----------|
| Small phone (iPhone SE) | 45/55 split. Reduce font to 14px. |
| Standard (iPhone 15) | 50/50 split. 15px font. |
| Large (iPhone 14/15 Pro Max) | 50/50 split. Reference device. |
| Tablet (iPad) | Side-by-side lanes (horizontal). |
