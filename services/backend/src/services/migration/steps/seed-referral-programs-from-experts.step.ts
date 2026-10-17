/**
 * Migration step: seed-referral-programs-from-experts.step.ts
 *
 * Creates one `referral_programs` row per expert that already has a `referralCode`, so
 * every code in circulation keeps working the moment redemption starts reading the new
 * collection instead of the expert document.
 *
 * This is a ONE-WAY IMPORT, not an ongoing sync. New codes are created directly as
 * programs through the admin API; nothing mints them onto experts any more. Once this
 * has run in production and the programs are verified, this step and
 * `experts.referralCode` can both be deleted.
 *
 * INSERT-ONLY, deliberately, for the same reason as seed-subscription-plans: this seed
 * establishes the rows, it must never overwrite them. There is no migration ledger —
 * every step re-runs on every invocation of POST /admin/migrate/run-all — so a `$set`
 * here would silently wipe the plan an admin attached to Dr Sujana's code the moment
 * anyone triggered a migration run.
 *
 * Seeded programs grant nothing (`planCode: null`) and suppress nothing. They reproduce
 * exactly today's behaviour — pin the referring expert — and wait to be configured.
 *
 * Uses the existing mongoose connection — no connect/disconnect here.
 */
import expertModel from "../../../models/expert.model";
import referralProgramModel from "../../../models/referral-program.model";
import { EReferralOwnerType } from "../../../types/referral.types";

export interface SeedReferralProgramsResult {
    upserted: number;
    skipped: number;
}

export async function migrate(): Promise<SeedReferralProgramsResult> {
    const experts = await expertModel
        .find({ referralCode: { $nin: [null, ""] } })
        .select("_id name referralCode isActive")
        .lean();

    let upserted = 0;
    let skipped = 0;

    for (const expert of experts) {
        const code = String(expert.referralCode).trim().toUpperCase();
        if (!code) {
            skipped += 1;
            continue;
        }

        const result = await referralProgramModel.updateOne(
            { code },
            {
                $setOnInsert: {
                    code,
                    ownerType: EReferralOwnerType.EXPERT,
                    owner_expert_id: expert._id,
                    owner_organization_id: null,
                    displayName: expert.name ?? null,
                    isActive: expert.isActive ?? true,
                    startsAt: null,
                    endsAt: null,
                    benefits: {
                        grant: { planCode: null },
                        seats: { total: null, claimed: 0 },
                        entitlementOverrides: [],
                    },
                },
            },
            { upsert: true },
        );

        if (result.upsertedCount) upserted += result.upsertedCount;
        else skipped += 1;
    }

    console.log(
        `seed-referral-programs-from-experts: ${upserted} created, ${skipped} already present`,
    );
    return { upserted, skipped };
}
