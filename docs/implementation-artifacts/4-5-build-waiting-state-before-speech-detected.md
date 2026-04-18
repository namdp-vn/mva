# Story 4.5: Build Waiting State Before Speech Detected

Status: ready-for-dev

## Story

As a user, I want to see a "Listening..." animation with supported languages listed after starting a meeting but before anyone speaks.

## Acceptance Criteria

1. **Given** meeting started but no speech yet, **Then** subtle sound wave animation (violet, 30% opacity) + "Listening..." text + "Speak in EN, JA, KO, ZH, or VI".
2. **Given** first speech detected, **Then** waiting state replaced with live transcript.

## Tasks

- [ ] Build waiting state overlay with sound wave animation
- [ ] Display all 5 supported languages with flag emojis
- [ ] Transition to live transcript on first STT event
- [ ] Show empty lane headers: "ORIGINAL" + "BẢN DỊCH" with "(waiting for speech...)"
