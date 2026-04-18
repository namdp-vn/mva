# Story 4.6: Deliver Accessibility and Dark Mode for Meeting Screen

Status: ready-for-dev

## Story

As a user, I want the meeting screen to work in both dark and light mode with full accessibility support.

## Acceptance Criteria

1. **Given** system dark mode, **Then** meeting screen uses dark palette (bg #0A0A0F, text #E4E2EE).
2. **Given** VoiceOver/TalkBack enabled, **Then** all elements have accessibility labels including speaker badge ("Speaker 1, Japanese") and language badge.
3. **Given** prefers-reduced-motion, **Then** pulse animation disabled, transitions instant.

## Tasks

- [ ] Apply design system color tokens for light/dark mode
- [ ] Add accessibility labels to SpeakerBadge ("Speaker 1"), LangBadge ("Japanese"), transcript text
- [ ] Honor prefers-reduced-motion for recording pulse and draft transitions
- [ ] Test WCAG AA contrast (4.5:1) for all badge colors against both backgrounds
- [ ] Ensure speaker colors are distinguishable for color-blind users (supplement with S1/S2 text)
