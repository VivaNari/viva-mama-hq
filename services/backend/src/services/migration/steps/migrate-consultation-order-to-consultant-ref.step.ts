import bookConsultationOrderModel from "../../../models/book-consultation.model";
import { ConsultationTypeEnum } from "../../../types/consultation.types";

/**
 * Reshapes `book_consultation_orders` from expert-only to polymorphic.
 *
 *   expert_id -> consultant_id
 *   (new)     -> consultation_type: "EXPERT"
 *
 * Counsellors gained a pay-per-session route, so the order collection can no longer
 * assume every row points at the `experts` collection. Every pre-existing order was an
 * expert booking by construction, which is why the type can be stamped unconditionally.
 *
 * Driven through the raw collection rather than the model: the schema no longer declares
 * `expert_id`, so a mongoose-level query would not see the field it has to rename.
 *
 * Idempotent — matches only documents that still carry `expert_id`, so a re-run after a
 * partial failure finishes the job without touching what already moved.
 */
export async function migrate(): Promise<{ renamed: number; typed: number }> {
    console.log("Starting migration of consultation orders to a polymorphic consultant ref...");

    // Taken from the model rather than written as a literal. The model registers as
    // "bookConsultation_orders", which mongoose lowercases to "bookconsultation_orders" —
    // a hand-written "book_consultation_orders" matches nothing and reports success.
    const collection = bookConsultationOrderModel.collection;

    // Stamped before the rename so a crash between the two leaves rows that are still
    // findable by `expert_id` — the safe direction to be interrupted in.
    const typed = await collection.updateMany(
        { consultation_type: { $exists: false } },
        { $set: { consultation_type: ConsultationTypeEnum.EXPERT } },
    );

    const renamed = await collection.updateMany(
        { expert_id: { $exists: true } },
        { $rename: { expert_id: "consultant_id" } },
    );

    console.log(
        `consultation orders migrated -> typed: ${typed.modifiedCount}, renamed: ${renamed.modifiedCount}`,
    );

    return { renamed: renamed.modifiedCount, typed: typed.modifiedCount };
}
