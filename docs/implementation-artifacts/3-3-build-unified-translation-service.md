# Story 3.3: Build Unified TranslationService Abstraction

Status: ready-for-dev

## Story

As a developer, I want a unified `TranslationService.ts` that abstracts iOS (Apple Translation) and Android (Opus-MT) differences, so that all JS code calls the same API regardless of platform.

## Acceptance Criteria

1. **Given** iOS build, **When** `translationService.translate("Hello", "en")` called, **Then** routes to AppleTranslator.
2. **Given** Android build, **When** same call made, **Then** routes to OpusMtTranslator (handles two-hop internally).
3. **Given** Vietnamese detected (srcLang="vi"), **When** translate called, **Then** returns original text immediately without calling any native module.

## Tasks

- [ ] Create `src/native/NativeAppleTranslator.ts` — iOS TurboModule TypeScript spec
- [ ] Create `src/native/NativeOpusMtTranslator.ts` — Android TurboModule TypeScript spec
- [ ] Create `src/services/TranslationService.ts` — platform branching via `Platform.OS`
- [ ] Implement `translate(text, srcLang, tgtLang='vi')` — single entry point
- [ ] Implement `translateBatch(texts, srcLang, tgtLang='vi')` — for meeting minutes
- [ ] Implement `isAvailable(srcLang, tgtLang)` — check readiness
- [ ] Vietnamese passthrough: return text directly with `source: 'native'`
