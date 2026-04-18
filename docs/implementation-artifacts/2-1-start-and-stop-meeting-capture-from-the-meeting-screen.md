# Story 2.1: Start and Stop Meeting Capture from the Meeting Screen

Status: ready-for-dev

## Story

As a user, I want to tap "Start Meeting" to begin audio capture and STT, and "Stop Meeting" to end the session, so that I control when the app is listening.

## Acceptance Criteria

1. **Given** Home screen, **When** user taps FAB "New Meeting", **Then** navigates to Meeting Screen and audio capture + STT begin immediately.
2. **Given** active meeting, **When** user taps "Stop Meeting", **Then** audio capture stops, meeting minutes are generated, session is saved to SQLite, and app navigates to Review Screen.
3. **Given** meeting stopped, **When** checking system resources, **Then** microphone is released and no background audio processing continues.

## Tasks

- [ ] Implement "New Meeting" FAB on Home Screen
- [ ] Start audio capture + Whisper STT pipeline on Meeting Screen mount
- [ ] Initialize SpeakerClusterService.reset() for new session
- [ ] Implement "Stop Meeting" button that: stops audio → flushes STT → generates meeting minutes → saves to SQLite → navigates to Review
- [ ] Release microphone and unload on-demand models (Android: unload non-en-vi Opus-MT model)
