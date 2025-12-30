import { API_VERSION } from '@env';

// Use environment variable in production, fallback for development
export const BASE_API_URL = __DEV__ 
  ? 'http://192.168.1.7:4000' 
  : process.env.BASE_API_URL || 'https://api.vivamama.com';

export const API_VERSION_URL = `/api/${API_VERSION}`;

/**
 * Generates the SSE chat session URL
 * Note: Token is passed as query param for SSE authentication
 */
export const CHAT_SESSION_URL = (
  flowSlug: string | null,
  token: string,
  flowType: string,
): string => {
  // Don't log tokens in production
  if (__DEV__) {
    console.log('[Endpoints] Generating chat session URL for flow:', flowSlug);
  }
  return `${BASE_API_URL}${API_VERSION_URL}/chat-session/${flowSlug}?token=${token}&flowType=${flowType}`;
};

export const CHECKIN_SESSION_URL = (
  token: string,
  week: number,
  flowSlug: string,
): string => {
  // Don't log tokens in production
  if (__DEV__) {
    console.log('[Endpoints] Generating chat session URL for weekly-checkin');
  }
  return `${BASE_API_URL}${API_VERSION_URL}/weekly-checkin/stream?token=${token}&week=${week}&flowSlug=${flowSlug}`;
};

// Auth endpoints
export const API_GOOGLE_LOGIN = `${API_VERSION_URL}/auth/google`;
export const API_REQUEST_PHONE_OTP = `${API_VERSION_URL}/auth/send-otp`;
export const API_VERIFY_OTP = `${API_VERSION_URL}/auth/verify-otp`;

// Chat endpoints
export const CHAT_FLOW_ANSWER = `${API_VERSION_URL}/chat-flow/answer`;
export const WEEKLY_CHECKIN_ANSWER = `${API_VERSION_URL}/weekly-checkin/answer`;
export const CHATBOT_MESSAGE_URL = `${API_VERSION_URL}/chatbot/message`;

// Payment endpoints
export const RAZORPAY_CREATE_ORDER = `${API_VERSION_URL}/orders/create`;
export const RAZORPAY_VERIFY_ORDER = `${API_VERSION_URL}/orders/verify`;
export const SUBSCRIBE_FREE_PLAN = `${API_VERSION_URL}/subscribe/select-free-plan`;

// Dashboard endpoints
export const RECENT_CHECKIN_DATA = `${API_VERSION_URL}/dashboard/viva-score`;
export const CHEKIN_HISTORY = `${API_VERSION_URL}/user/recommendations-formatted`;

// User endpoints
export const USER_DATA = `${API_VERSION_URL}/user`;
export const USER_CONTENTS = `${API_VERSION_URL}/contents`;
export const USER_PRODUCTS = `${API_VERSION_URL}/products`;

export const USER_CONTENT_URL = (articleId: string): string => {
  return `${API_VERSION_URL}/contents/${articleId}`;
};