import { API_VERSION, BASE_API_URL as RN_BASE_API_URL } from "@env";
import i18n from "../i18n";

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
  // SSE streams bypass the axios interceptor, so append the active language
  // here to localize the streamed onboarding/guided-chat questions.
  return `${BASE_API_URL}${API_VERSION_URL}/chat-session/${flowSlug}?token=${token}&flowType=${flowType}&lang=${i18n.language}`;
};

// Auth endpoints
export const API_GOOGLE_LOGIN = `${API_VERSION_URL}/auth/google`;
export const API_REQUEST_PHONE_OTP = `${API_VERSION_URL}/auth/send-otp`;
export const API_VERIFY_OTP = `${API_VERSION_URL}/auth/verify-otp`;

// Chat endpoints
export const CHAT_FLOW_ANSWER = `${API_VERSION_URL}/chat-flow/answer`;
export const CHATBOT_MESSAGE_URL = `${API_VERSION_URL}/chatbot/message`;

// Subscription endpoints.
// These replace the payment endpoints below: the checkout route takes a planCode and
// derives the amount server-side, where the legacy /orders/create accepted a
// client-supplied `amount`.
export const SUBSCRIPTION_ME = `${API_VERSION_URL}/subscription/me`;
export const SUBSCRIPTION_PLANS = `${API_VERSION_URL}/subscription/plans`;
export const SUBSCRIPTION_TRIAL_START = `${API_VERSION_URL}/subscription/trial/start`;
export const SUBSCRIPTION_FREE_SELECT = `${API_VERSION_URL}/subscription/free/select`;
export const SUBSCRIPTION_CHECKOUT_CREATE = `${API_VERSION_URL}/subscription/checkout/create`;
export const SUBSCRIPTION_CHECKOUT_VERIFY = `${API_VERSION_URL}/subscription/checkout/verify`;
export const SUBSCRIPTION_CHECKOUT_RECONCILE = `${API_VERSION_URL}/subscription/checkout/reconcile`;
// Google Play rail. No create step pairs with this — the purchase happens inside Play
// and the server first learns of it when the token is posted here.
export const SUBSCRIPTION_PLAY_VERIFY = `${API_VERSION_URL}/subscription/play/verify`;
export const SUBSCRIPTION_CANCEL = `${API_VERSION_URL}/subscription/cancel`;

/**
 * Replaces `/user/map-expert-referral`, which the ReferralCode screen used to call with
 * the path — and the API version — hardcoded inline.
 */
export const REFERRAL_REDEEM = `${API_VERSION_URL}/referral/redeem`;

// Analytics
export const ANALYTICS_EVENTS = `${API_VERSION_URL}/analytics/events`;

// book consultation
export const RAZORPAY_BOOK_CONSULTATION_CREATE_ORDER = `${API_VERSION_URL}/consultation-orders/create`;
export const RAZORPAY_BOOK_CONSULTATION_VERIFY_ORDER = `${API_VERSION_URL}/consultation-orders/verify`;
// Books an expert with a subscription credit — no payment sheet, no amount.
export const BOOK_CONSULTATION_WITH_CREDIT = `${API_VERSION_URL}/consultations/book-with-credit`;

// Dashboard endpoints
export const RECENT_CHECKIN_DATA = `${API_VERSION_URL}/dashboard/viva-score`;
export const CHEKIN_HISTORY = `${API_VERSION_URL}/user/recommendations-formatted`;
// Hides the red-flag alert raised by a check-in. Scoped to that week's check-in:
// a later check-in raising a new concern shows its own alert.
export const DISMISS_EMERGENCY_ALERT = (id: string) =>
  `${API_VERSION_URL}/dashboard/emergency-alert/${id}/dismiss`;

// User endpoints
export const USER_DATA = `${API_VERSION_URL}/user`;
export const USER_CONTENTS = `${API_VERSION_URL}/contents`;
export const EXPERTS = `${API_VERSION_URL}/experts`;
export const USER_PRODUCTS = `${API_VERSION_URL}/products`;
export const USER_REQUEST_CALLBACK = `${API_VERSION_URL}/callback-request`;
export const USER_ACTIVE_CONSULTATIONS = `${API_VERSION_URL}/pending-consultations`;
// The whole booking history, stage-tagged for the Upcoming/Ongoing/Past tabs.
export const USER_CONSULTATION_HISTORY = `${API_VERSION_URL}/my-consultations`;
export const API_UPDATE_FCM_TOKEN = `${API_VERSION_URL}/user/update-fcm-token`;
export const SUBMIT_CONSULTATION_REVIEW = `${API_VERSION_URL}/consultation-review`;
// Names the consultant on the rating screen — a CONSULTATION_COMPLETED push carries
// only the consultation id, so the person being rated has to be looked up.
export const CONSULTATION_REVIEW_CONTEXT = (consultationId: string): string =>
  `${API_VERSION_URL}/consultations/${consultationId}/review-context`;
export const API_UPDATE_USER_DATA = `${API_VERSION_URL}/user/update-user-data`;
// Irreversible. Takes no id — the server deletes whoever the bearer token belongs to.
export const API_DELETE_ACCOUNT = `${API_VERSION_URL}/user/me`;

// Flow definitions (onboarding / check-in question catalog)
export const FLOW_DEFINITION_URL = (slug: string): string =>
  `${API_VERSION_URL}/flow-definition/${slug}`;

// Bookmark endpoints
export const ADD_AI_MESSAGE_BOOKMARK = `${API_VERSION_URL}/ai-message-bookmarks`;
export const GET_AI_MESSAGE_BOOKMARKS = `${API_VERSION_URL}/ai-message-bookmarks`;

// Play's AI-Generated Content policy requires a way to report offensive model output
// without leaving the app. Acts on the caller's token; the server refuses any message
// that is not theirs.
export const API_AI_MESSAGE_REPORT = `${API_VERSION_URL}/ai-message-reports`;

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
export const API_VIVA_CLUB_POST_DETAILS = (id: string) =>
  `${VIVA_CLUB_BASE}/posts/${id}`;
export const API_VIVA_CLUB_ADD_COMMENT = (id: string) =>
  `${VIVA_CLUB_BASE}/posts/${id}/comments`;
export const API_VIVA_CLUB_TOGGLE_LIKE = (id: string) =>
  `${VIVA_CLUB_BASE}/posts/${id}/like`;

// Moderation — required by Play's UGC policy: report content, block users, and remove
// your own posts. All act on the caller's token; none take an actor id.
export const API_VIVA_CLUB_REPORT = `${VIVA_CLUB_BASE}/reports`;
export const API_VIVA_CLUB_DELETE_POST = (id: string) =>
  `${VIVA_CLUB_BASE}/posts/${id}`;
export const API_VIVA_CLUB_DELETE_COMMENT = (
  postId: string,
  commentId: string,
) => `${VIVA_CLUB_BASE}/posts/${postId}/comments/${commentId}`;
export const API_VIVA_CLUB_BLOCK_USER = (userId: string) =>
  `${VIVA_CLUB_BASE}/block/${userId}`;
export const API_VIVA_CLUB_GUIDELINES_STATUS = `${VIVA_CLUB_BASE}/guidelines/status`;
export const API_VIVA_CLUB_GUIDELINES_ACCEPT = `${VIVA_CLUB_BASE}/guidelines/accept`;
