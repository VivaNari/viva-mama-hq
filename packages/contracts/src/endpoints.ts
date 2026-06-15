/**
 * Canonical VivaMama API endpoint registry.
 *
 * This is the single source of truth for REST/SSE paths shared by the backend
 * (route definitions), the mobile app (API client), and the chatbot (backend
 * tool calls). Paths are returned **relative** to the host so each consumer can
 * supply its own base URL from configuration — never hard-code environment URLs.
 *
 * @example
 *   import { apiRoutes, apiVersionPath } from '@vivamama/contracts';
 *   const url = `${process.env.BASE_API_URL}${apiRoutes.auth.googleLogin}`;
 */

export const API_VERSION = 'v1' as const;

/** Returns the version prefix, e.g. `/api/v1`. */
export const apiVersionPath = (version: string = API_VERSION): string => `/api/${version}`;

const v = apiVersionPath();

export const apiRoutes = {
  health: '/health',

  auth: {
    googleLogin: `${v}/auth/google`,
    requestPhoneOtp: `${v}/auth/send-otp`,
    verifyOtp: `${v}/auth/verify-otp`,
  },

  chat: {
    guidedFlowStart: `${v}/chat/checkin/start`,
    guidedFlowAnswer: `${v}/chat/checkin/answer`,
    flowAnswer: `${v}/chat-flow/answer`,
    weeklyCheckinAnswer: `${v}/weekly-checkin/answer`,
    chatbotMessage: `${v}/chatbot/message`,
    /** SSE stream. Token is passed as a query param because EventSource cannot set headers. */
    session: (flowSlug: string, flowType: string) =>
      `${v}/chat-session/${flowSlug}?flowType=${encodeURIComponent(flowType)}`,
    weeklyCheckinStream: (week: number, flowSlug: string) =>
      `${v}/weekly-checkin/stream?week=${week}&flowSlug=${encodeURIComponent(flowSlug)}`,
  },

  payments: {
    createOrder: `${v}/orders/create`,
    verifyOrder: `${v}/orders/verify`,
    selectFreePlan: `${v}/subscribe/select-free-plan`,
    consultationCreateOrder: `${v}/consultation-orders/create`,
    consultationVerifyOrder: `${v}/consultation-orders/verify`,
  },

  dashboard: {
    vivaScore: `${v}/dashboard/viva-score`,
    recommendationsFormatted: `${v}/user/recommendations-formatted`,
  },

  user: {
    profile: `${v}/user`,
    updateUserData: `${v}/user/update-user-data`,
    updateFcmToken: `${v}/user/update-fcm-token`,
    moodLogs: `${v}/mood-logs`,
    requestCallback: `${v}/callback-request`,
    pendingConsultations: `${v}/pending-consultations`,
    submitConsultationReview: `${v}/consultation-review`,
    createSupport: `${v}/support`,
  },

  catalog: {
    contents: `${v}/contents`,
    contentById: (articleId: string) => `${v}/contents/${articleId}`,
    products: `${v}/products`,
    productById: (productId: string) => `${v}/products/${productId}`,
    experts: `${v}/experts`,
    expertById: (expertId: string) => `${v}/expert/${expertId}`,
  },

  bookmarks: {
    aiMessages: `${v}/ai-message-bookmarks`,
  },

  vivaClub: {
    posts: `${v}/viva-club/posts`,
    postById: (id: string) => `${v}/viva-club/posts/${id}`,
    comments: (id: string) => `${v}/viva-club/posts/${id}/comments`,
    toggleLike: (id: string) => `${v}/viva-club/posts/${id}/like`,
  },
} as const;

export type ApiRoutes = typeof apiRoutes;
