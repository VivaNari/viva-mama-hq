import { Schema } from "mongoose";
import { EPlanCode } from "./subscription.types";
import { ICapabilityOverride } from "../services/entitlements/entitlement.config";

/**
 * Referral programs — the code is the entity.
 *
 * A code used to be a field on an expert whose only effect was pinning that doctor to
 * the top of her patient's Experts list. It now carries benefits an admin configures:
 * a subscription to grant, capabilities to suppress, and optionally a finite pool of
 * seats. Making the CODE the entity rather than hanging config off the expert is what
 * lets an organization own one, lets one owner run two campaigns, and gives the seat
 * counter somewhere to live.
 */
export enum EReferralOwnerType {
    EXPERT = "EXPERT",
    ORGANIZATION = "ORGANIZATION",
}

export enum EReferralRedemptionStatus {
    /** Ledger row written, grant not yet attempted. Reconcilable if we crash here. */
    PENDING = "PENDING",
    COMPLETED = "COMPLETED",
    /** The grant threw. The redemption itself still stands — see ReferralService. */
    FAILED = "FAILED",
    /** Support un-did it, freeing both the seat and the one-per-user index slot. */
    REVOKED = "REVOKED",
}

/** Why a redemption did not come with a subscription. Null when one was granted. */
export enum EReferralGrantSkipReason {
    /** The program carries no `grant.planCode` — it is a pin-only or suppress-only code. */
    NO_GRANT_CONFIGURED = "NO_GRANT_CONFIGURED",
    SEATS_EXHAUSTED = "SEATS_EXHAUSTED",
    ALREADY_SUBSCRIBED = "ALREADY_SUBSCRIBED",
    GRANT_FAILED = "GRANT_FAILED",
}

export interface IOrganization {
    _id: Schema.Types.ObjectId;
    name: string;
    slug: string;
    contactEmail: string | null;
    contactPhone: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IReferralSeats {
    /** Null means unlimited. A number is a hard pool. */
    total: number | null;
    claimed: number;
}

export interface IReferralBenefits {
    /** Null means this code grants no subscription — it only pins and/or suppresses. */
    grant: { planCode: EPlanCode | null };
    seats: IReferralSeats;
    entitlementOverrides: ICapabilityOverride[];
}

export interface IReferralProgram {
    _id: Schema.Types.ObjectId;
    code: string;
    ownerType: EReferralOwnerType;
    owner_expert_id: Schema.Types.ObjectId | null;
    owner_organization_id: Schema.Types.ObjectId | null;
    displayName: string | null;
    isActive: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
    benefits: IReferralBenefits;
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * One row per user, ever — the unique index on `user_id` is what makes a double-tapped
 * submit safe without a transaction, and what stops a user farming several programs.
 */
export interface IReferralRedemption {
    _id: Schema.Types.ObjectId;
    user_id: Schema.Types.ObjectId;
    /** Null for a backfilled row whose code matches no program (historic junk). */
    program_id: Schema.Types.ObjectId | null;
    code: string;
    ownerType: EReferralOwnerType | null;
    owner_expert_id: Schema.Types.ObjectId | null;
    owner_organization_id: Schema.Types.ObjectId | null;
    /** True only when a finite pool was decremented, so a revoke knows to give it back. */
    seatClaimed: boolean;
    grantedPlanCode: EPlanCode | null;
    granted_subscription_id: Schema.Types.ObjectId | null;
    status: EReferralRedemptionStatus;
    failureReason: string | null;
    /**
     * What the program's overrides were at redemption time. Snapshotted rather than
     * joined so editing a program later never silently rewrites history.
     */
    appliedOverrides: ICapabilityOverride[];
    redeemedAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

/** What POST /referral/redeem returns. `grant != null` is the app's entire contract. */
export interface IReferralRedeemResult {
    code: string;
    programId: string | null;
    displayName: string | null;
    ownerType: EReferralOwnerType | null;
    expertId: string | null;
    organizationId: string | null;
    grant: {
        planCode: EPlanCode;
        currentPeriodEnd: Date | null;
        subscriptionId: string;
    } | null;
    grantSkippedReason: EReferralGrantSkipReason | null;
    suppressedCapabilities: string[];
    alreadyRedeemed: boolean;
}
