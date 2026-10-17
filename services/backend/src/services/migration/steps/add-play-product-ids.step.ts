/**
 * Migration step: add-play-product-ids.step.ts
 *
 * Points each plan in the catalog at its Google Play Console product and base plan.
 *
 * Needed as its own step because `seed-subscription-plans` is insert-only by design —
 * it uses `$setOnInsert` so a re-run can never revert a price change made in the
 * database. That is the right rule for the catalog and the wrong one for a new field:
 * every existing deployment already has the four plan rows, so the seed would never
 * write these ids.
 *
 * Writes only where the field is currently null, so this is safe to re-run and cannot
 * overwrite an id that ops corrected by hand. Values come from PLAY_PRODUCTS, which is
 * the single place the Console ids live.
 */
import subscriptionPlanModel from "../../../models/subscription-plan.model";
import {
    assertPlayProductsAreDistinct,
    PLAY_PRODUCTS,
} from "../../subscription/billing/play-products";
import { EPlanCode } from "../../../types/subscription.types";

export interface AddPlayProductIdsResult {
    matched: number;
    modified: number;
    missingPlans: EPlanCode[];
}

export async function migrate(): Promise<AddPlayProductIdsResult> {
    // Two plans pointed at one Play product would silently give the cheaper plan's
    // buyers the dearer plan's credits. Fail the migration rather than write it.
    assertPlayProductsAreDistinct();

    let matched = 0;
    let modified = 0;
    const missingPlans: EPlanCode[] = [];

    for (const [code, product] of Object.entries(PLAY_PRODUCTS) as Array<
        [EPlanCode, (typeof PLAY_PRODUCTS)[EPlanCode]]
    >) {
        const result = await subscriptionPlanModel.updateOne(
            {
                code,
                $or: [{ playProductId: null }, { playProductId: { $exists: false } }],
            },
            {
                $set: {
                    playProductId: product.productId,
                    playBasePlanId: product.basePlanId,
                },
            },
        );

        matched += result.matchedCount ?? 0;
        modified += result.modifiedCount ?? 0;

        // A plan in PLAY_PRODUCTS with no row in the catalog means the seed has not run,
        // or a plan code was renamed. Reported rather than thrown: the other three plans
        // are still worth mapping, and the caller can see what was skipped.
        const exists = await subscriptionPlanModel.exists({ code });
        if (!exists) missingPlans.push(code);
    }

    return { matched, modified, missingPlans };
}
