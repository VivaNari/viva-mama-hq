import { ReactNode } from 'react';

export interface AuthContextType {
  userToken: string | null;
  userId: string | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  requestPhoneOTP: (phoneNumber: string) => Promise<any>;
  verifyPhoneOTP: (
    phone: string,
    otp: string,
    verification_key: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  isOnboarded: boolean | null;
}

export interface AuthProviderProps {
  children: ReactNode;
}

export interface AuthResponse {
  token: string;
  message: string;
}

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  Profile: undefined;
};
