import careManagerModel from "../../../models/care-manager.model";
import { CARE_MANAGER_DEFAULT_REMUNERATION } from "../../../constants/care-manager";

/**
 * Backfills `remuneration` on care managers.
 *
 * Postpartum counsellors used to be premium-only: a user with no credit was refused
 * outright. They now have a pay-per-session route like experts, which needs a fee on the
 * document — the app reads it to render "Pay ₹99" and the order is created against it.
 *
 * Idempotent — only documents missing the field or holding null are touched, so a
 * counsellor whose rate has since been changed by hand is never reset by a re-run.
 */
export async function migrate(): Promise<{ updated: number; amount: number }> {
    console.log("Starting migration to add remuneration to care managers...");

    const result = await careManagerModel.updateMany(
        { $or: [{ remuneration: { $exists: false } }, { remuneration: null }] },
        { $set: { remuneration: CARE_MANAGER_DEFAULT_REMUNERATION } },
    );

    console.log(
        `remuneration backfilled -> care managers: ${result.modifiedCount} @ ₹${CARE_MANAGER_DEFAULT_REMUNERATION}`,
    );

    return { updated: result.modifiedCount, amount: CARE_MANAGER_DEFAULT_REMUNERATION };
}
