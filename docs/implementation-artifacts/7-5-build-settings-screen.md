# Story 7.5: Build Settings Screen with Model Info

Status: ready-for-dev

## Story

As a user, I want a Settings screen showing model information (Whisper-Small, Apple Translation/Opus-MT, CAM++), all "Bundled & Ready", along with storage usage and preferences.

## Acceptance Criteria

1. **Given** Settings screen, **Then** shows 3 model sections: Speech Recognition (Whisper-Small, 244MB, ✅ Bundled, 5 languages), Translation (Apple Translation on iOS / Opus-MT on Android, supported pairs), Speaker Detection (CAM++, 35MB, ✅ Bundled, sensitivity slider).
2. **Given** storage section, **Then** shows model size (bundled), session data size, and free space.
3. **Given** speaker sensitivity slider, **When** adjusted, **Then** updates SpeakerClusterService threshold.

## Tasks

- [ ] Build SettingsScreen with model info cards (platform-conditional for translation engine name)
- [ ] Display 5 supported languages with flags
- [ ] Display 4 translation pairs (EN→VI, JA→VI, KO→VI, ZH→VI) + Vietnamese note
- [ ] Add speaker detection sensitivity slider (range 0.3-0.9, default 0.55)
- [ ] Add storage section with model + session sizes
- [ ] Add "Delete All Sessions" button
- [ ] Add About section: version, "100% Offline", "5 Languages", "3 AI Models"
