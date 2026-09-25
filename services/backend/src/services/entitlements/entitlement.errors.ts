import { ESubscriptionTier } from "../../types/subscription.types";
import { ECapability } from "./entitlement.config";

export enum EDenialCode {
    /** The tier does not include this feature at all. */
    LOCKED_FEATURE = "LOCKED_FEATURE",
    /** Allowed, but the allowance for this window is spent. */
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
    /** Allowed, but the relevant credit bucket is empty. */
    NO_CREDITS = "NO_CREDITS",
}

export interface IDenialPayload {
    capability: ECapability;
    tier: ESubscriptionTier;
    limit?: number | null;
    used?: number;
    resetAt?: Date | null;
    upsell: ESubscriptionTier;
}

/**
 * A refusal the app is expected to handle by showing a paywall — not a server fault.
 *
 * Carried as HTTP 402 with a machine-readable `code` and enough context for the client
 * to render the right thing: never a bare 403. The app must know *what* to offer and
 * *when* the allowance resets without parsing prose.
 */
export class EntitlementDeniedError extends Error {
    public readonly statusCode = 402;

    constructor(
        public readonly code: EDenialCode,
        public readonly payload: IDenialPayload,
        message?: string,
    ) {
        super(message ?? `${code}: ${payload.capability}`);
    }
}
