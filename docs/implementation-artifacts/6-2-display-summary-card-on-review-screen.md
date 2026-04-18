# Story 6.2: Display Summary Card on Review Screen

Status: ready-for-dev

## Story

As a user, I want a Summary Card at the top of the Review Screen showing key points, action items, and keywords, so I can quickly grasp what happened in the meeting.

## Acceptance Criteria

1. **Given** completed session with summary, **When** Review Screen opens, **Then** Summary Card appears above transcript timeline.
2. **Given** Summary Card, **Then** shows: 3-7 key points (bullets), action items (checkboxes with speaker + deadline), keyword pills.
3. **Given** user taps "Regenerate", **Then** summary is recalculated and card refreshes.

## Tasks

- [ ] Build SummaryCard component (key points, action items, keywords)
- [ ] Build ActionItemList component (checkbox style, speaker attribution, optional deadline)
- [ ] Build KeywordPills component (horizontal wrap of pill badges)
- [ ] Add Summary Card section to ReviewScreen (between metadata and transcript)
- [ ] Load summary from SQLite meeting_summaries table
- [ ] Add "Regenerate" button that re-runs MeetingSummarizer
