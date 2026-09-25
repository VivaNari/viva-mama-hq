import expertModel from "../../../models/expert.model";

/**
 * Backfills `is_empanelled_expert` on experts.
 *
 * A subscription consultation credit is priced against the in-house session fee. Spent
 * on an external specialist charging several times that, it costs more to fulfil than
 * the plan brought in — six credits at ₹700 exceeds the ₹3,999 half-yearly plan on its
 * own. Credits are therefore restricted to the panel, and everyone else is
 * pay-per-session.
 *
 * Everything is backfilled to FALSE. That is deliberate: empanelment is a commercial
 * decision about a named doctor, not something to infer from a fee that may change. The
 * consequence is that NO credit is spendable on any expert until ops flips the in-house
 * ones by hand — a required post-migration step, not an optional one.
 *
 * Idempotent, and matched on `$exists: false` ONLY — never on `null` or `false` — so a
 * re-run can never un-empanel an expert somebody has since turned on.
 */
export async function migrate(): Promise<{ updated: number; empanelled: number }> {
    console.log("Starting migration to add is_empanelled_expert to experts...");

    const result = await expertModel.updateMany(
        { is_empanelled_expert: { $exists: false } },
        { $set: { is_empanelled_expert: false } },
    );

    const empanelled = await expertModel.countDocuments({ is_empanelled_expert: true });

    console.log(`is_empanelled_expert backfilled -> experts: ${result.modifiedCount} set to false`);

    if (empanelled === 0) {
        console.warn(
            "[add-expert-empanelment] No expert is empanelled. Consultation credits " +
                "cannot be spent on ANY expert until the in-house ones are marked, e.g. " +
                "db.experts.updateMany({ remuneration: { $lte: 199 } }, { $set: { is_empanelled_expert: true } })",
        );
    }

    return { updated: result.modifiedCount, empanelled };
}
