# Story 4.1: Build Meeting Screen with Two-Lane Layout

Status: ready-for-dev

## Story

As a user, I want a meeting screen with two vertically stacked lanes — Transcript (blue accent) with speaker + language badges, and Translation (amber accent) — each independently scrollable.

## Acceptance Criteria

1. **Given** active meeting, **When** speech transcribed and translated, **Then** both lanes update independently at 60fps.
2. **Given** Transcript Lane entry, **Then** shows: speaker badge (S1 purple, S2 teal) + language badge (EN blue, JA red, KO green, ZH orange, VI purple) + text + timestamp.
3. **Given** Translation Lane entry, **Then** shows: Vietnamese text + matching speaker color + timestamp. Vietnamese entries show "native" badge instead of translation.
4. **Given** scrolling one lane, **Then** other lane is unaffected.

## Tasks

- [ ] Build MeetingScreen with two FlatList components (50/50 vertical split)
- [ ] Build TranscriptLane component with SpeakerBadge + LangBadge + text + timestamp
- [ ] Build TranslationLane component with translated text + matching speaker color
- [ ] Blue left border (2px) for Transcript, amber (2px) for Translation
- [ ] Create SpeakerBadge component: S1=#A29BFE, S2=#34D399, S3=#F87171, S4=#FBBF24, S5+=#9895AD
- [ ] Create LangBadge component: EN=#3B82F6, JA=#EF4444, KO=#22C55E, ZH=#F97316, VI=#8B5CF6
- [ ] Connect both lanes to Zustand store utterances array via selectors
