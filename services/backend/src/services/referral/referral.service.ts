import expertModel from "../../models/expert.model";
import referralProgramModel from "../../models/referral-program.model";
import referralRedemptionModel from "../../models/referral-redemption.model";
import UserModel from "../../models/user.model";
import {
    EReferralGrantSkipReason,
    EReferralOwnerType,
    EReferralRedemptionStatus,
    IReferralProgram,
    IReferralRedeemResult,
    IReferralRedemption,
} from "../../types/referral.types";
import { EPlanCode, ESubscriptionTier, TObjectIdLike } from "../../types/subscription.types";
import { EAccess, ICapabilityOverride } from "../entitlements/entitlement.config";
import { subscriptionService } from "../subscription/subscription.service";

export class ReferralError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly statusCode = 400,
    ) {
        super(message);
    }
}

/** A code is matched on one canonical form, whatever the user pasted. */
export function normalizeCode(raw: string): string {
    return String(raw ?? "").trim().toUpperCase();
}

/**
 * Referral redemption.
 *
 * Two things make this harder than it looks, and both shape the ordering below.
 *
 * There are no Mongo transactions anywhere in this codebase (the paid-activation path
 * is itself a five-write sequence), so correctness comes from ordering plus two
 * database-enforced guards instead: the unique index on `referral_redemptions.user_id`,
 * and a conditional `$inc` for the seat pool. The ledger row is therefore written
 * BEFORE the grant — crashing after it leaves a reconcilable PENDING row, whereas
 * crashing after a grant-first would leave a subscription nobody can attribute.
 *
 * And a redemption is not the same thing as a grant. Seats gate the grant only. The
 * 501st employee of an organization still redeems: she gets her doctor pinned and any
 * capability overrides, she is simply not given a subscription. Treating an exhausted
 * pool as an error would wall her out of onboarding with nothing support could do.
 */
export class ReferralService {
    /**
     * Take one seat from a finite pool, atomically.
     *
     * The predicate lives in the FILTER, not in a preceding read — the same shape as
     * EntitlementService.consumeCapability. Two concurrent redemptions on the last seat
     * both match at most once between them, so the pool cannot go negative or
     * over-issue. `seats.total` is in the filter as well so that an admin topping the
     * pool up mid-flight makes this claim miss rather than silently apply against a
     * stale ceiling; the caller re-reads and retries once.
     */
    private async claimSeat(program: IReferralProgram): Promise<boolean> {
        const total = program.benefits.seats.total;
        if (total == null) return true;

        const claimed = await referralProgramModel.findOneAndUpdate(
            {
                _id: program._id,
                isActive: true,
                "benefits.seats.total": total,
                "benefits.seats.claimed": { $lt: total },
            },
            { $inc: { "benefits.seats.claimed": 1 } },
            { new: true },
        );

        return !!claimed;
    }

    /** Give a seat back after a failed grant or a revoke. Guarded so it cannot go below 0. */
    public async releaseSeat(programId: TObjectIdLike): Promise<void> {
        await referralProgramModel.updateOne(
            { _id: programId, "benefits.seats.claimed": { $gt: 0 } },
            { $inc: { "benefits.seats.claimed": -1 } },
        );
    }

    private toResult(
        redemption: IReferralRedemption,
        program: IReferralProgram | null,
        grant: IReferralRedeemResult["grant"],
        skipReason: EReferralGrantSkipReason | null,
        alreadyRedeemed: boolean,
    ): IReferralRedeemResult {
        return {
            code: redemption.code,
            programId: redemption.program_id ? String(redemption.program_id) : null,
            displayName: program?.displayName ?? null,
            ownerType: redemption.ownerType,
            expertId: redemption.owner_expert_id ? String(redemption.owner_expert_id) : null,
            organizationId: redemption.owner_organization_id
                ? String(redemption.owner_organization_id)
                : null,
            grant,
            grantSkippedReason: skipReason,
            suppressedCapabilities: (redemption.appliedOverrides ?? [])
                .filter((o) => o.access === EAccess.LOCKED)
                .map((o) => String(o.capability)),
            alreadyRedeemed,
        };
    }

    /**
     * Rebuild the response for a user who has already redeemed, so a double-submit and
     * a re-install both get the same answer rather than an error.
     */
    private async resultFromExisting(
        redemption: IReferralRedemption,
    ): Promise<IReferralRedeemResult> {
        const program = redemption.program_id
            ? await referralProgramModel.findById(redemption.program_id).lean()
            : null;

        const grant = redemption.granted_subscription_id
            ? {
                  planCode: redemption.grantedPlanCode as EPlanCode,
                  currentPeriodEnd:
                      (await subscriptionService.getCurrent(redemption.user_id))
                          ?.currentPeriodEnd ?? null,
                  subscriptionId: String(redemption.granted_subscription_id),
              }
            : null;

        return this.toResult(
            redemption,
            program as IReferralProgram | null,
            grant,
            grant ? null : (redemption.failureReason as EReferralGrantSkipReason | null),
            true,
        );
    }

    public async redeem(
        userId: TObjectIdLike,
        rawCode: string,
        now: Date = new Date(),
    ): Promise<IReferralRedeemResult> {
        const code = normalizeCode(rawCode);

        // 1. Idempotency fast path.
        const existing = await referralRedemptionModel.findOne({ user_id: userId }).lean();
        if (existing) {
            if (existing.code === code) {
                return this.resultFromExisting(existing as IReferralRedemption);
            }
            throw new ReferralError(
                "REFERRAL_ALREADY_REDEEMED",
                "A referral code has already been applied to this account",
                409,
            );
        }

        // 2. Resolve. Unlike the endpoint this replaces, an unknown code is an ERROR.
        //    The old behaviour stored the junk string and returned 200, which was
        //    harmless when a code only reordered a list — now that a code can carry a
        //    free subscription, a mother must learn she mistyped it before she loses one.
        const program = (await referralProgramModel.findOne({ code }).lean()) as
            | IReferralProgram
            | null;
        if (!program) {
            throw new ReferralError(
                "REFERRAL_CODE_NOT_FOUND",
                "That referral code was not recognised",
                404,
            );
        }

        // 3. Window.
        if (!program.isActive) {
            throw new ReferralError(
                "REFERRAL_PROGRAM_INACTIVE",
                "That referral code is no longer active",
                409,
            );
        }
        if (program.startsAt && program.startsAt.getTime() > now.getTime()) {
            throw new ReferralError(
                "REFERRAL_PROGRAM_INACTIVE",
                "That referral code is not active yet",
                409,
            );
        }
        if (program.endsAt && program.endsAt.getTime() <= now.getTime()) {
            throw new ReferralError(
                "REFERRAL_PROGRAM_EXPIRED",
                "That referral code has expired",
                409,
            );
        }

        const planCode = program.benefits?.grant?.planCode ?? null;
        const overrides = (program.benefits?.entitlementOverrides ?? []) as ICapabilityOverride[];

        // 4/5. Decide whether a grant is owed, and take a seat if one is.
        let skipReason: EReferralGrantSkipReason | null = null;
        let seatClaimed = false;

        if (!planCode) {
            skipReason = EReferralGrantSkipReason.NO_GRANT_CONFIGURED;
        } else {
            const current = await subscriptionService.getCurrent(userId);
            const hasLivePremium =
                current?.tier === ESubscriptionTier.PREMIUM &&
                current?.currentPeriodEnd != null &&
                current.currentPeriodEnd > now;

            if (hasLivePremium) {
                // No seat is consumed — she is already paying, and burning an org seat
                // on someone who does not need it is the org's money.
                skipReason = EReferralGrantSkipReason.ALREADY_SUBSCRIBED;
            } else if (program.benefits.seats.total != null) {
                seatClaimed = await this.claimSeat(program);
                if (!seatClaimed) {
                    skipReason = EReferralGrantSkipReason.SEATS_EXHAUSTED;
                }
            }
        }

        // 6. Ledger first. An E11000 here means a second submit slipped past step 1.
        let redemption: IReferralRedemption;
        try {
            redemption = (await referralRedemptionModel.create({
                user_id: userId,
                program_id: program._id,
                code,
                ownerType: program.ownerType,
                owner_expert_id: program.owner_expert_id,
                owner_organization_id: program.owner_organization_id,
                seatClaimed,
                grantedPlanCode: null,
                granted_subscription_id: null,
                status: EReferralRedemptionStatus.PENDING,
                appliedOverrides: overrides,
                redeemedAt: now,
            })) as unknown as IReferralRedemption;
        } catch (err: any) {
            if (err?.code !== 11000) throw err;

            if (seatClaimed) await this.releaseSeat(program._id);
            const winner = await referralRedemptionModel.findOne({ user_id: userId }).lean();
            if (winner) return this.resultFromExisting(winner as IReferralRedemption);
            throw err;
        }

        // 7. Grant.
        let grant: IReferralRedeemResult["grant"] = null;
        if (!skipReason && planCode) {
            try {
                const subscription = await subscriptionService.grantFromReferral({
                    userId,
                    planCode,
                    programId: program._id,
                    now,
                });

                grant = {
                    planCode,
                    currentPeriodEnd: subscription.currentPeriodEnd,
                    subscriptionId: String(subscription._id),
                };

                await referralRedemptionModel.updateOne(
                    { _id: redemption._id },
                    {
                        $set: {
                            status: EReferralRedemptionStatus.COMPLETED,
                            grantedPlanCode: planCode,
                            granted_subscription_id: subscription._id,
                        },
                    },
                );
            } catch (err: any) {
                // 9. A failed grant must never wedge onboarding. The redemption stands,
                //    the pinning and overrides below still apply, and the row is left
                //    FAILED for an admin to retry.
                skipReason = EReferralGrantSkipReason.GRANT_FAILED;
                if (seatClaimed) {
                    await this.releaseSeat(program._id);
                    seatClaimed = false;
                }
                await referralRedemptionModel.updateOne(
                    { _id: redemption._id },
                    {
                        $set: {
                            status: EReferralRedemptionStatus.FAILED,
                            seatClaimed: false,
                            failureReason: err?.message ?? "grant failed",
                        },
                    },
                );
            }
        } else {
            // The redemption itself completed; there was simply nothing to grant.
            await referralRedemptionModel.updateOne(
                { _id: redemption._id },
                {
                    $set: {
                        status: EReferralRedemptionStatus.COMPLETED,
                        failureReason: skipReason,
                    },
                },
            );
        }

        // 8. Pin the expert and apply overrides, last — so the user document reflects a
        //    redemption only once it is actually settled.
        //
        //    `expert_referral_code` and `referred_by_expert_id` are written exactly as
        //    the old map-expert-referral endpoint wrote them. That is a hard invariant:
        //    ExpertService.getVisibleExperts and its mirror in the Python chatbot both
        //    read those fields, and neither needs to know referral programs exist.
        await UserModel.findByIdAndUpdate(userId, {
            $set: {
                expert_referral_code: code,
                referred_by_expert_id: program.owner_expert_id ?? null,
                referred_by_organization_id: program.owner_organization_id ?? null,
                referral_program_id: program._id,
                entitlement_overrides: overrides,
            },
        });

        const settled = (await referralRedemptionModel
            .findById(redemption._id)
            .lean()) as IReferralRedemption;

        return this.toResult(settled, program, grant, skipReason, false);
    }

    /**
     * Re-run the grant for a redemption whose grant threw. The operational answer to a
     * FAILED row; safe to call twice because `grantFromReferral` is idempotent.
     */
    public async retryGrant(redemptionId: TObjectIdLike): Promise<IReferralRedemption> {
        const redemption = (await referralRedemptionModel.findById(redemptionId).lean()) as
            | IReferralRedemption
            | null;
        if (!redemption) {
            throw new ReferralError("REDEMPTION_NOT_FOUND", "Redemption not found", 404);
        }
        if (redemption.status !== EReferralRedemptionStatus.FAILED) {
            throw new ReferralError(
                "REDEMPTION_NOT_FAILED",
                "Only a FAILED redemption can be retried",
                409,
            );
        }

        const program = (await referralProgramModel.findById(redemption.program_id).lean()) as
            | IReferralProgram
            | null;
        const planCode = program?.benefits?.grant?.planCode ?? null;
        if (!program || !planCode) {
            throw new ReferralError(
                "REFERRAL_NO_GRANT_CONFIGURED",
                "That program grants no subscription",
                409,
            );
        }

        let seatClaimed = false;
        if (program.benefits.seats.total != null) {
            seatClaimed = await this.claimSeat(program);
            if (!seatClaimed) {
                throw new ReferralError(
                    "REFERRAL_SEATS_EXHAUSTED",
                    "No seats remain on that program",
                    409,
                );
            }
        }

        try {
            const subscription = await subscriptionService.grantFromReferral({
                userId: redemption.user_id,
                planCode,
                programId: program._id,
            });

            return (await referralRedemptionModel.findOneAndUpdate(
                { _id: redemption._id },
                {
                    $set: {
                        status: EReferralRedemptionStatus.COMPLETED,
                        grantedPlanCode: planCode,
                        granted_subscription_id: subscription._id,
                        seatClaimed,
                        failureReason: null,
                    },
                },
                { new: true },
            )) as unknown as IReferralRedemption;
        } catch (err) {
            if (seatClaimed) await this.releaseSeat(program._id);
            throw err;
        }
    }

    /**
     * Undo a redemption: free the seat and delete the ledger row so the one-per-user
     * index lets her redeem again.
     *
     * The granted subscription is deliberately left alone — revoking is a support
     * action for "she used the wrong code", not a clawback, and cancelling a live
     * subscription is a separate, louder decision.
     */
    public async revoke(redemptionId: TObjectIdLike): Promise<void> {
        const redemption = (await referralRedemptionModel.findById(redemptionId).lean()) as
            | IReferralRedemption
            | null;
        if (!redemption) {
            throw new ReferralError("REDEMPTION_NOT_FOUND", "Redemption not found", 404);
        }

        if (redemption.seatClaimed && redemption.program_id) {
            await this.releaseSeat(redemption.program_id);
        }

        await UserModel.findByIdAndUpdate(redemption.user_id, {
            $set: {
                expert_referral_code: null,
                referred_by_expert_id: null,
                referred_by_organization_id: null,
                referral_program_id: null,
                entitlement_overrides: [],
            },
        });

        await referralRedemptionModel.deleteOne({ _id: redemption._id });
    }

    /** Does this code exist and currently grant anything? Used by the admin preview. */
    public async findProgramByCode(rawCode: string): Promise<IReferralProgram | null> {
        return referralProgramModel.findOne({ code: normalizeCode(rawCode) }).lean() as Promise<
            IReferralProgram | null
        >;
    }

    /**
     * Resolve an owner's display name for a program that has none set, so admin lists
     * stay readable without a populate on every row.
     */
    public async describeOwner(program: IReferralProgram): Promise<string | null> {
        if (program.displayName) return program.displayName;
        if (program.ownerType === EReferralOwnerType.EXPERT && program.owner_expert_id) {
            const expert = await expertModel
                .findById(program.owner_expert_id)
                .select("name")
                .lean();
            return expert?.name ?? null;
        }
        return null;
    }
}

export const referralService = new ReferralService();
