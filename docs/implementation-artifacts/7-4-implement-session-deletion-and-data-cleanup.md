# Story 7.4: Implement Session Deletion and Data Cleanup

Status: ready-for-dev

## Story

As a user, I want to delete individual sessions or all session data.

## Acceptance Criteria

1. **Given** swipe-to-delete or delete button, **When** confirmed, **Then** session + utterances + translations + summary permanently removed from SQLite.
2. **Given** Settings → "Delete All Sessions", **When** confirmed, **Then** all session data cleared.
3. **Given** deletion, **Then** speaker cluster data for that session is also cleared.

## Tasks

- [ ] Implement CASCADE delete: session → utterances → translations → meeting_summaries
- [ ] Add confirmation dialog before deletion
- [ ] Add "Delete All Sessions" button in Settings
- [ ] Clear speaker cluster cache for deleted sessions
