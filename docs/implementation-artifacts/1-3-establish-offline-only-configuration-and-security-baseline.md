# Story 1.3: Establish Offline-Only Configuration and Security Baseline

Status: ready-for-dev

## Story

As a developer, I want all network access disabled and local storage encrypted, so that the app meets the zero-network-transmission privacy requirement.

## Acceptance Criteria

1. **Given** the app is running, **When** monitoring network traffic with a proxy, **Then** zero outbound connections are made.
2. **Given** app in airplane mode, **When** starting a meeting, **Then** all features work identically to online mode.
3. **Given** session data stored locally, **When** inspecting device storage, **Then** SQLite database is encrypted via platform keychain.

## Tasks

- [ ] Remove/disable any default network permissions beyond platform minimum
- [ ] Configure App Transport Security (iOS) to deny all connections
- [ ] Set up SQLite encryption using iOS Keychain / Android Keystore
- [ ] Verify no third-party libraries make network calls
- [ ] Add runtime check that asserts no active network sessions exist
- [ ] Document privacy guarantees in app About screen

## Dev Notes

- Audio is NEVER written to disk — exists only in memory buffer during STT + speaker embedding, then discarded
- No analytics, no crash reporting, no telemetry of any kind
