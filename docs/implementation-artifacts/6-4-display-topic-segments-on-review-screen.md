# Story 6.4: Display Topic Segments on Review Screen

Status: ready-for-dev

## Story

As a user, I want to see discussion topics grouped by time on the Review Screen, so I can navigate to specific parts of the meeting.

## Acceptance Criteria

1. **Given** completed meeting, **When** Review Screen opens, **Then** topic segments appear between Summary Card and transcript.
2. **Given** topic segment, **Then** shows: topic title (auto-generated from keywords), time range, speaker count, utterance count.
3. **Given** user taps a topic segment, **Then** scrolls to that section in the transcript timeline.

## Tasks

- [ ] Build TopicSegmentList component (numbered list with time range + stats)
- [ ] Add between SummaryCard and transcript timeline on ReviewScreen
- [ ] Implement tap-to-scroll: tap topic → scroll transcript to corresponding timestamp
- [ ] Style: numbered list, secondary color time range, caption for speaker/utterance count
