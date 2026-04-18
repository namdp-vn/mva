# Story 4.4: Implement Stop Meeting and Session Save Flow

Status: ready-for-dev

## Story

As a user, I want tapping "Stop Meeting" to end audio capture, generate meeting minutes, save the session, and show the Review Screen.

## Acceptance Criteria

1. **Given** user taps "Stop Meeting", **Then** audio capture stops within 100ms.
2. **Given** meeting stopped, **When** all pending STT/translation complete, **Then** meeting minutes generated (<500ms) and full session saved to SQLite.
3. **Given** session saved, **Then** app navigates to Review Screen with summary card visible.

## Tasks

- [ ] Stop audio capture + flush remaining STT buffer
- [ ] Wait for in-flight translations to complete (or cancel after 3s timeout)
- [ ] Call meetingSummarizer.generateMinutes(sessionId) — extractive summary
- [ ] Save session, utterances, translations, speaker labels, and meeting summary to SQLite
- [ ] Navigate to Review Screen with sessionId parameter
- [ ] Release microphone resource
- [ ] (Android) Unload on-demand Opus-MT model to free RAM
