import { BASE_API_URL as RN_BASE_API_URL, API_VERSION } from '@env';

export const BASE_API_URL = "http://192.168.1.6:4000";
export const API_VERSION_URL = `/api/${API_VERSION}`;

export const CHAT_SESSION_URL = (
  flowSlug: string | null,
  token: string,
  flowType: string,
) => {
  console.log("Generating CHAT_SESSION_URL with:", `${BASE_API_URL}${API_VERSION_URL}/chat-session/${flowSlug}?token=${token}&flowType=${flowType}`);
  return `${BASE_API_URL}${API_VERSION_URL}/chat-session/${flowSlug}?token=${token}&flowType=${flowType}`;
};

export const API_GOOGLE_LOGIN = `${API_VERSION_URL}/auth/google`;
export const API_REQUEST_PHONE_OTP = `${API_VERSION_URL}/auth/send-otp`;
export const API_VERIFY_OTP = `${API_VERSION_URL}/auth/verify-otp`;
export const CHAT_FLOW_ANSWER = `${API_VERSION_URL}/chat-flow/answer`;
export const RAZORPAY_CREATE_ORDER = `${API_VERSION_URL}/orders/create`;
export const RAZORPAY_VERIFY_ORDER = `${API_VERSION_URL}/orders/verify`;
export const SUBSCRIBE_FREE_PLAN = `${API_VERSION_URL}/subscribe/select-free-plan`;
export const CHATBOT_MESSAGE_URL = `${API_VERSION_URL}/chatbot/message`;

export const RECENT_CHECKIN_DATA = `${API_VERSION_URL}/dashboard/viva-score`;
export const CHEKIN_HISTORY = `${API_VERSION_URL}/user/recommendations-formatted`;
export const USER_DATA = `${API_VERSION_URL}/user`;
export const USER_CONTENTS = `${API_VERSION_URL}/contents`;
export const USER_PRODUCTS = `${API_VERSION_URL}/products`;
export const USER_CONTENT_URL = (articleId: string) => {
  return `${API_VERSION_URL}/contents/${articleId}`;
};
