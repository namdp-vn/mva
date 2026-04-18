# Story 4.3: Implement Auto-Scroll and Jump to Latest

Status: ready-for-dev

## Story

As a user, I want both lanes to auto-scroll to the latest entry, with a "Jump to latest" button if I scroll up.

## Acceptance Criteria

1. **Given** new entry arrives, **Then** both lanes auto-scroll to bottom.
2. **Given** user scrolls up in one lane, **Then** auto-scroll pauses for THAT lane only. "↓ Latest" pill appears.
3. **Given** user taps "↓ Latest", **Then** smooth scroll to bottom + re-enable auto-scroll.

## Tasks

- [ ] Implement auto-scroll on new entries (both lanes independently)
- [ ] Detect manual scroll-up → pause auto-scroll per lane
- [ ] Build floating "↓ Latest" pill at bottom of paused lane
- [ ] Tap pill → scrollToEnd + re-enable auto-scroll
