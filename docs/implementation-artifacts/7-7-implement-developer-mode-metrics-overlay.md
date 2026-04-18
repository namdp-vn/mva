# Story 7.7: Implement Developer Mode Metrics Overlay

Status: ready-for-dev

## Story

As a developer, I want a dev mode toggle showing real-time metrics overlaid on the meeting screen.

## Acceptance Criteria

1. **Given** dev mode on, **Then** overlay shows: STT latency (ms), Translation latency (ms), Speaker embedding latency (ms), RAM usage (MB), active Opus-MT models (Android), speaker cluster count.
2. **Given** dev mode off, **Then** no overlay visible.

## Tasks

- [ ] Build MetricsOverlay component (tiny monospace text, semi-transparent background)
- [ ] Track STT, translation, and speaker embedding latency per utterance
- [ ] Display RAM usage via platform API
- [ ] Add speaker diarization diagnostic: cluster count, last assignment score, last decision reason
- [ ] Add dev mode toggle in Settings
