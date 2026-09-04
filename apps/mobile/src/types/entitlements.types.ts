/**
 * Mirrors the server's entitlement contract (GET /subscription/me).
 *
 * Nothing here carries a hardcoded limit. Every number — free AI messages, unlocked
 * products, the post character cap — arrives from the server so the funnel can be tuned
 * without shipping an app release.
 */

export enum SubscriptionTier {
  FREE = 'FREE',
  TRIAL = 'TRIAL',
  PREMIUM = 'PREMIUM',
}

export enum BillingMode {
  /** Trial takes no card; on day 7 the user drops to FREE and must buy explicitly. */
  MANUAL = 'MANUAL',
  /** Card saved at trial start, auto-debited on day 7. */
  AUTOPAY = 'AUTOPAY',
  /**
   * Google Play Billing. Renews automatically, and everything about the billing
   * calendar — the renewal date, cancelling, payment method — is owned by Google, so
   * the app links out to the Play subscription centre rather than acting on it here.
   */
  PLAY = 'PLAY',
}

export enum PlanCode {
  /**
   * Everything a paid plan grants except the consultation credits. Still a PREMIUM
   * tier — the difference is the plan's zero credit buckets, so the existing
   * `credits > 0` checks fall back to pay-per-session on their own.
   */
  LITE = 'LITE',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  HALF_YEARLY = 'HALF_YEARLY',
}

export enum Capability {
  AI_CHAT = 'ai.chat',
  CHECKIN_WEEKLY = 'checkin.weekly',
  CONTENT_GLOBAL_HEALTH = 'content.globalHealth',
  CONTENT_WEEKLY_RECOVERY = 'content.weeklyRecovery',
  PRODUCTS_VIEW = 'products.view',
  COMMUNITY_READ = 'community.read',
  COMMUNITY_POST = 'community.post',
  MOOD_LOG = 'moodLog',
  CONSULTATION_EXPERT = 'consultation.expert',
  CONSULTATION_CARE_MANAGER = 'consultation.careManager',
}

export enum Access {
  LOCKED = 'LOCKED',
  ALLOWED = 'ALLOWED',
}

export enum Fulfilment {
  PAY_PER_SESSION = 'PAY_PER_SESSION',
  CREDITS = 'CREDITS',
}

export enum DenialCode {
  LOCKED_FEATURE = 'LOCKED_FEATURE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NO_CREDITS = 'NO_CREDITS',
}

export interface ResolvedCapability {
  access: Access;
  /** null means unlimited. */
  limit?: number | null;
  maxChars?: number;
  fulfilment?: Fulfilment;
  used?: number;
  remaining?: number | null;
  /** ISO timestamp when a spent allowance comes back. */
  resetAt?: string | null;
}

export interface Entitlements {
  tier: SubscriptionTier;
  status: string | null;
  planCode: PlanCode | null;
  /** The mode of the user's OWN subscription. Null when they have none. */
  billingMode: BillingMode | null;
  /**
   * The mode a NEW subscription would use. Differs from `billingMode` after the server
   * toggle is flipped — an existing trial keeps the terms it was started under.
   */
  billingModeForNewSubscriptions: BillingMode;
  /**
   * Sent to Google as `obfuscatedAccountId` when launching a Play purchase, and checked
   * again server-side on the way back in. Derived on the server so the app never holds
   * the hashing key and the two sides cannot disagree about how it is computed.
   */
  playAccountId: string;
  trialEndAt: string | null;
  currentPeriodEnd: string | null;
  hasUsedTrial: boolean;
  capabilities: Record<Capability, ResolvedCapability>;
  credits: { expert: number; careManager: number };
}

export interface SubscriptionPlan {
  _id: string;
  code: PlanCode;
  displayName: string;
  description: string | null;
  amountPaise: number;
  durationDays: number;
  credits: { expert: number; careManager: number };
  sortOrder: number;
  /**
   * The Play Console product and base plan backing this plan, or null on a deployment
   * where the mapping migration has not run. Null means this plan cannot be bought on
   * the Play rail, which the catalog must handle rather than crash on.
   */
  playProductId: string | null;
  playBasePlanId: string | null;
}

/** The body of a 402. Enough context to render the right paywall without guessing. */
export interface DenialPayload {
  code: DenialCode;
  capability: Capability;
  tier: SubscriptionTier;
  limit?: number | null;
  used?: number;
  resetAt?: string | null;
  upsell: SubscriptionTier;
}
