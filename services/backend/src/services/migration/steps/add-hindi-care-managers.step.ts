/**
 * Migration step: add-hindi-care-managers.step.ts
 * Contains all data and the migrate() function.
 * Imported by the CLI script (scripts/) and by MigrationService.
 * Uses the existing mongoose connection — no connect/disconnect here.
 */
import mongoose from "mongoose";

import caremanagerModel from "../../../models/care-manager.model";
import { ICareManagerTranslationBundle } from "../../../types/care-manager.types";

// _id -> Hindi bundle
const HINDI_BY_ID: Record<string, ICareManagerTranslationBundle> = {
    "6955119b046a7bc1d00c0d75": { name: "प्रिया वर्मा" },
    "6955114e046a7bc1d00c0d73": { name: "अनन्या शर्मा" },
};

export async function migrate(): Promise<{ updated: number; missing: number }> {
    let updated = 0;
    let missing = 0;

    for (const [id, bundle] of Object.entries(HINDI_BY_ID)) {
        const res = await caremanagerModel.updateOne(
            { _id: new mongoose.Types.ObjectId(id) },
            { $set: { "translations.hi": bundle } },
        );

        if (res.matchedCount === 0) {
            console.warn(`No care manager found for _id=${id}`);
            missing += 1;
        } else {
            updated += 1;
        }
    }

    console.log(`Done. Updated ${updated} care manager(s), ${missing} id(s) unmatched.`);
    return { updated, missing };
}
