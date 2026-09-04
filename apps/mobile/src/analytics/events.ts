/**
 * Every Firebase Analytics event name the app emits, in one place.
 *
 * Firebase caps a project at 500 distinct event names and a name can never be
 * reclaimed once used, so names live here rather than being typed at call sites.
 * `EventParams` below pins the parameters each one carries; `track()` accepts
 * nothing else, so a typo cannot reach production.
 *
 * Where a GA4 *recommended* name fits (login, sign_up, purchase, view_item,
 * select_content, share, tutorial_*, begin_checkout, view_item_list,
 * select_item) it is used verbatim — Google gives those names dedicated
 * reporting that custom names do not get.
 *
 * NOTE: no parameter here may carry health data or PII. Log the verb, never the
 * value: `mood_log_submitted` with no mood, `viva_score_viewed` with no score.
 * The server already holds the values.
 */
export const AnalyticsEvent = {
  // ---- Auth -------------------------------------------------------------
  LOGIN: 'login',
  SIGN_UP: 'sign_up',
  LOGIN_FAILED: 'login_failed',
  OTP_REQUESTED: 'otp_requested',
  OTP_VERIFY_FAILED: 'otp_verify_failed',
  LOGOUT: 'logout',
  // Fired before the identity is cleared, so it is still attributed to the account
  // being deleted. There is deliberately no property carrying what was erased.
  ACCOUNT_DELETED: 'account_deleted',

  // ---- Onboarding -------------------------------------------------------
  TUTORIAL_BEGIN: 'tutorial_begin',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  // Not emitted: `onboarding_abandoned` needs "left the flow without finishing",
  // which the screen cannot tell apart from backgrounding the app or a normal
  // unmount on completion. Derive abandonment in GA4 instead: users with
  // tutorial_begin and no tutorial_complete, bucketed by the last
  // onboarding_step_completed they reached.
  TUTORIAL_COMPLETE: 'tutorial_complete',
  LANGUAGE_SELECTED: 'language_selected',

  // ---- Subscription -----------------------------------------------------
  VIEW_ITEM_LIST: 'view_item_list',
  SELECT_ITEM: 'select_item',
  BEGIN_CHECKOUT: 'begin_checkout',
  PURCHASE: 'purchase',
  CHECKOUT_FAILED: 'checkout_failed',
  CHECKOUT_RECONCILED: 'checkout_reconciled',
  TRIAL_STARTED: 'trial_started',
  FREE_PLAN_SELECTED: 'free_plan_selected',
  /**
   * Emitted from the MySubscription screen. Which plan and which billing mode was
   * cancelled is what makes churn readable; the date, the amount and anything
   * identifying her are deliberately absent.
   */
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  PAYWALL_SHOWN: 'paywall_shown',
  PAYWALL_CTA_TAPPED: 'paywall_cta_tapped',

  // ---- AI chat ----------------------------------------------------------
  CHAT_OPENED: 'chat_opened',
  CHAT_MESSAGE_SENT: 'chat_message_sent',
  CHAT_RESPONSE_RECEIVED: 'chat_response_received',
  CHAT_STREAM_FAILED: 'chat_stream_failed',
  CHAT_QUOTA_BLOCKED: 'chat_quota_blocked',
  CHAT_FLOW_COMPLETED: 'chat_flow_completed',
  CHAT_BOOKMARK_ADDED: 'chat_bookmark_added',
  CHAT_BOOKMARK_REMOVED: 'chat_bookmark_removed',
  // Why a reply was flagged is what tells us where the model is going wrong. What it
  // said, and what she asked to get it, never leave the device on this event — that
  // pair is the health disclosure the report itself already handles under consent.
  AI_MESSAGE_REPORTED: 'ai_message_reported',
  // Not emitted: `chat_history_cleared`. There is no "clear history" control in
  // the UI — `clearHistory` only runs automatically, to discard a stale flow
  // instance or tidy up after a completed check-in. Logging housekeeping the
  // user never asked for would read as a user action in reports.

  // ---- Consultations ----------------------------------------------------
  EXPERT_LIST_VIEWED: 'expert_list_viewed',
  EXPERT_PROFILE_VIEWED: 'expert_profile_viewed',
  CONSULTATION_BOOKING_STARTED: 'consultation_booking_started',
  CONSULTATION_BOOKED: 'consultation_booked',
  CONSULTATION_BOOKING_FAILED: 'consultation_booking_failed',
  CONSULTATION_JOINED: 'consultation_joined',
  CONSULTATION_RATED: 'consultation_rated',
  // Deliberately absent: `consultation_join_blocked_expired` and
  // `callback_requested`. The expired-join case renders a *disabled* button, so
  // there is no tap to observe and a render-time event would refire on the
  // 30s unlock timer. And a callback request goes through the same credit path
  // as everything else, so it is already `consultation_booked` with
  // consultation_type=care_manager, payment_mode=credit.

  // ---- Content ----------------------------------------------------------
  SELECT_CONTENT: 'select_content',
  ARTICLE_OPENED: 'article_opened',
  ARTICLE_READ_COMPLETED: 'article_read_completed',
  VIDEO_STARTED: 'video_started',
  VIDEO_COMPLETED: 'video_completed',
  SHARE: 'share',
  // Not emitted: `recommendation_opened` and `viva_score_viewed`. The screens
  // behind them (Recommendations, RecommendationDetails, FullReport,
  // CategoryArticles) still render from static files in src/data — they are
  // placeholder UI, not backend-driven, so an event there would measure a mock.
  // The global screen_view already records that a user visited them.

  // ---- Community --------------------------------------------------------
  COMMUNITY_FEED_VIEWED: 'community_feed_viewed',
  COMMUNITY_POST_OPENED: 'community_post_opened',
  COMMUNITY_POST_CREATED: 'community_post_created',
  COMMUNITY_POST_CREATE_FAILED: 'community_post_create_failed',
  // Moderation. The reason a report was filed is useful for spotting where the
  // community is going wrong; what was said is not, and never leaves the device with
  // these events — a report body can quote the abuse or health disclosure verbatim.
  COMMUNITY_CONTENT_REPORTED: 'community_content_reported',
  COMMUNITY_USER_BLOCKED: 'community_user_blocked',
  COMMUNITY_CONTENT_DELETED: 'community_content_deleted',
  COMMUNITY_GUIDELINES_ACCEPTED: 'community_guidelines_accepted',

  // ---- Products ---------------------------------------------------------
  VIEW_ITEM: 'view_item',
  PRODUCT_LINK_OPENED: 'product_link_opened',

  // ---- Health logs (verb only — never the logged value) ------------------
  MOOD_LOG_SUBMITTED: 'mood_log_submitted',
  // Not emitted: FeedingLog has no save handler at all — the screen is local
  // state with nothing behind it, so there is no submission to observe. Add
  // `feeding_log_submitted` when persistence lands.
  VACCINATION_LOG_UPDATED: 'vaccination_log_updated',
  CHECKIN_STARTED: 'checkin_started',
  CHECKIN_COMPLETED: 'checkin_completed',

  // ---- Engagement & profile ---------------------------------------------
  DASHBOARD_REFRESHED: 'dashboard_refreshed',
  DASHBOARD_CARD_TAPPED: 'dashboard_card_tapped',
  NOTIFICATION_OPENED: 'notification_opened',
  REFERRAL_CODE_SHARED: 'referral_code_shared',
  SUPPORT_REQUEST_SUBMITTED: 'support_request_submitted',
  PROFILE_UPDATED: 'profile_updated',
  // Not emitted: a partner joining happens on *their* device. This one can only
  // see the invite code being copied, which is `referral_code_shared`.
  LANGUAGE_CHANGED: 'language_changed',
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

/** How the user authenticated. */
export type AuthMethod = 'google' | 'phone';

/** Which of the two bookable session kinds. */
export type ConsultationType = 'expert' | 'care_manager';

/** Whether a booking spent a credit or went through Razorpay. */
export type PaymentMode = 'credit' | 'payment';

/** How the app was in the foreground when a push was acted on. */
export type NotificationSource = 'cold' | 'background' | 'foreground';

/**
 * Coarse buckets instead of raw numbers.
 *
 * A message length or a latency is not sensitive on its own, but bucketing keeps
 * cardinality low (GA4 reports get unusable with high-cardinality params) and
 * removes any chance of a value being fine-grained enough to identify a session.
 */
export type SizeBucket = 'xs' | 's' | 'm' | 'l' | 'xl';

/** GA4's `items` array shape, as much of it as we populate. */
export interface AnalyticsItem {
  item_id: string;
  item_name?: string;
  price?: number;
  quantity?: number;
}

/**
 * Parameters per event. An event absent from this map takes no parameters.
 *
 * Keep every value a string, number or boolean — GA4 drops nested objects, and
 * the one exception (`items`) is a shape GA4 understands natively.
 */
export interface EventParams {
  [AnalyticsEvent.LOGIN]: { method: AuthMethod };
  [AnalyticsEvent.SIGN_UP]: { method: AuthMethod };
  [AnalyticsEvent.LOGIN_FAILED]: { method: AuthMethod; reason: string };
  [AnalyticsEvent.OTP_VERIFY_FAILED]: { reason: string };

  // No `step_total`: the onboarding flow is server-driven and branching, so the
  // client is handed one question at a time and never learns how many remain.
  // Completion rate comes from tutorial_begin vs tutorial_complete instead.
  [AnalyticsEvent.ONBOARDING_STEP_COMPLETED]: { step_index: number };
  [AnalyticsEvent.LANGUAGE_SELECTED]: { language_code: string };

  [AnalyticsEvent.VIEW_ITEM_LIST]: { item_list_name: string };
  [AnalyticsEvent.SELECT_ITEM]: { item_id: string; item_list_name?: string };
  [AnalyticsEvent.BEGIN_CHECKOUT]: {
    item_id: string;
    value: number;
    currency: string;
  };
  [AnalyticsEvent.PURCHASE]: {
    transaction_id: string;
    value: number;
    currency: string;
    items: AnalyticsItem[];
  };
  [AnalyticsEvent.CHECKOUT_FAILED]: {
    /**
     * A closed union rather than a free string: this drives the checkout funnel, and one
     * mistyped value silently splits a bucket that is then under-reported forever.
     *
     * The `play_*` values mirror PlayBillingErrorCode. `play_cancelled` is deliberately
     * distinct from `razorpay_cancelled` — the two rails have different drop-off shapes,
     * and merging them would hide a Play sheet that users abandon.
     */
    reason:
      | 'razorpay_cancelled'
      | 'verify_failed'
      | 'network'
      | 'unknown'
      | 'play_cancelled'
      | 'play_failed'
      // Not a lost sale: Google holds the money while UPI confirms, and the reconcile
      // sweep activates it on the next foreground. Bucketed separately so it cannot be
      // read as drop-off — on this market it is a routine step, not a failure.
      | 'play_pending'
      | 'USER_CANCELLED'
      | 'UNAVAILABLE'
      | 'PRODUCT_NOT_FOUND'
      | 'NO_OFFER'
      | 'PURCHASE_FAILED';
    item_id?: string;
  };
  [AnalyticsEvent.CHECKOUT_RECONCILED]: { activated: boolean };
  [AnalyticsEvent.SUBSCRIPTION_CANCELLED]: {
    plan_code: string;
    billing_mode: string;
  };
  [AnalyticsEvent.PAYWALL_SHOWN]: { capability?: string; denial_code?: string };
  [AnalyticsEvent.PAYWALL_CTA_TAPPED]: { capability?: string; cta: string };

  [AnalyticsEvent.CHAT_OPENED]: { flow_slug?: string; flow_type?: string };
  [AnalyticsEvent.CHAT_MESSAGE_SENT]: {
    flow_type?: string;
    length_bucket: SizeBucket;
  };
  [AnalyticsEvent.CHAT_RESPONSE_RECEIVED]: {
    flow_type?: string;
    latency_bucket: SizeBucket;
  };
  [AnalyticsEvent.CHAT_STREAM_FAILED]: { reason: string; flow_type?: string };
  [AnalyticsEvent.CHAT_FLOW_COMPLETED]: { flow_type?: string };

  [AnalyticsEvent.EXPERT_PROFILE_VIEWED]: { expert_id: string };
  [AnalyticsEvent.CONSULTATION_BOOKING_STARTED]: {
    consultation_type: ConsultationType;
    payment_mode: PaymentMode;
  };
  [AnalyticsEvent.CONSULTATION_BOOKED]: {
    consultation_type: ConsultationType;
    payment_mode: PaymentMode;
  };
  [AnalyticsEvent.CONSULTATION_BOOKING_FAILED]: {
    consultation_type: ConsultationType;
    reason: string;
  };
  [AnalyticsEvent.CONSULTATION_JOINED]: {
    consultation_type: ConsultationType;
  };
  [AnalyticsEvent.CONSULTATION_RATED]: { rating: number };

  [AnalyticsEvent.SELECT_CONTENT]: { content_type: string; item_id: string };
  // No `category_id`: IUserContent.category is an *array* of category enums, and
  // flattening it into one dimension value would yield unusable strings like
  // "PREGNANT,POSTPARTUM". Segment by category server-side instead.
  [AnalyticsEvent.ARTICLE_OPENED]: { article_id: string };
  [AnalyticsEvent.ARTICLE_READ_COMPLETED]: {
    article_id: string;
    dwell_bucket: SizeBucket;
  };
  [AnalyticsEvent.VIDEO_STARTED]: { content_id: string };
  [AnalyticsEvent.VIDEO_COMPLETED]: { content_id: string };
  [AnalyticsEvent.SHARE]: {
    content_type: string;
    item_id: string;
    method?: string;
  };

  [AnalyticsEvent.COMMUNITY_POST_OPENED]: { post_id: string };
  [AnalyticsEvent.COMMUNITY_POST_CREATE_FAILED]: { reason: string };
  [AnalyticsEvent.COMMUNITY_CONTENT_REPORTED]: {
    target_type: string;
    reason: string;
  };
  [AnalyticsEvent.AI_MESSAGE_REPORTED]: { reason: string };
  [AnalyticsEvent.COMMUNITY_CONTENT_DELETED]: { target_type: string };

  [AnalyticsEvent.VIEW_ITEM]: { item_id: string; item_name?: string };
  [AnalyticsEvent.PRODUCT_LINK_OPENED]: { item_id: string };

  [AnalyticsEvent.CHECKIN_STARTED]: { flow_slug?: string };
  [AnalyticsEvent.CHECKIN_COMPLETED]: { flow_slug?: string };

  [AnalyticsEvent.DASHBOARD_CARD_TAPPED]: { card_id: string };
  [AnalyticsEvent.NOTIFICATION_OPENED]: {
    notification_type: string;
    source: NotificationSource;
  };
  [AnalyticsEvent.REFERRAL_CODE_SHARED]: { method?: string };
  [AnalyticsEvent.LANGUAGE_CHANGED]: { from: string; to: string };
}

/**
 * Map the backend's `ConsultationTypeEnum` onto the analytics value.
 *
 * Takes a plain string rather than the enum so this module stays free of domain
 * imports. `expert` is the default because it is the broader of the two flows —
 * an unrecognised value is far more likely to be a new expert-like type than a
 * counsellor one.
 */
export const toAnalyticsConsultationType = (
  type: string | null | undefined,
): ConsultationType => (type === 'CARE_MANAGER' ? 'care_manager' : 'expert');

/**
 * Bucket a raw count into a coarse band.
 *
 * Thresholds are deliberately generic — the same helper buckets characters and
 * milliseconds, since in both cases what we want back is "roughly how big", not
 * a number that would blow up report cardinality.
 */
export const toBucket = (
  value: number,
  thresholds: [number, number, number, number],
): SizeBucket => {
  if (value <= thresholds[0]) return 'xs';
  if (value <= thresholds[1]) return 's';
  if (value <= thresholds[2]) return 'm';
  if (value <= thresholds[3]) return 'l';
  return 'xl';
};

/** Message length in characters. */
export const lengthBucket = (chars: number): SizeBucket =>
  toBucket(chars, [20, 60, 150, 400]);

/** Elapsed time in milliseconds. */
export const latencyBucket = (ms: number): SizeBucket =>
  toBucket(ms, [500, 1500, 4000, 10000]);

/** Time spent on a screen, in milliseconds. */
export const dwellBucket = (ms: number): SizeBucket =>
  toBucket(ms, [3000, 15000, 45000, 120000]);
