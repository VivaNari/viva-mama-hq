/**
 * Migration step: seed-subscription-plans.step.ts
 *
 * Seeds the plan catalog into `subscription_plans`. Upserts on `code`, so re-running
 * adds a newly-listed plan without duplicating or disturbing the existing rows.
 *
 * Credits are stored per bucket rather than as a total that gets halved: an odd total
 * has no well-defined half, and this leaves room to sell an uneven split later without
 * a schema change. Half the pool is user-chosen expert consultations, half is
 * care-manager (postpartum counsellor) callbacks.
 *
 * ⚠️ The prices here are insert-only: `$setOnInsert` means a re-run never overwrites a
 * price edited in the database, which is deliberate but makes this file drift silently.
 * It did — MONTHLY and QUARTERLY were repriced in production and this file kept the old
 * numbers for months. Treat the database as the source of truth and correct this file to
 * match, never the other way round.
 *
 * These must also equal the base plan prices in Play Console. The app renders the price
 * from this catalog while Google charges the Console price, so a mismatch shows the user
 * one number and bills another — a Play Subscriptions policy violation, not just a bug.
 *
 * Uses the existing mongoose connection — no connect/disconnect here.
 */
import subscriptionPlanModel from "../../../models/subscription-plan.model";
import { EPlanCode, ISubscriptionPlan } from "../../../types/subscription.types";

type PlanSeed = Omit<ISubscriptionPlan, "_id">;

const PLANS: PlanSeed[] = [
    {
        code: EPlanCode.LITE,
        displayName: "Viva Lite",
        description: "Everything essential, minus 1:1 consultations",
        amountPaise: 29_900, // ₹299
        durationDays: 30,
        // The defining property of this plan. Nothing downstream special-cases it:
        // `grantForPlan` skips a zero bucket, and both booking flows read
        // `credits > 0`, so a Lite user simply takes the pay-per-session path.
        credits: { expert: 0, careManager: 0 },
        razorpayPlanId: null,
        // Left null here and filled by add-play-product-ids.step, which is also what
        // maps the plans on deployments that already have this catalog. Keeping the
        // Play ids in one place beats having them in both the seed and that step.
        playProductId: null,
        playBasePlanId: null,
        isActive: true,
        sortOrder: 0,
        translations: {
            hi: {
                displayName: "विवा लाइट",
                description: "सभी ज़रूरी सुविधाएँ, 1:1 परामर्श को छोड़कर",
            },
        },
    },
    {
        code: EPlanCode.MONTHLY,
        displayName: "Monthly",
        description: "1 month of full access",
        amountPaise: 99_900, // ₹999
        durationDays: 30,
        credits: { expert: 1, careManager: 1 }, // 2 total
        razorpayPlanId: null,
        // Left null here and filled by add-play-product-ids.step, which is also what
        // maps the plans on deployments that already have this catalog. Keeping the
        // Play ids in one place beats having them in both the seed and that step.
        playProductId: null,
        playBasePlanId: null,
        isActive: true,
        sortOrder: 1,
        translations: {},
    },
    {
        code: EPlanCode.QUARTERLY,
        displayName: "3 Months",
        description: "3 months of full access",
        amountPaise: 279_900, // ₹2,799
        durationDays: 90,
        credits: { expert: 3, careManager: 3 }, // 6 total
        razorpayPlanId: null,
        // Left null here and filled by add-play-product-ids.step, which is also what
        // maps the plans on deployments that already have this catalog. Keeping the
        // Play ids in one place beats having them in both the seed and that step.
        playProductId: null,
        playBasePlanId: null,
        isActive: true,
        sortOrder: 2,
        translations: {},
    },
    {
        code: EPlanCode.HALF_YEARLY,
        displayName: "6 Months",
        description: "6 months of full access",
        amountPaise: 399_900, // ₹3,999
        durationDays: 180,
        credits: { expert: 6, careManager: 6 }, // 12 total
        razorpayPlanId: null,
        // Left null here and filled by add-play-product-ids.step, which is also what
        // maps the plans on deployments that already have this catalog. Keeping the
        // Play ids in one place beats having them in both the seed and that step.
        playProductId: null,
        playBasePlanId: null,
        isActive: true,
        sortOrder: 3,
        translations: {},
    },
];

export interface SeedSubscriptionPlansResult {
    upserted: number;
    modified: number;
}

export async function migrate(): Promise<SeedSubscriptionPlansResult> {
    let upserted = 0;
    let modified = 0;

    for (const plan of PLANS) {
        const result = await subscriptionPlanModel.updateOne(
            { code: plan.code },
            // INSERT-ONLY, deliberately. This seed establishes the catalog; it must never
            // overwrite it.
            //
            // Two reasons. The migration endpoint (POST /api/v1/admin/migrate/run-all,
            // mounted in app.ts) is guarded by plain authMiddleware(), so *any* logged-in
            // user can trigger a run — a $set here would let them revert a price change
            // made by ops. And more fundamentally, the catalog is meant to be edited in
            // the database precisely so pricing does not live in code; a seed that
            // reasserts code values would defeat that.
            //
            // To change a price, update the document. To add a plan, add it here.
            { $setOnInsert: plan },
            { upsert: true },
        );

        if (result.upsertedCount) upserted += result.upsertedCount;
        if (result.modifiedCount) modified += result.modifiedCount;
    }

    return { upserted, modified };
}
