import { GOOGLE_CLIENT_ID } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import React, { createContext, useContext, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import apiClientInterceptor from '../api/apiClientInterceptor';
import { API_GOOGLE_LOGIN, API_REQUEST_PHONE_OTP, API_UPDATE_FCM_TOKEN, API_VERIFY_OTP } from '../constants/endpoints';
import { AuthContextType, AuthProviderProps, AuthResponse, OnboardingStatus } from '../types/authContext.types';
import { decodeToken } from '../utils/decodeJWTToken';
import { getFCMToken } from '../utils/getFCMToken';
import { syncUserData } from '../utils/syncUserData';
import { chatDB } from '../db/sqlite';
import { getMessaging } from '@react-native-firebase/messaging';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>({
    is_questionnaire_completed: false,
    is_subscription_completed: false,
  });
  const [FCMToken, setFCMToken] = useState<string | null>(null);

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
      }

      // Parse onboarding status
      if (storedOnboardingStatus) {
        const parsedStatus = JSON.parse(storedOnboardingStatus);
        setOnboardingStatus(parsedStatus);
      }
    } catch (e) {
      console.error('[AUTHCONTEXT] Failed to load token and onboarding data:', e);
    }
    setUserToken(token);
    setIsLoading(false);
  };

  const signInWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut(); // Ensure fresh sign-in each time

      const data = await GoogleSignin.signIn() as { data: { idToken: string } };
      console.log("[AUTHCONTEXT] Google Sign-In Data:", data.data.idToken);

      const { data: response } = await apiClientInterceptor().post(API_GOOGLE_LOGIN, {
        idToken: data.data.idToken,
        FCM_token: FCMToken,
      }, {
        headers: { 'Content-Type': 'application/json' },
      });

      console.log("idToken & FCM_token", {
        idToken: data.data.idToken,
        FCM_token: FCMToken,
      })
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
      const decodedUserId = decodeToken(token);
      setUserId(decodedUserId);

    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log("[AUTHCONTEXT] User cancelled Google Sign-in");
        return;
      }

      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response.data.message || 'An error occurred.',
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
      return data;
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response.data.message || 'An error occurred.',
        position: 'top'
      });
      console.error('[AUTHCONTEXT] Request OTP Error:', error);
      throw error;
    }
  };

  const verifyPhoneOTP = async (phone: string, otp: string, verification_key: string) => {
    try {
      const { data, status } = await apiClientInterceptor().post(`${API_VERIFY_OTP}`, {
        mobile_number: phone,
        country_code: '+91',
        otp,
        verification_key,
        FCM_token: FCMToken
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
        const decodedUserId = decodeToken(token);
        setUserId(decodedUserId);

        setUserToken(token);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: data.message,
          position: 'bottom'
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response.data.message || 'An error occurred.',
        position: 'bottom'
      });
      console.error('[AUTHCONTEXT] Verify OTP Error:', error);
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
    } catch (e) {
      console.error('[AUTHCONTEXT] Failed to update questionnaire status:', e);
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
    } catch (e) {
      console.error('[AUTHCONTEXT] Failed to update subscription status:', e);
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
    } catch (e) {
      console.error('[AUTHCONTEXT] Failed to complete onboarding:', e);
    }
  };

  const signOut = async () => {
    try {
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
    }
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
    onboardingStatus,
    isFullyOnboarded,
    completeQuestionnaire,
    completeSubscription,
    completeOnboarding,
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