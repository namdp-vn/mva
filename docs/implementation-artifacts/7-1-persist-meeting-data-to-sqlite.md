# Story 7.1: Persist Meeting Data to SQLite During Live Sessions

Status: ready-for-dev

## Story

As a user, I want each meeting session (transcript + translations + speaker labels + timestamps) automatically saved to local SQLite database.

## Acceptance Criteria

1. **Given** meeting ends, **When** user opens app later, **Then** full session history available with all speaker labels and summary.
2. **Given** app force-killed during meeting, **Then** utterances saved up to last completed entry are preserved.
3. **Given** meeting_summaries table, **Then** summary JSON (key_points, action_items, keywords, topics, speaker_stats) persisted.

## Tasks

- [ ] Create SQLite schema: sessions, utterances (with speaker_id, speaker_label), translations (with source field), meeting_summaries, settings
- [ ] Implement incremental save: persist each utterance + translation as it arrives (not batch at end)
- [ ] Save meeting summary JSON to meeting_summaries table on session end
- [ ] Add speaker_id INTEGER + speaker_label TEXT columns to utterances table
- [ ] Add source TEXT ('device'/'native') to translations table
- [ ] Encrypt SQLite database with platform keychain
