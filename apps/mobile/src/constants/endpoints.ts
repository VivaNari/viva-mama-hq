import { API_VERSION, BASE_API_URL as RN_BASE_API_URL } from "@env";

// Base URL is read from the environment (see .env.example); it falls back to a
// local backend for development. Do NOT hard-code deployment URLs in source.
export const BASE_API_URL = RN_BASE_API_URL || "http://localhost:4000";

export const API_VERSION_URL = `/api/${API_VERSION}`;
export const GUIDED_FLOW_START = "/api/v1/chat/checkin/start";
export const GUIDED_FLOW_ANSWER = "/api/v1/chat/checkin/answer";
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
    console.log("[Endpoints] Generating chat session URL for flow:", flowSlug);
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
    console.log("[Endpoints] Generating chat session URL for weekly-checkin");
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

// book consultation
export const RAZORPAY_BOOK_CONSULTATION_CREATE_ORDER = `${API_VERSION_URL}/consultation-orders/create`;
export const RAZORPAY_BOOK_CONSULTATION_VERIFY_ORDER = `${API_VERSION_URL}/consultation-orders/verify`;

// Dashboard endpoints
export const RECENT_CHECKIN_DATA = `${API_VERSION_URL}/dashboard/viva-score`;
export const CHEKIN_HISTORY = `${API_VERSION_URL}/user/recommendations-formatted`;

// User endpoints
export const USER_DATA = `${API_VERSION_URL}/user`;
export const USER_CONTENTS = `${API_VERSION_URL}/contents`;
export const EXPERTS = `${API_VERSION_URL}/experts`;
export const USER_PRODUCTS = `${API_VERSION_URL}/products`;
export const USER_REQUEST_CALLBACK = `${API_VERSION_URL}/callback-request`;
export const USER_ACTIVE_CONSULTATIONS = `${API_VERSION_URL}/pending-consultations`;
export const API_UPDATE_FCM_TOKEN = `${API_VERSION_URL}/user/update-fcm-token`;
export const SUBMIT_CONSULTATION_REVIEW = `${API_VERSION_URL}/consultation-review`;
export const API_UPDATE_USER_DATA = `${API_VERSION_URL}/user/update-user-data`;

// Bookmark endpoints
export const ADD_AI_MESSAGE_BOOKMARK = `${API_VERSION_URL}/ai-message-bookmarks`;
export const GET_AI_MESSAGE_BOOKMARKS = `${API_VERSION_URL}/ai-message-bookmarks`;

export const USER_CONTENT_URL = (articleId: string): string => {
  return `${API_VERSION_URL}/contents/${articleId}`;
};
export const USER_PRODUCT_URL = (productId: string): string => {
  return `${API_VERSION_URL}/products/${productId}`;
};
export const USER_EXPERT_URL = (expertId: string): string => {
  return `${API_VERSION_URL}/expert/${expertId}`;
};

//Support Endpoint

export const API_CREATE_SUPPORT = `${API_VERSION_URL}/support`;

// Mood log endpoints
export const API_MOOD_LOGS = `${API_VERSION_URL}/mood-logs`;

// Viva Club Endpoints
const VIVA_CLUB_BASE = `${API_VERSION_URL}/viva-club`;
export const API_VIVA_CLUB_POSTS = `${VIVA_CLUB_BASE}/posts`;
export const API_VIVA_CLUB_CREATE_POST = `${VIVA_CLUB_BASE}/posts`;
export const API_VIVA_CLUB_POST_DETAILS = (id: string) => `${VIVA_CLUB_BASE}/posts/${id}`;
export const API_VIVA_CLUB_ADD_COMMENT = (id: string) => `${VIVA_CLUB_BASE}/posts/${id}/comments`;
export const API_VIVA_CLUB_TOGGLE_LIKE = (id: string) => `${VIVA_CLUB_BASE}/posts/${id}/like`;
