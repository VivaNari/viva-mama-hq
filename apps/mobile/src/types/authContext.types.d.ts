import { ReactNode } from 'react';

// export interface AuthContextType {
//   userToken: string | null;
//   userId: string | null;
//   isLoading: boolean;
//   signInWithGoogle: () => Promise<void>;
//   requestPhoneOTP: (phoneNumber: string) => Promise<any>;
//   verifyPhoneOTP: (
//     phone: string,
//     otp: string,
//     verification_key: string,
//   ) => Promise<void>;
//   signOut: () => Promise<void>;
//   completeOnboarding: () => Promise<void>;
//   isOnboarded: boolean | null;
// }

export interface AuthContextType {
  userToken: string | null;
  userId: string | null;
  isLoading: boolean;
  onboardingStatus: OnboardingStatus;
  isFullyOnboarded: () => boolean;
  signInWithGoogle: (consents?: any[]) => Promise<void>;
  /**
   * Permanently deletes the account server-side, then tears down all local state.
   * Irreversible — callers must confirm with the user first. Throws if the server
   * call fails, leaving the session intact so the failure is recoverable.
   */
  deleteAccount: () => Promise<void>;
  requestPhoneOTP: (phoneNumber: string) => Promise<any>;
  verifyPhoneOTP: (
    phone: string,
    otp: string,
    verification_key: string,
    consents?: any[],
  ) => Promise<void>;
  signOut: () => Promise<void>;
  completeQuestionnaire: () => Promise<void>;
  completeSubscription: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  pendingRedirect: PendingRedirect;
  setPendingRedirect: (redirect: PendingRedirect) => void;
}

// One-shot navigation intent consumed after a stack switch (e.g. routing a
// bereaved user to expert/AI support once they enter the main app).
export type PendingRedirect = 'experts' | 'aiChat' | null;

export interface AuthProviderProps {
  children: ReactNode;
}

export interface AuthResponse {
  token: string;
  message: string;
  is_onboarded: OnboardingStatus;
}

export interface OnboardingStatus {
  is_questionnaire_completed: boolean;
  is_subscription_completed: boolean;
}

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  Profile: undefined;
};
