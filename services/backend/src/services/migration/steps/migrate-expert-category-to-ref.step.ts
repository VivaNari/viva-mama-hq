/**
 * Migration step: migrate-expert-category-to-ref.step.ts
 *
 * Converts `experts.category` from a legacy string enum (e.g. "GYNECOLOGIST")
 * into an ObjectId reference to the matching `expert_categories` document.
 *
 * Depends on the categories existing — run seed-expert-categories first. Reads and
 * writes through the raw collection driver: the Mongoose schema now types
 * `category` as an ObjectId, so loading a document that still holds a string would
 * fail to cast. Idempotent — documents already carrying an ObjectId are skipped.
 *
 * Uses the existing mongoose connection — no connect/disconnect here.
 */
import { Types } from "mongoose";
import expertModel from "../../../models/expert.model";
import expertCategoryModel from "../../../models/expert-category.model";

const OBJECT_ID_HEX = /^[a-fA-F0-9]{24}$/;

export interface MigrateExpertCategoryResult {
    total: number;
    updated: number;
    alreadyMigrated: number;
    unmatched: number;
    unmatchedValues: string[];
}

export async function migrate(): Promise<MigrateExpertCategoryResult> {
    const categories = await expertCategoryModel.find({}, { key: 1 }).lean();
    if (categories.length === 0) {
        throw new Error(
            "No expert categories found. Run the seed-expert-categories migration first.",
        );
    }

    const keyToId = new Map<string, Types.ObjectId>();
    for (const category of categories) {
        keyToId.set(String(category.key), category._id as Types.ObjectId);
    }

    // Raw driver: bypasses schema casting so legacy string categories can be read.
    const collection = expertModel.collection;
    const experts = await collection.find({}).toArray();

    let updated = 0;
    let alreadyMigrated = 0;
    const unmatchedValues: string[] = [];

    for (const expert of experts) {
        const current = expert.category;

        // Already an ObjectId — nothing to do.
        if (current instanceof Types.ObjectId) {
            alreadyMigrated++;
            continue;
        }

        const raw = typeof current === "string" ? current : current == null ? "" : String(current);

        // Legacy enum key -> the seeded category's _id. Checked before the hex test
        // because some keys (e.g. "GYNECOLOGIST") are 12 chars and would otherwise be
        // mistaken for a raw 12-byte ObjectId.
        const mappedId = keyToId.get(raw);
        if (mappedId) {
            await collection.updateOne({ _id: expert._id }, { $set: { category: mappedId } });
            updated++;
            console.log(`Expert ${expert._id}: "${raw}" -> ${mappedId}`);
            continue;
        }

        // An id stored as a string (partially-migrated data) — normalise to ObjectId.
        if (OBJECT_ID_HEX.test(raw)) {
            await collection.updateOne(
                { _id: expert._id },
                { $set: { category: new Types.ObjectId(raw) } },
            );
            updated++;
            console.log(`Expert ${expert._id}: normalised string id "${raw}" -> ObjectId`);
            continue;
        }

        unmatchedValues.push(raw || "(empty)");
        console.warn(
            `Expert ${expert._id}: no category match for value "${raw}" — left unchanged.`,
        );
    }

    console.log(
        `Expert category migration done. Total: ${experts.length}, Updated: ${updated}, ` +
            `Already migrated: ${alreadyMigrated}, Unmatched: ${unmatchedValues.length}.`,
    );

    return {
        total: experts.length,
        updated,
        alreadyMigrated,
        unmatched: unmatchedValues.length,
        unmatchedValues,
    };
}
