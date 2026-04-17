/**
 * Common Types
 *
 * Base types used across the application.
 * These must be defined first to avoid circular dependency issues.
 */

export type SessionId = string;
export type UtteranceId = string;
export type SourceLanguage = 'en' | 'ja' | 'ko' | 'zh';

/**
 * Target translation language.
 * Expandable: add 'zh', 'ko', 'ja' as native translation models are validated.
 * Default is Vietnamese ('vi').
 *
 * @note When adding languages:
 * 1. Add to this union type
 * 2. Update TARGET_LANGUAGE_OPTIONS in settingsStore
 * 3. Update SettingsScreen language selector UI
 */
export type TargetLanguage = 'en' | 'vi' | 'zh' | 'ko' | 'ja';

// ============================================================================
// Meeting Session State Types
// ============================================================================

export type MeetingCaptureStatus =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'stopped';


