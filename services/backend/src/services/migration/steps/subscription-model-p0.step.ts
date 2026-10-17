/**
 * Migration step: subscription-model-p0.step.ts
 *
 * Brings existing documents up to the P0 subscription-redesign schema. Four
 * independent backfills, all idempotent and safe to re-run:
 *
 *   1. contents.category   string -> [string]
 *   2. products.userCategory string -> [string]
 *   3. contents.contentGroup / sortOrder / isFreeOverride  (new required field)
 *   4. users.subscription  legacy {plan,status,billingCycle,expiryDate} -> tier snapshot
 *
 * Uses the existing mongoose connection — no connect/disconnect here.
 */
import mongoose from "mongoose";

import { EContentGroup, ContentBodyTypeEnum } from "../../../types/content.types";
import { ESubscriptionTier } from "../../../types/subscription.types";

export interface SubscriptionModelP0Result {
    contentsCategoryWrapped: number;
    productsCategoryWrapped: number;
    contentsGrouped: { globalHealth: number; unclassified: number };
    usersSubscriptionReset: number;
}

export async function migrate(): Promise<SubscriptionModelP0Result> {
    const db = mongoose.connection.db;
    if (!db) throw new Error("No mongoose connection available");

    // 1 + 2. Wrap the scalar category into a single-element array.
    //
    // The aggregation-pipeline form of updateMany lets the new value reference the old
    // one (`["$category"]`), which a plain $set cannot do.
    //
    // The filter must use the aggregation `$type` (via $expr), NOT the query-operator
    // `{ $type: "string" }`. The query operator also matches an ARRAY that CONTAINS a
    // string, so `["PP"]` would match and a re-run would wrap it again into `[["PP"]]`.
    // `{ $expr: { $eq: [{ $type: "$category" }, "string"] } }` matches only a literal
    // scalar string, which is what keeps this step idempotent.
    const contentsCategory = await db
        .collection("contents")
        .updateMany({ $expr: { $eq: [{ $type: "$category" }, "string"] } }, [
            { $set: { category: ["$category"] } },
        ]);

    const productsCategory = await db
        .collection("products")
        .updateMany({ $expr: { $eq: [{ $type: "$userCategory" }, "string"] } }, [
            { $set: { userCategory: ["$userCategory"] } },
        ]);

    // 3. Seed contentGroup, but only where we are confident.
    //
    // An article carrying a VIDEO body is treated as a global-health video. That is the
    // one heuristic we trust. EVERYTHING ELSE is left `null` — "not yet classified" —
    // rather than guessed as weekly-recovery, because a wrong WEEKLY_RECOVERY guess would
    // silently seed the free tier with the wrong articles. Content-ops resolves the nulls
    // by hand (GLOBAL_HEALTH or WEEKLY_RECOVERY) before the free tier can ship.
    const globalHealth = await db.collection("contents").updateMany(
        {
            contentGroup: { $exists: false },
            "contentBody.contentType": ContentBodyTypeEnum.VIDEO,
        },
        { $set: { contentGroup: EContentGroup.GLOBAL_HEALTH } },
    );

    // Everything that is not GLOBAL_HEALTH becomes null. This covers three cases in one:
    // fresh non-video docs (no contentGroup yet), and docs a previous run of this step
    // guessed as WEEKLY_RECOVERY. Idempotent — null → null changes nothing on re-run.
    const unclassified = await db
        .collection("contents")
        .updateMany(
            { contentGroup: { $ne: EContentGroup.GLOBAL_HEALTH } },
            { $set: { contentGroup: null } },
        );

    // Defaults for the new ordering/override fields. Separate from the group backfill so
    // re-running after a partial failure still fills them in.
    await db
        .collection("contents")
        .updateMany({ sortOrder: { $exists: false } }, { $set: { sortOrder: 0 } });
    await db
        .collection("contents")
        .updateMany({ isFreeOverride: { $exists: false } }, { $set: { isFreeOverride: false } });
    await db
        .collection("products")
        .updateMany({ sortOrder: { $exists: false } }, { $set: { sortOrder: 0 } });

    // 4. Replace the legacy subscription sub-doc wholesale.
    //
    // Everyone lands on FREE with hasUsedTrial=false rather than being mapped from the
    // old `status`. That old field was written by the onboarding checkbox and never
    // enforced, so an "active" value there does not mean the user paid for anything —
    // carrying it over would hand out free premium. Greenfield, so this is safe.
    const usersReset = await db.collection("users").updateMany(
        { "subscription.tier": { $exists: false } },
        {
            $set: {
                subscription: {
                    tier: ESubscriptionTier.FREE,
                    status: null,
                    planCode: null,
                    subscription_id: null,
                    billingMode: null,
                    trialEndAt: null,
                    currentPeriodEnd: null,
                    hasUsedTrial: false,
                },
            },
        },
    );

    return {
        contentsCategoryWrapped: contentsCategory.modifiedCount,
        productsCategoryWrapped: productsCategory.modifiedCount,
        contentsGrouped: {
            globalHealth: globalHealth.modifiedCount,
            unclassified: unclassified.modifiedCount,
        },
        usersSubscriptionReset: usersReset.modifiedCount,
    };
}
