/**
 * Migration step: drop-expert-referral-code-index.step.ts
 *
 * Drops the unique index on `experts.referralCode`.
 *
 * That index was `{ sparse: true, unique: true }` on a field defaulting to `null` — and
 * a sparse index still indexes an explicit null, so the SECOND expert created without a
 * code collided with the first and threw E11000. Creating code-less experts has been
 * broken for as long as the field has existed.
 *
 * Uniqueness now belongs to `referral_programs.code`; the expert field is a read-only
 * mirror. Removing `unique` from the schema is not enough on its own — mongoose builds
 * indexes but never drops them, so the old one would sit in the collection enforcing a
 * constraint no code asks for any more.
 *
 * Idempotent: a missing index (already dropped, or a fresh database that never had one)
 * is a no-op, not an error.
 *
 * Uses the existing mongoose connection — no connect/disconnect here.
 */
import expertModel from "../../../models/expert.model";

export interface DropExpertReferralCodeIndexResult {
    dropped: string[];
}

export async function migrate(): Promise<DropExpertReferralCodeIndexResult> {
    const dropped: string[] = [];

    let indexes: Array<Record<string, any>>;
    try {
        indexes = await expertModel.collection.indexes();
    } catch {
        // Collection does not exist yet — nothing to drop.
        return { dropped };
    }

    for (const index of indexes) {
        const keys = Object.keys(index.key ?? {});
        const isReferralCodeIndex = keys.length === 1 && keys[0] === "referralCode";
        if (!isReferralCodeIndex || !index.unique) continue;

        try {
            await expertModel.collection.dropIndex(index.name);
            dropped.push(index.name);
            console.log(`drop-expert-referral-code-index: dropped ${index.name}`);
        } catch (err: any) {
            // 27 = IndexNotFound. A concurrent run got there first; that is fine.
            if (err?.code !== 27) throw err;
        }
    }

    if (!dropped.length) {
        console.log("drop-expert-referral-code-index: nothing to drop");
    }

    return { dropped };
}
