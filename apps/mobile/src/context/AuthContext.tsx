import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { AuthContextType, AuthProviderProps, AuthResponse } from '../types/authContext.types';
import { API_GOOGLE_LOGIN, API_REQUEST_PHONE_OTP, API_VERIFY_OTP, BASE_API_URL } from '../constants/urls';
import { GOOGLE_CLIENT_ID } from '@env';
import useApiInterceptor from '../utils/useApiInterceptor';
import Toast from 'react-native-toast-message';
import { getFCMToken } from '../utils/getFCMToken';
import { decodeToken } from '../utils/decodeJWTToken';
import axios from 'axios';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const [FCMToken, setFCMToken] = useState<string | null>(null);

  useEffect(() => {
    GoogleSignin.configure({ webClientId: GOOGLE_CLIENT_ID });
    getFCMTokenFunc();
    checkTokenAndOnboarding();
  }, []);

  useEffect(() => {
    console.log("userToken changed:", userToken);
    console.log("userId:", userId);
  }, [userToken, userId]);

  const getFCMTokenFunc = async () => {
    const FCM_token = await getFCMToken();
    setFCMToken(FCM_token!);
  };

  const checkTokenAndOnboarding = async () => {
    let token: string | null = null;
    let isOnboarded: string | null = null;
    try {
      token = await AsyncStorage.getItem('userToken');
      isOnboarded = await AsyncStorage.getItem('isOnboarded');

      // Decode token to get userId
      if (token) {
        const decodedUserId = decodeToken(token);
        setUserId(decodedUserId);
      }
    } catch (e) {
      console.error('Failed to load token and onboarding data:', e);
    }
    setUserToken(token);
    setIsOnboarded(isOnboarded === 'true');
    setIsLoading(false);
  };

  const signInWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const data = await GoogleSignin.signIn() as { data: { idToken: string } };

      const { data: response } = await useApiInterceptor().post(API_GOOGLE_LOGIN, {
        idToken: data.data.idToken,
        FCM_token: FCMToken,
      }, {
        headers: { 'Content-Type': 'application/json' },
      });
      const { token, message }: AuthResponse = response;

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: message,
        position: 'bottom'
      });

      await AsyncStorage.setItem('userToken', token);
      setUserToken(token);

      // Decode token and set userId
      const decodedUserId = decodeToken(token);
      setUserId(decodedUserId);

    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response.data.message || 'An error occurred.',
        position: 'bottom'
      });
      console.error('Google Sign-In Error:', error);
    }
  };

  const requestPhoneOTP = async (phoneNumber: string) => {
    try {
      const { data } = await useApiInterceptor().post(API_REQUEST_PHONE_OTP, {
        mobile_number: phoneNumber,
        country_code: '+91',
      }, {
        headers: { 'Content-Type': 'application/json' },
      });
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: data.message,
        position: 'bottom'
      });
      return data;
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response.data.message || 'An error occurred.',
        position: 'bottom'
      });
      console.error('Request OTP Error:', error);
      throw error;
    }
  };

  const verifyPhoneOTP = async (phone: string, otp: string, verification_key: string) => {
    try {
      const { data, status } = await useApiInterceptor().post(`${API_VERIFY_OTP}`, {
        mobile_number: phone,
        country_code: '+91',
        otp,
        verification_key,
        FCM_token: FCMToken
      }, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (status === 200) {
        const { token }: AuthResponse = data;
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
        setUserToken(token);

        // Decode token and set userId
        const decodedUserId = decodeToken(token);
        setUserId(decodedUserId);

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
      console.error('Verify OTP Error:', error);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      setUserToken(null);
      setUserId(null); // Clear userId on sign out
      await GoogleSignin.signOut();
    } catch (error) {
      console.error('Sign Out Error:', error);
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('isOnboarded', 'true');
      setIsOnboarded(true);
    } catch (e) {
      console.error('Failed to set onboarding status:', e);
    }
  };

  const value = {
    userToken,
    userId,
    isLoading,
    signInWithGoogle,
    requestPhoneOTP,
    verifyPhoneOTP,
    signOut,
    isOnboarded,
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