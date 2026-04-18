# Story 5.2: Implement Speaker Cluster Service

Status: ready-for-dev

## Story

As a developer, I want a robust SpeakerClusterService that clusters embeddings using multi-zone cosine similarity with temporal bias and auto-merge, so that speakers are labeled accurately.

## Acceptance Criteria

1. **Given** 2 speakers alternating, **Then** exactly 2 speaker labels assigned consistently.
2. **Given** new speaker joins mid-meeting, **Then** new label (Speaker 3) created automatically.
3. **Given** same speaker with varying volume/emotion, **Then** all utterances get same label (L2 normalization handles magnitude).
4. **Given** 10+ utterances processed, **Then** clusters auto-recalculated retroactively to fix early errors.

## Tasks

- [ ] Implement SpeakerClusterService.ts with complete rewrite algorithm:
  - L2-normalize all embeddings before comparison
  - 3-zone decision: high confidence (>0.75), ambiguous (0.40-0.75), low (<0.40)
  - Compare to centroid (60%) + best individual member (40%) to prevent centroid drift
  - Temporal bias: +0.08 for speakers heard within 10 seconds
  - Store up to 20 embeddings per cluster, recalculate centroid from stored (not running average)
  - Auto-merge clusters when cosine similarity >0.70
  - Max speakers cap (default 8)
- [ ] Implement `assignSpeaker(embedding, duration, timestamp)` → returns speakerId + label
- [ ] Implement `recalculateAll()` → agglomerative re-clustering returning reassignment map
- [ ] Implement `reset()` for new session
- [ ] Add diagnostic logging (dev mode) showing per-utterance scores and decisions
- [ ] Wire into PipelineOrchestrator: call every 10 utterances for periodic refinement

## Dev Notes

- This is the most algorithmically complex service — see prompt-fix-speaker-clustering.md for detailed analysis of 6 root cause flaws in naive approach
- Clusters reset per session — Speaker 1 in Meeting A ≠ Speaker 1 in Meeting B
