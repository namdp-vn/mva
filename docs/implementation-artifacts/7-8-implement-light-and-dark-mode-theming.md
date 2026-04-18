# Story 7.8: Implement Light and Dark Mode Theming

Status: ready-for-dev

## Story

As a user, I want the app to work in both light and dark mode, respecting system preference.

## Acceptance Criteria

1. **Given** system dark mode, **Then** all screens use dark palette (bg #0A0A0F, surface #12121A).
2. **Given** system light mode, **Then** all screens use light palette (bg #FAFAFA, surface #FFFFFF).
3. **Given** mode change, **Then** transition is smooth (no flash).

## Tasks

- [ ] Define color tokens per design system (light + dark variants)
- [ ] Apply useColorScheme() hook throughout all screens
- [ ] Verify all 5 language badge colors meet WCAG AA contrast on both backgrounds
- [ ] Verify all 5 speaker badge colors are distinguishable on both backgrounds
- [ ] Test all screens in both modes: Splash, Home, Meeting, Review, Settings
