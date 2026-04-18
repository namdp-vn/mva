# Story 3.1: Build Apple Translator TurboModule for iOS

Status: ready-for-dev

## Story

As a developer (iOS), I want an `AppleTranslatorModule` TurboModule that wraps Apple Translation Framework, so that on-device translation is available from JavaScript using iOS Neural Engine.

## Acceptance Criteria

1. **Given** iOS 17.4+, **When** JS calls `AppleTranslator.translate("Hello world", "en", "vi")`, **Then** Vietnamese text returned within 500ms.
2. **Given** language packs installed, **When** translating EN/JA/KO/ZH→VI, **Then** all 4 pairs produce Vietnamese output.
3. **Given** language pack NOT installed, **When** first translation requested, **Then** iOS auto-prompts download (~50MB). After download, works offline forever.
4. **Given** inference running, **Then** all translation runs on Neural Engine background thread — UI never blocked.

## Tasks

- [ ] Create `ios/AppleTranslatorModule.swift` — TurboModule wrapping `TranslationSession`
- [ ] Implement `initialize()` — check LanguageAvailability for all 4 pairs
- [ ] Implement `translate(text, srcLang, tgtLang)` — create/reuse TranslationSession per pair
- [ ] Implement `translateBatch(texts, srcLang, tgtLang)` — batch translation for meeting minutes
- [ ] Implement `isLanguageAvailable(srcLang, tgtLang)` — check pack status
- [ ] Create `ios/AppleTranslatorModule.mm` — ObjC++ bridge for TurboModule registration
- [ ] Handle TranslationSession lifecycle (create, reuse, invalidate)
- [ ] Map app language codes to Apple Locale identifiers (en→en, ja→ja, ko→ko, zh→zh-Hans, vi→vi)
- [ ] Test all 4 pairs: EN→VI, JA→VI, KO→VI, ZH→VI

## Dev Notes

- Apple Translation Framework available iOS 17.4+. On iOS 26+ can create TranslationSession programmatically. On iOS 17.4-18.x may need hidden SwiftUI view host for `.translationTask` modifier.
- Zero model files in iOS bundle — Apple manages translation models entirely
- RAM: ~30-50MB (managed by OS, NOT counted against app budget)
- Privacy: "All translations processed on device" — Apple's documented guarantee
- License: Free for all iOS apps
