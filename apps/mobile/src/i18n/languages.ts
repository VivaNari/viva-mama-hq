/**
 * Single source of truth for app languages.
 *
 * To add a new language later:
 *   1. Create `src/i18n/locales/<code>.json` with the same keys as en.json.
 *   2. Add one entry to SUPPORTED_LANGUAGES below.
 *   3. Register it in `src/i18n/index.ts` resources (one line).
 * The first-login popup and the profile language menu read from this list
 * automatically, so no other UI changes are required.
 */
export interface AppLanguage {
  code: string;
  /** English name, e.g. for accessibility / fallback. */
  label: string;
  /** Name shown in the language's own script, e.g. "हिन्दी". */
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: AppLanguage[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
];

export const DEFAULT_LANGUAGE = 'en';

/** AsyncStorage key. Presence of this key = user has made an explicit choice. */
export const LANGUAGE_STORAGE_KEY = 'appLanguage';
