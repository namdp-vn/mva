# Story 3.5: Translate Partial STT Results as Draft Translations

Status: ready-for-dev

## Story

As a user, I want partial translations to appear as "drafts" while the speaker is still talking, so I get early understanding without waiting for the full sentence.

## Acceptance Criteria

1. **Given** partial STT has ≥5 words, **When** partial translation fires, **Then** Vietnamese draft appears with 0.75 opacity and amber "draft" label.
2. **Given** final STT arrives, **When** final translation replaces draft, **Then** smooth opacity transition (150ms) and "draft" label disappears.
3. **Given** Vietnamese partial detected, **Then** show partial directly without translation, no "draft" label.

## Tasks

- [ ] In PipelineOrchestrator: check partial word count ≥5 → fire translationService.translate()
- [ ] Mark translation as is_draft=true in Zustand store
- [ ] Build DraftIndicator component (amber "draft" label)
- [ ] Implement smooth replacement animation: fade old out (150ms) → fade new in (150ms)
- [ ] Skip draft translation for Vietnamese partials
