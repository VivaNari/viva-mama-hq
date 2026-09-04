import { GOOGLE_CLIENT_ID } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import React, { createContext, useContext, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import apiClientInterceptor from '../api/apiClientInterceptor';
import { setUnauthorizedHandler } from '../api/authEventHandler';
import { setAuthToken } from '../api/authToken';
import { deleteAccount as deleteAccountApi } from '../api/deleteAccount';
import { LANGUAGE_STORAGE_KEY } from '../i18n/languages';
import { CHAT_COUNTER_STORAGE_KEY } from './CounterContext';
import { API_GOOGLE_LOGIN, API_REQUEST_PHONE_OTP, API_UPDATE_FCM_TOKEN, API_VERIFY_OTP } from '../constants/endpoints';
import { AuthContextType, AuthProviderProps, AuthResponse, OnboardingStatus, PendingRedirect } from '../types/authContext.types';
import { decodeToken } from '../utils/decodeJWTToken';
import { getFCMToken } from '../utils/getFCMToken';
import { ensureNotificationPermission } from '../utils/notificationPermission';
import { syncUserData } from '../utils/syncUserData';
import { chatDB } from '../db/sqlite';
import { getMessaging } from '@react-native-firebase/messaging';
import {
  AnalyticsEvent,
  AuthMethod,
  clearIdentity,
  identify,
  recordError,
  resolveOnboardingStage,
  setUserProps,
  track,
  UserProperty,
} from '../analytics';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const CURRENT_VERSIONS = {
  PRIVACY_POLICY: "1.0.0",
  TERMS_OF_USE: "1.0.0",
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>({
    is_questionnaire_completed: false,
    is_subscription_completed: false,
  });
  const [FCMToken, setFCMToken] = useState<string | null>(null);
  // One-shot navigation intent honoured after the onboarding->app stack switch
  // (e.g. routing a bereaved user straight to expert/AI support).
  const [pendingRedirect, setPendingRedirect] = useState<PendingRedirect>(null);

  // Refresh FCM token handler
  useEffect(() => {
    const unsubscribe = getMessaging().onTokenRefresh(async (newToken) => {
      console.log('[FCM] Token refreshed:', newToken);

      // Update local state
      setFCMToken(newToken);

      // If user is logged in, sync with backend
      if (userToken) {
        try {
          await apiClientInterceptor().put(API_UPDATE_FCM_TOKEN, {
            FCM_token: newToken
          });
          console.log('[FCM] Token updated on backend');
        } catch (err) {
          console.error('[FCM] Failed to update token', err);
        }
      }
    });

    return unsubscribe;
  }, [userToken]);

  useEffect(() => {
    if (!userToken || !FCMToken) return;

    console.log('[FCM] Syncing token to backend:', FCMToken, "\n");
    (async function () {
      try {
        const resp = await apiClientInterceptor().put(API_UPDATE_FCM_TOKEN, {
          FCM_token: FCMToken
        });
        console.log("update fcm token resp is", resp)
        console.log('[FCM] Token updated on backend');
      } catch (err) {
        console.error('[FCM] Failed to update token', err);
      }
    })();

  }, [userToken, FCMToken]);

  useEffect(() => {
    GoogleSignin.configure({ webClientId: GOOGLE_CLIENT_ID });
    getFCMTokenFunc();
    checkTokenAndOnboarding();
  }, []);

  // Ask for notification permission after every login (and on app start with a
  // restored session) whenever notifications are still off. On iOS the FCM token
  // is only usable once permission is granted, so refresh it after a grant.
  useEffect(() => {
    if (!userToken) return;

    (async () => {
      const granted = await ensureNotificationPermission();
      setUserProps({
        [UserProperty.NOTIFICATIONS_ENABLED]: String(Boolean(granted)),
      });
      if (granted) {
        await getFCMTokenFunc();
      }
    })();
  }, [userToken]);

  // Auto-logout when any API call returns 401 (e.g. expired JWT).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      Toast.show({
        type: 'error',
        text1: 'Session expired',
        text2: 'Please log in again',
        position: 'bottom',
      });
      signOut();
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    console.log("[AUTHCONTEXT] userToken changed:", userToken);
    console.log("[AUTHCONTEXT] userId:", userId);
    console.log("[AUTHCONTEXT] onboardingStatus:", onboardingStatus);
  }, [userToken, userId, onboardingStatus]);

  const getFCMTokenFunc = async () => {
    const FCM_token = await getFCMToken();
    setFCMToken(FCM_token!);
  };

  const checkTokenAndOnboarding = async () => {
    let token: string | null = null;
    let storedOnboardingStatus: string | null = null;
    try {
      token = await AsyncStorage.getItem('userToken');
      storedOnboardingStatus = await AsyncStorage.getItem('onboardingStatus');

      // Decode token to get userId
      if (token) {
        const decodedUserId = decodeToken(token);
        setUserId(decodedUserId);
        // A restored session is still a signed-in user: attach them to Analytics
        // and Crashlytics here too, or every report from a returning user (the
        // common case) would be anonymous.
        if (decodedUserId) {
          identify(decodedUserId);
        }
      }

      // Parse onboarding status
      if (storedOnboardingStatus) {
        const parsedStatus = JSON.parse(storedOnboardingStatus);
        setOnboardingStatus(parsedStatus);
      }
    } catch (e) {
      console.error('[AUTHCONTEXT] Failed to load token and onboarding data:', e);
      recordError(e, 'AuthContext.checkTokenAndOnboarding');
    }
    setUserToken(token);
    setIsLoading(false);
  };

  /**
   * Attach the user to Analytics/Crashlytics and log the sign-in.
   *
   * Shared by both sign-in paths so Google and phone stay attributed identically.
   *
   * `sign_up` vs `login` is inferred from the onboarding flags: the backend does
   * not return an explicit new-user marker, and a brand new account is the only
   * case where neither step is complete. An `is_new_user` boolean on the login
   * responses would make this exact — worth asking backend for.
   */
  const attributeSignIn = (
    token: string,
    method: AuthMethod,
    status: OnboardingStatus,
  ) => {
    const decodedUserId = decodeToken(token);
    if (decodedUserId) {
      identify(decodedUserId);
    }

    const isNewUser =
      !status?.is_questionnaire_completed && !status?.is_subscription_completed;

    track(isNewUser ? AnalyticsEvent.SIGN_UP : AnalyticsEvent.LOGIN, { method });

    setUserProps({
      [UserProperty.AUTH_METHOD]: method,
      [UserProperty.ONBOARDING_STAGE]: resolveOnboardingStage(
        Boolean(status?.is_questionnaire_completed),
        Boolean(status?.is_subscription_completed),
      ),
    });

    return decodedUserId;
  };

  const signInWithGoogle = async (consents?: any[]) => {
    try {
      console.log("Google Sign in called ")
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut(); // Ensure fresh sign-in each time

      const data = await GoogleSignin.signIn();
      console.log("[AUTHCONTEXT] Google Sign-In raw data:", JSON.stringify(data, null, 2));

      // Handling both old and new API structures just in case
      const idToken = (data as any)?.data?.idToken || (data as any)?.idToken;

      if (!idToken) {
        throw new Error("Google Sign-In failed: No idToken received");
      }

      console.log("[AUTHCONTEXT] idToken found:", idToken);

      const { data: response } = await apiClientInterceptor().post(API_GOOGLE_LOGIN, {
        idToken: idToken,
        FCM_token: FCMToken,
        consents: consents,
      }, {
        headers: { 'Content-Type': 'application/json' },
      });

      const { token, message, is_onboarded }: AuthResponse = response;

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: message,
        position: 'bottom'
      });

      await AsyncStorage.setItem('userToken', token);

      // Sync user data to SQLite BEFORE changing state to ensure Dashboard finds it
      await syncUserData(token);

      setUserToken(token);

      // Set the onboarding status after login
      await setOnboardingStatusAfterLogin(is_onboarded);

      // Decode token and set userId
      setUserId(attributeSignIn(token, 'google', is_onboarded));

    } catch (error: any) {
      console.error("[AUTHCONTEXT] signInWithGoogle Error details:", error);

      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log("[AUTHCONTEXT] User cancelled Google Sign-in");
        // A cancelled sign-in is a user choice, not a failure — logging it as
        // login_failed would make the auth funnel look broken.
        return;
      }

      const errorMessage = error.response?.data?.message || error.message || 'An error occurred during Google Sign-In.';

      track(AnalyticsEvent.LOGIN_FAILED, {
        method: 'google',
        reason: String(error.code ?? error.response?.status ?? 'unknown'),
      });
      recordError(error, 'AuthContext.signInWithGoogle');

      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
        position: 'bottom'
      });
      console.error('[AUTHCONTEXT] Google Sign-In Error:', error);
    }
  };

  const requestPhoneOTP = async (phoneNumber: string) => {
    try {
      const { data } = await apiClientInterceptor().post(API_REQUEST_PHONE_OTP, {
        mobile_number: phoneNumber,
        country_code: '+91',
      }, {
        headers: { 'Content-Type': 'application/json' },
      });
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: data.message,
        position: 'top'
      });
      track(AnalyticsEvent.OTP_REQUESTED);
      return data;
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response.data.message || 'An error occurred.',
        position: 'top'
      });
      console.error('[AUTHCONTEXT] Request OTP Error:', error);
      track(AnalyticsEvent.LOGIN_FAILED, {
        method: 'phone',
        reason: String(error.response?.status ?? 'network'),
      });
      recordError(error, 'AuthContext.requestPhoneOTP');
      throw error;
    }
  };

  const verifyPhoneOTP = async (phone: string, otp: string, verification_key: string, consents?: any[]) => {
    try {
      const { data, status } = await apiClientInterceptor().post(`${API_VERIFY_OTP}`, {
        mobile_number: phone,
        country_code: '+91',
        otp,
        verification_key,
        FCM_token: FCMToken,
        consents: consents,
      }, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (status === 200) {
        const { token, is_onboarded }: AuthResponse = data;
        if (!token) {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'OTP verification failed',
            position: 'bottom'
          });
          track(AnalyticsEvent.OTP_VERIFY_FAILED, { reason: 'no_token' });
          return;
        }

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: data.message,
          position: 'bottom'
        });

        await AsyncStorage.setItem('userToken', token);

        console.log("[AUTHCONTEXT] IS_ONBOARDED after phone login ", is_onboarded);

        // Sync user data to SQLite BEFORE changing state
        await syncUserData(token);

        // Set the onboarding status after login
        await setOnboardingStatusAfterLogin(is_onboarded);

        // Decode token and set userId
        setUserId(attributeSignIn(token, 'phone', is_onboarded));

        setUserToken(token);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: data.message,
          position: 'bottom'
        });
        track(AnalyticsEvent.OTP_VERIFY_FAILED, { reason: `status_${status}` });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response.data.message || 'An error occurred.',
        position: 'bottom'
      });
      console.error('[AUTHCONTEXT] Verify OTP Error:', error);
      track(AnalyticsEvent.OTP_VERIFY_FAILED, {
        reason: String(error.response?.status ?? 'network'),
      });
      recordError(error, 'AuthContext.verifyPhoneOTP');
    }
  };

  const setOnboardingStatusAfterLogin = async (status: OnboardingStatus) => {
    try {
      await AsyncStorage.setItem('onboardingStatus', JSON.stringify(status));
      setOnboardingStatus(status);
    } catch (e) {
      console.error('[AUTHCONTEXT] Failed to set onboarding status:', e);
    }
  };

  /** Keep the GA4 segment in step with the stored onboarding flags. */
  const syncOnboardingStageProperty = (status: OnboardingStatus) => {
    setUserProps({
      [UserProperty.ONBOARDING_STAGE]: resolveOnboardingStage(
        status.is_questionnaire_completed,
        status.is_subscription_completed,
      ),
    });
  };

  const completeQuestionnaire = async () => {
    try {
      if (userToken) {
        await syncUserData(userToken);
      }
      const updatedStatus = {
        ...onboardingStatus,
        is_questionnaire_completed: true,
      };
      await AsyncStorage.setItem('onboardingStatus', JSON.stringify(updatedStatus));
      setOnboardingStatus(updatedStatus);
      track(AnalyticsEvent.TUTORIAL_COMPLETE);
      syncOnboardingStageProperty(updatedStatus);
    } catch (e) {
      console.error('[AUTHCONTEXT] Failed to update questionnaire status:', e);
      recordError(e, 'AuthContext.completeQuestionnaire');
    }
  };

  const completeSubscription = async () => {
    try {
      if (userToken) {
        await syncUserData(userToken);
      }
      const updatedStatus = {
        ...onboardingStatus,
        is_subscription_completed: true,
      };
      await AsyncStorage.setItem('onboardingStatus', JSON.stringify(updatedStatus));
      setOnboardingStatus(updatedStatus);
      syncOnboardingStageProperty(updatedStatus);
    } catch (e) {
      console.error('[AUTHCONTEXT] Failed to update subscription status:', e);
      recordError(e, 'AuthContext.completeSubscription');
    }
  };

  const completeOnboarding = async () => {
    try {
      if (userToken) {
        await syncUserData(userToken);
      }
      const updatedStatus = {
        is_questionnaire_completed: true,
        is_subscription_completed: true,
      };
      await AsyncStorage.setItem('onboardingStatus', JSON.stringify(updatedStatus));
      setOnboardingStatus(updatedStatus);
      syncOnboardingStageProperty(updatedStatus);
    } catch (e) {
      console.error('[AUTHCONTEXT] Failed to complete onboarding:', e);
      recordError(e, 'AuthContext.completeOnboarding');
    }
  };

  const signOut = async () => {
    try {
      // Logged before the identity is cleared, so the event is still attributed
      // to the user who signed out rather than to nobody.
      track(AnalyticsEvent.LOGOUT);
      clearIdentity();

      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('onboardingStatus');
      await chatDB.clearChatHistoryV2();
      setUserToken(null);
      setUserId(null);
      setOnboardingStatus({
        is_questionnaire_completed: false,
        is_subscription_completed: false,
      });
      await GoogleSignin.signOut();
    } catch (error) {
      console.error('[AUTHCONTEXT] Sign Out Error:', error);
      recordError(error, 'AuthContext.signOut');
    }
  };

  /**
   * Permanently deletes the account, then removes every trace of it from the device.
   *
   * The server call goes first and deliberately is NOT caught: if it fails, the account
   * still exists and the user is still signed in, which they can retry. Wiping locally
   * first would sign them out of an account that was never actually deleted — the worst
   * of both outcomes, and invisible to them.
   *
   * Everything after the server confirms is best-effort and individually guarded. Once
   * the account is gone server-side there is nothing to go back to, so a failure to
   * clear one local key must not abort the rest of the teardown and strand the user in
   * a signed-in state pointing at a deleted account.
   */
  const deleteAccount = async () => {
    // Not caught on purpose — see above.
    await deleteAccountApi();

    // Tracked before clearIdentity so the event is still attributed to the account
    // that was deleted rather than to nobody.
    try {
      track(AnalyticsEvent.ACCOUNT_DELETED);
      clearIdentity();
    } catch (error) {
      console.error('[AUTHCONTEXT] Delete: analytics teardown failed:', error);
    }

    // The FCM token is registered against the deleted account server-side, but the
    // device keeps its own copy; deleting it stops this install from being addressable
    // by a push aimed at the old user.
    try {
      await getMessaging().deleteToken();
    } catch (error) {
      console.error('[AUTHCONTEXT] Delete: FCM token removal failed:', error);
    }

    // Only when there is actually a Google session to withdraw. Accounts created with
    // phone OTP never had one, and calling revokeAccess() on those throws
    // SIGN_IN_REQUIRED — a correct answer to a question that should not have been
    // asked, which previously surfaced as an error in the console during an otherwise
    // clean deletion.
    if (GoogleSignin.hasPreviousSignIn()) {
      // revokeAccess, not just signOut: signOut only forgets the local session, leaving
      // VivaMama's grant on the Google account. Deleting the account should withdraw it.
      try {
        await GoogleSignin.revokeAccess();
      } catch (error) {
        // Still guarded: the guard above is a local-state check, so a race or a session
        // invalidated server-side can get past it. SIGN_IN_REQUIRED here just means
        // there was nothing to revoke after all, which is the desired end state.
        if ((error as { code?: string })?.code === statusCodes.SIGN_IN_REQUIRED) {
          console.log('[AUTHCONTEXT] Delete: no Google session to revoke');
        } else {
          console.error('[AUTHCONTEXT] Delete: Google revoke failed:', error);
        }
      }
      try {
        await GoogleSignin.signOut();
      } catch (error) {
        console.error('[AUTHCONTEXT] Delete: Google sign-out failed:', error);
      }
    }

    try {
      await chatDB.wipeAllLocalData();
    } catch (error) {
      console.error('[AUTHCONTEXT] Delete: local database wipe failed:', error);
    }

    // setAuthToken rather than removing the key directly: authToken.ts also holds the
    // token in a module-level variable that the request interceptor reads, and clearing
    // only AsyncStorage would leave that copy in place — every subsequent request would
    // keep presenting the credentials of an account that no longer exists.
    try {
      await setAuthToken(null);
    } catch (error) {
      console.error('[AUTHCONTEXT] Delete: token clear failed:', error);
    }

    // The rest of the keys this app writes. `appLanguage` and `chatCounter` are included
    // because they are user state too — a fresh signup on the same device must not
    // inherit the deleted account's language or its consumed free-message count.
    try {
      await AsyncStorage.multiRemove([
        'userToken',
        'onboardingStatus',
        LANGUAGE_STORAGE_KEY,
        CHAT_COUNTER_STORAGE_KEY,
      ]);
    } catch (error) {
      console.error('[AUTHCONTEXT] Delete: storage clear failed:', error);
    }

    // Last, and outside any try: this is what flips the navigator back to the auth
    // stack. If it were skipped the user would sit inside the app with a dead token.
    setUserToken(null);
    setUserId(null);
    setOnboardingStatus({
      is_questionnaire_completed: false,
      is_subscription_completed: false,
    });
  };

  // Helper to check if user is fully onboarded
  const isFullyOnboarded = () => {
    return onboardingStatus.is_questionnaire_completed &&
      onboardingStatus.is_subscription_completed;
  };

  const value = {
    userToken,
    userId,
    isLoading,
    signInWithGoogle,
    requestPhoneOTP,
    verifyPhoneOTP,
    signOut,
    deleteAccount,
    onboardingStatus,
    isFullyOnboarded,
    completeQuestionnaire,
    completeSubscription,
    completeOnboarding,
    pendingRedirect,
    setPendingRedirect,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};