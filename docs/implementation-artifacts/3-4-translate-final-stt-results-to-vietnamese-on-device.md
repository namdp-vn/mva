# Story 3.4: Translate Final STT Results to Vietnamese On-Device

Status: ready-for-dev

## Story

As a user, I want each finalized transcript to be automatically translated to Vietnamese and displayed in the Translation Lane, so that I understand what was said.

## Acceptance Criteria

1. **Given** STT emits final "The quarterly report shows 15% growth" (lang=en), **When** translation runs, **Then** "Báo cáo quý cho thấy tăng trưởng 15%" appears in Translation Lane.
2. **Given** iOS, **Then** translation latency ≤ 500ms. **Given** Android two-hop, **Then** latency ≤ 1000ms.
3. **Given** Vietnamese speech detected, **Then** original text shown in Translation Lane with "native" indicator — no translation API called.

## Tasks

- [ ] Wire PipelineOrchestrator: STT final → translationService.translate() → store.updateTranslation()
- [ ] Handle Vietnamese passthrough: lang="vi" → copy to Translation Lane with source='native'
- [ ] Update Translation Lane UI to show "native" badge (purple) for Vietnamese utterances
- [ ] Store translation result to SQLite with source field ('device' or 'native')
