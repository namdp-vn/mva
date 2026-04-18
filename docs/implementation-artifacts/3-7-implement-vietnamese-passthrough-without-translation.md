# Story 3.7: Implement Vietnamese Passthrough Without Translation

Status: ready-for-dev

## Story

As a Vietnamese user, I want my Vietnamese speech to appear in both lanes without translation processing, so there is zero latency for my own language.

## Acceptance Criteria

1. **Given** STT detects Vietnamese (lang="vi"), **When** final result emitted, **Then** same text appears in both Transcript Lane (with VI purple badge) and Translation Lane (with "native" badge).
2. **Given** Vietnamese utterance, **When** checking logs, **Then** no translation API was called — zero translation overhead.
3. **Given** Review Screen showing Vietnamese entry, **Then** translation line shows "(Ngôn ngữ gốc — không cần dịch)" in italic secondary color.

## Tasks

- [ ] In PipelineOrchestrator: check lang="vi" → skip translation, copy text directly
- [ ] Set translation.source = 'native' in Zustand store
- [ ] Translation Lane: render "native" badge (purple, matching VI badge style)
- [ ] Review Screen: render "(Ngôn ngữ gốc — không cần dịch)" for native entries
- [ ] Ensure Vietnamese utterances still trigger speaker embedding extraction
