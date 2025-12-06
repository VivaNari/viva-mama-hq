import { BASE_API_URL as RN_BASE_API_URL, API_VERSION } from '@env';

export const BASE_API_URL = RN_BASE_API_URL;
export const API_VERSION_URL = `/api/${API_VERSION}`;

export const CHAT_SESSION_URL = (flowSlug: string, token: string) =>
  `${BASE_API_URL}${API_VERSION_URL}/chat-session/${flowSlug}?token=${token}`;

export const API_GOOGLE_LOGIN = `${API_VERSION_URL}/auth/google`;
export const API_REQUEST_PHONE_OTP = `${API_VERSION_URL}/auth/send-otp`;
export const API_VERIFY_OTP = `${API_VERSION_URL}/auth/verify-otp`;
export const CHAT_FLOW_ANSWER = `${API_VERSION_URL}/chat-flow/answer`;
export const RAZORPAY_CREATE_ORDER = `${API_VERSION_URL}/orders/create`;
export const RAZORPAY_VERIFY_ORDER = `${API_VERSION_URL}/orders/verify`;
export const SUBSCRIBE_FREE_PLAN = `${API_VERSION_URL}/subscribe/select-free-plan`;
