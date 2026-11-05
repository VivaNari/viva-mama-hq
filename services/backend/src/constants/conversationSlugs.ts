/**
 * The onboarding the Play Store build runs. Frozen: that build cannot show the newer
 * questions properly, so nothing may add to or reword this flow.
 */
export const ONBOARDING_SLUG = "onboarding-flow-v2";

/** The onboarding newer app builds ask for, with the PRD section 1 questions. */
export const ONBOARDING_SLUG_V3 = "onboarding-flow-v3";

export const isOnboardingSlug = (slug: string): boolean =>
    slug === ONBOARDING_SLUG || slug === ONBOARDING_SLUG_V3;
