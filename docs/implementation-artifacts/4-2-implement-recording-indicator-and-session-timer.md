# Story 4.2: Implement Recording Indicator and Session Timer

Status: ready-for-dev

## Story

As a user, I want a recording indicator (pulsing red dot + elapsed timer) and the currently detected language badge at the top of the meeting screen.

## Acceptance Criteria

1. **Given** meeting active, **Then** red dot pulses (0.5s cycle, opacity 0.6→1.0) and timer counts up (HH:MM:SS).
2. **Given** language detected, **Then** top bar shows colored language pill (e.g., ZH orange, VI purple).

## Tasks

- [ ] Build top bar: pulsing red dot + elapsed timer + detected language pill
- [ ] Language pill updates per utterance (5 possible colors)
- [ ] Timer starts on meeting start, stops on meeting stop
