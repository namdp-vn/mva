# Story 5.3: Display Speaker Badges in Meeting and Review UI

Status: ready-for-dev

## Story

As a user, I want colored speaker badges (S1, S2, S3...) next to each utterance so I can visually track who is saying what.

## Acceptance Criteria

1. **Given** speaker labels assigned, **When** viewing Transcript Lane, **Then** colored "S1"/"S2" pill badge appears before language badge.
2. **Given** Translation Lane, **Then** same speaker color appears on corresponding translation entry.
3. **Given** Review Screen, **Then** speaker labels appear in timeline view.
4. **Given** Home Screen session card, **Then** speaker count displayed (e.g., "3 speakers").

## Tasks

- [ ] Build SpeakerBadge component: S1=#A29BFE, S2=#34D399, S3=#F87171, S4=#FBBF24, S5+=#9895AD
- [ ] Add SpeakerBadge to TranscriptLane (before LangBadge)
- [ ] Add matching speaker color to TranslationLane entries
- [ ] Add speaker labels to ReviewScreen timeline
- [ ] Add speaker count to SessionCard on Home screen
- [ ] Add speakerId + speakerLabel to Zustand Utterance type
- [ ] Add speaker_id + speaker_label columns to SQLite utterances table
