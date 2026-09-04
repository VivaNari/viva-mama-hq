/**
 * Migration step: backfill-referral-redemptions.step.ts
 *
 * Writes a ledger row for every user who already redeemed a code through the old
 * `POST /user/map-expert-referral`, so the one-redemption-per-user rule is true of the
 * whole user base rather than only of people who sign up after this ships.
 *
 * Idempotency is by CAUGHT E11000 on the unique {user_id} index, not by an upsert. An
 * upsert would rewrite `redeemedAt` on every migration run, and this step re-runs on
 * every invocation — the redemption dates would creep forward forever.
 *
 * Codes that match no program are recorded as FAILED/ORPHAN_CODE rather than having
 * programs invented for them. The old endpoint stored whatever string it was handed,
 * including typos, so a meaningful share of these are junk and must not become live
 * codes anyone can redeem.
 *
 * Note the consequence, which is intended: a backfilled user can no longer redeem a
 * real program. Support undoes that per-user with
 * DELETE /admin/referral-redemptions/:id.
 *
 * Uses the existing mongoose connection — no connect/disconnect here.
 */
import referralProgramModel from "../../../models/referral-program.model";
import referralRedemptionModel from "../../../models/referral-redemption.model";
import UserModel from "../../../models/user.model";
import {
    EReferralOwnerType,
    EReferralRedemptionStatus,
} from "../../../types/referral.types";

export interface BackfillReferralRedemptionsResult {
    inserted: number;
    orphans: number;
    skipped: number;
}

export async function migrate(): Promise<BackfillReferralRedemptionsResult> {
    const users = await UserModel.find({ expert_referral_code: { $nin: [null, ""] } })
        .select("_id expert_referral_code referred_by_expert_id createdAt")
        .lean();

    let inserted = 0;
    let orphans = 0;
    let skipped = 0;

    for (const user of users) {
        const code = String(user.expert_referral_code).trim().toUpperCase();
        if (!code) {
            skipped += 1;
            continue;
        }

        const program = await referralProgramModel.findOne({ code }).select("_id").lean();
        const isOrphan = !program;

        try {
            await referralRedemptionModel.create({
                user_id: user._id,
                program_id: program?._id ?? null,
                code,
                ownerType: isOrphan ? null : EReferralOwnerType.EXPERT,
                owner_expert_id: user.referred_by_expert_id ?? null,
                owner_organization_id: null,
                // Historic redemptions never consumed a pool; seats did not exist.
                seatClaimed: false,
                grantedPlanCode: null,
                granted_subscription_id: null,
                status: isOrphan
                    ? EReferralRedemptionStatus.FAILED
                    : EReferralRedemptionStatus.COMPLETED,
                failureReason: isOrphan ? "ORPHAN_CODE" : null,
                appliedOverrides: [],
                // Her signup date is the closest honest approximation; the old endpoint
                // recorded no timestamp of its own.
                redeemedAt: (user as { createdAt?: Date }).createdAt ?? new Date(),
            });

            inserted += 1;
            if (isOrphan) orphans += 1;
        } catch (err: any) {
            // Already backfilled on an earlier run. This is the idempotency guarantee.
            if (err?.code === 11000) {
                skipped += 1;
                continue;
            }
            throw err;
        }
    }

    console.log(
        `backfill-referral-redemptions: ${inserted} inserted (${orphans} orphan codes), ${skipped} already present`,
    );
    return { inserted, orphans, skipped };
}
