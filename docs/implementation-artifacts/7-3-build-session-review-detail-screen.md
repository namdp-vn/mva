# Story 7.3: Build Session Review Detail Screen

Status: ready-for-dev

## Story

As a user, I want to tap a past session and see the full Review Screen with summary card, topic segments, and transcript timeline with speaker labels.

## Acceptance Criteria

1. **Given** tapped session, **Then** Review Screen shows: metadata → Summary Card → Topic Segments → Full Transcript Timeline.
2. **Given** timeline entry, **Then** shows: timestamp + speaker badge + language badge + original text + "➜" + Vietnamese translation.
3. **Given** Vietnamese entry, **Then** shows "(Ngôn ngữ gốc — không cần dịch)" in italic.

## Tasks

- [ ] Build ReviewScreen loading session + utterances + translations + summary from SQLite
- [ ] Compose layout: metadata header → SummaryCard → TopicSegmentList → transcript FlatList
- [ ] Each transcript entry: timestamp + SpeakerBadge + LangBadge + original + "➜" + translation
- [ ] Handle Vietnamese entries with "native" source
- [ ] Add Export buttons at bottom: [Export Biên bản] [Export TXT]
- [ ] Add ⟳ Recalculate Speakers button in header
