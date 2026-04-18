# Story 5.5: Add Recalculate Speakers Button on Review Screen

Status: ready-for-dev

## Story

As a user, I want a "Recalculate Speakers" button on the Review Screen so that I can retroactively improve speaker assignment accuracy after the meeting ends.

## Acceptance Criteria

1. **Given** Review Screen with ⟳ button, **When** tapped, **Then** all embeddings are re-clustered from scratch.
2. **Given** recalculation produces different assignments, **Then** all utterance speaker labels update in UI and SQLite.
3. **Given** no changes needed, **Then** toast "No changes needed" appears.

## Tasks

- [ ] Add ⟳ (recalculate) button to Review Screen header
- [ ] Call speakerClusterService.recalculateAll() → get reassignment map
- [ ] Implement store.bulkUpdateSpeakers(reassignments) to update all affected utterances
- [ ] Update SQLite with new speaker_id/speaker_label values
- [ ] Show toast with result: "Speakers recalculated: N speakers found" or "No changes needed"
- [ ] Add diarization sensitivity slider to Settings screen (threshold 0.3-0.9, default 0.55)
