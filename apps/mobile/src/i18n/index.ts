import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
} from './languages';

import en from './locales/en.json';
import hi from './locales/hi.json';
import journeyEn from './locales/journey/en.json';
import journeyHi from './locales/journey/hi.json';

/**
 * Map every supported language code to its translation bundle.
 * When adding a new language, import its JSON and add it here.
 *
 * `journeyContent` is the week-by-week Journey content, generated from the content workbook
 * and kept out of the UI strings. A missing Hindi entry falls back to English.
 */
type LanguageBundle = { translation: object; journeyContent: object };

const translations: Record<string, LanguageBundle> = {
  en: { translation: en, journeyContent: journeyEn },
  hi: { translation: hi, journeyContent: journeyHi },
};

// Build i18next `resources` from the supported-languages config so we never
// register a language in the picker that has no translation bundle.
const resources = SUPPORTED_LANGUAGES.reduce<Record<string, LanguageBundle>>(
  (acc, { code }) => {
    if (translations[code]) {
      acc[code] = translations[code];
    }
    return acc;
  },
  {},
);

i18n.use(initReactI18next).init({
  resources,
  ns: ['translation', 'journeyContent'],
  defaultNS: 'translation',
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE, // missing Hindi key -> show English
  compatibilityJSON: 'v4',
  interpolation: { escapeValue: false }, // React already escapes
});

/**
 * Restore the user's saved language on startup. Runs once at import time.
 * If nothing is stored, we keep the default and the first-login popup will
 * prompt the user to choose.
 */
AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
  .then((savedLang: string | null) => {
    if (savedLang && savedLang !== i18n.language && resources[savedLang]) {
      i18n.changeLanguage(savedLang);
    }
  })
  .catch((err: unknown) => console.error('[i18n] Failed to restore saved language:', err));

export default i18n;
