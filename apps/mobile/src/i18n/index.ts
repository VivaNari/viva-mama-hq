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

/**
 * Map every supported language code to its translation bundle.
 * When adding a new language, import its JSON and add it here.
 */
const translations: Record<string, { translation: object }> = {
  en: { translation: en },
  hi: { translation: hi },
};

// Build i18next `resources` from the supported-languages config so we never
// register a language in the picker that has no translation bundle.
const resources = SUPPORTED_LANGUAGES.reduce<Record<string, { translation: object }>>(
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
