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

  /**
   * Staff-only surface consumed by the admin console (`apps/admin`).
   *
   * Mounted at `/api/v1/admin` in the backend's `app.ts`. Every path except
   * `auth.login` sits behind `adminAuthMiddleware`, which requires a SUPER_ADMIN
   * claim *and* re-checks the role in the database — a patient's token is signed
   * with the same secret and would otherwise pass.
   */
  admin: {
    auth: {
      login: `${v}/admin/auth/login`,
      me: `${v}/admin/auth/me`,
    },

    consultations: `${v}/admin/consultations`,
    /** PATCH — sets the agreed 30-minute start, which unlocks the patient's Join button. */
    confirmConsultationTime: (id: string) => `${v}/admin/consultations/${id}/confirm-time`,
    completeConsultation: (id: string) => `${v}/admin/consultations/${id}/completed`,
    markConsultationUnhandled: (id: string) => `${v}/admin/consultations/${id}/unhandled`,

    /** Moderation queue for reported user-generated content. */
    reports: `${v}/admin/reports`,
    actionReport: (id: string) => `${v}/admin/reports/${id}`,

    organizations: `${v}/admin/organizations`,
    organizationById: (id: string) => `${v}/admin/organizations/${id}`,

    referralPrograms: `${v}/admin/referral-programs`,
    referralProgramById: (id: string) => `${v}/admin/referral-programs/${id}`,
    /** POST only — additive; the validator refuses PATCH on a seat pool. */
    addReferralProgramSeats: (id: string) => `${v}/admin/referral-programs/${id}/seats`,
    referralProgramUsage: (id: string) => `${v}/admin/referral-programs/${id}/usage`,

    referralRedemptions: `${v}/admin/referral-redemptions`,
    retryRedemptionGrant: (id: string) => `${v}/admin/referral-redemptions/${id}/retry-grant`,
    revokeRedemption: (id: string) => `${v}/admin/referral-redemptions/${id}`,
  },
} as const;

export type ApiRoutes = typeof apiRoutes;
