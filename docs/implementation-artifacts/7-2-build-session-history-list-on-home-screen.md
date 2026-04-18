# Story 7.2: Build Session History List on Home Screen

Status: ready-for-dev

## Story

As a user, I want a list of past sessions on the Home screen with date, duration, language breakdown, speaker count, and utterance count.

## Acceptance Criteria

1. **Given** 5 past sessions, **Then** Home screen lists all 5 with metadata.
2. **Given** session card, **Then** shows: date + time range, duration, language badges (5 colors), speaker count, utterance count, last translation preview.
3. **Given** empty state, **Then** illustration + "Start your first meeting" text with arrow to FAB.

## Tasks

- [ ] Build SessionCard component with all metadata fields
- [ ] Query sessions with speaker count (COUNT DISTINCT speaker_id) and language breakdown
- [ ] Add language badges (5 colors) and speaker count to card layout
- [ ] Implement empty state with illustration
- [ ] Implement swipe-to-delete on session cards
