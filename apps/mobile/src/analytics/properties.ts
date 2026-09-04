/**
 * User properties — the segments every report and every crash can be sliced by.
 *
 * Firebase caps a project at 25 user properties and, like event names, a used
 * name cannot be reclaimed. We spend 7 and leave the rest as headroom.
 *
 * Same boundary as events: nothing here may be health data or PII. A tier, a
 * language and an onboarding stage describe how someone uses the app, not
 * anything about their pregnancy, mood or body.
 */
export const UserProperty = {
  SUBSCRIPTION_TIER: 'subscription_tier',
  BILLING_MODE: 'billing_mode',
  APP_LANGUAGE: 'app_language',
  ONBOARDING_STAGE: 'onboarding_stage',
  AUTH_METHOD: 'auth_method',
  NOTIFICATIONS_ENABLED: 'notifications_enabled',
  // Removed: `has_partner`. The only candidate source is
  // `user.partner_referral_code`, and it is ambiguous whether that is the code
  // the user shares or one they redeemed — a segment wired to the wrong reading
  // is worse than no segment. Add it back once the backend meaning is confirmed.
} as const;

export type UserPropertyName =
  (typeof UserProperty)[keyof typeof UserProperty];

/**
 * How far through onboarding a user is.
 *
 * Mirrors `OnboardingStatus` in AuthContext, flattened into one ordinal value so
 * it can be a single GA4 property instead of two booleans.
 */
export type OnboardingStage =
  | 'none'
  | 'questionnaire_done'
  | 'subscription_done'
  | 'complete';

/**
 * `null` is accepted as well as `undefined` because several sources are
 * legitimately nullable — `entitlements.billingMode` is null for a user with no
 * subscription. `setUserProps` drops both rather than sending them, so a
 * not-yet-known value never clobbers a previously set one.
 */
type PropertyValue<T extends string = string> = T | null | undefined;

export interface UserProperties {
  [UserProperty.SUBSCRIPTION_TIER]?: PropertyValue;
  [UserProperty.BILLING_MODE]?: PropertyValue;
  [UserProperty.APP_LANGUAGE]?: PropertyValue;
  [UserProperty.ONBOARDING_STAGE]?: PropertyValue<OnboardingStage>;
  [UserProperty.AUTH_METHOD]?: PropertyValue;
  [UserProperty.NOTIFICATIONS_ENABLED]?: PropertyValue;
}

/** Flatten the two onboarding booleans into the ordinal GA4 property. */
export const resolveOnboardingStage = (
  questionnaireCompleted: boolean,
  subscriptionCompleted: boolean,
): OnboardingStage => {
  if (questionnaireCompleted && subscriptionCompleted) return 'complete';
  if (questionnaireCompleted) return 'questionnaire_done';
  if (subscriptionCompleted) return 'subscription_done';
  return 'none';
};
