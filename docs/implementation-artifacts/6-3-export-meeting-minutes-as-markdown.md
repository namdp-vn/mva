# Story 6.3: Export Meeting Minutes as Markdown File

Status: ready-for-dev

## Story

As a user, I want to export full meeting minutes as a Markdown file, so I can share structured meeting notes with colleagues.

## Acceptance Criteria

1. **Given** Review Screen, **When** user taps "Export Biên bản", **Then** .md file generated with: metadata, speaker stats table, key points, action items, keywords, topic segments, full transcript table.
2. **Given** exported file, **When** opened in any Markdown viewer, **Then** renders as professional meeting minutes.
3. **Given** share sheet, **Then** user can save to Files, send via email/messaging, or copy to clipboard.

## Tasks

- [ ] Implement MeetingSummarizer.formatAsMarkdown(minutes) — full template
- [ ] Include: header, date, duration, language breakdown, speaker stats table, key points, action items, keywords, topic segments, full transcript with speaker + lang + original + translation columns
- [ ] Add footer: "Biên bản được tạo tự động bởi Meeting Voice Assistant — 100% xử lý trên thiết bị"
- [ ] Generate filename: `MVA-minutes-YYYY-MM-DD-HHMM.md`
- [ ] Open system share sheet with generated file
- [ ] Also keep existing "Export TXT" (plain transcript) as second option
