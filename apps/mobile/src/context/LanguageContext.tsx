import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import i18n from '../i18n';
import { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES } from '../i18n/languages';
import {
  AnalyticsEvent,
  recordError,
  setUserProps,
  track,
  UserProperty,
} from '../analytics';
import { updatePreferredLanguage } from '../api/updateuserData';
import { getUserData } from '../api/userData.api';
import { useAuth } from './AuthContext';

interface LanguageContextType {
  /** Current active language code, e.g. "en" | "hi". */
  language: string;
  /** Change + persist the language (local + backend). Updates `t()` instantly. */
  setLanguage: (code: string) => Promise<void>;
  /** True once the user has ever made an explicit choice. Drives the gate. */
  hasSelectedLanguage: boolean;
  /** Avoids flashing the gate before AsyncStorage has been read. */
  isLanguageReady: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const isSupported = (code?: string | null): code is string =>
  !!code && SUPPORTED_LANGUAGES.some(l => l.code === code);

/** Fire-and-forget push of the choice to the backend; never blocks the UI. */
const pushToBackend = (code: string) => {
  updatePreferredLanguage(code).catch((e: unknown) =>
    console.error('[LANGUAGE] Failed to sync language to backend:', e),
  );
};

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const { userToken } = useAuth();
  const [language, setLanguageState] = useState<string>(i18n.language);
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState<boolean>(false);
  const [isLanguageReady, setIsLanguageReady] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved) {
          setHasSelectedLanguage(true);
          setLanguageState(saved);
        }
      } catch (e) {
        console.error('[LANGUAGE] Failed to read saved language:', e);
      } finally {
        setIsLanguageReady(true);
      }
    })();

    // Keep context in sync if language changes elsewhere (e.g. i18n startup restore).
    // The user property is refreshed here too so a restored preference is
    // reflected without waiting for the user to touch the language settings.
    const onChange = (lng: string) => {
      setLanguageState(lng);
      setUserProps({ [UserProperty.APP_LANGUAGE]: lng });
    };
    i18n.on('languageChanged', onChange);
    return () => {
      i18n.off('languageChanged', onChange);
    };
  }, []);

  // Reconcile local choice with the backend once we're logged in:
  //  - local choice exists -> push it so the server matches (local wins for UI).
  //  - no local choice but the server has one (e.g. reinstall) -> adopt it
  //    locally so the mandatory gate doesn't show again.
  useEffect(() => {
    if (!userToken || !isLanguageReady) {
      return;
    }
    (async () => {
      try {
        if (hasSelectedLanguage) {
          pushToBackend(language);
          return;
        }
        const resp = await getUserData();
        const serverLang: string | undefined =
          resp?.data?.preferred_language ?? resp?.preferred_language;
        if (isSupported(serverLang)) {
          await i18n.changeLanguage(serverLang);
          await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, serverLang);
          setLanguageState(serverLang);
          setHasSelectedLanguage(true);
        }
      } catch (e) {
        console.error('[LANGUAGE] Failed to reconcile language on login:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userToken, isLanguageReady]);

  const setLanguage = async (code: string) => {
    // Captured before the state updates, so the first pick at the mandatory
    // language gate is distinguishable from a later change in settings — they
    // are different funnel moments and should not collapse into one event.
    const previous = language;
    const isFirstChoice = !hasSelectedLanguage;

    try {
      await i18n.changeLanguage(code);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
      setLanguageState(code);
      setHasSelectedLanguage(true);
      // Only sync to the backend when authenticated; pre-login choices are
      // reconciled by the login effect above once a token exists.
      if (userToken) {
        pushToBackend(code);
      }

      if (isFirstChoice) {
        track(AnalyticsEvent.LANGUAGE_SELECTED, { language_code: code });
      } else if (previous !== code) {
        track(AnalyticsEvent.LANGUAGE_CHANGED, { from: previous, to: code });
      }
      setUserProps({ [UserProperty.APP_LANGUAGE]: code });
    } catch (e) {
      console.error('[LANGUAGE] Failed to set language:', e);
      recordError(e, 'LanguageContext.setLanguage');
    }
  };

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, hasSelectedLanguage, isLanguageReady }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (ctx === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
};
