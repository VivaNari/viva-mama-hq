/**
 * Migration: add Hindi (hi) translation bundles to expert documents, matched by
 * `_id`. Translates `name` (transliterated to Devanagari) and `speciality`.
 * `qualification` / `bio` are null in the source data and are omitted (they fall
 * back to the base value if/when populated).
 *
 * Idempotent & re-runnable: it $sets `translations.hi` per matched expert and
 * never touches structural fields (photograph, remuneration, etc.).
 *
 * Run:  npx ts-node scripts/add-hindi-experts.ts
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { migrate } from "../src/services/migration/steps/add-hindi-experts.step";

const buildMongoUri = () => {
    const {
        MONGO_URI,
        MONGODB_HOST,
        MONGODB_PORT,
        MONGODB_USERNAME,
        MONGODB_PASSWORD,
        MONGODB_DATABASE,
    } = process.env;
    if (MONGO_URI) return MONGO_URI;
    const username = encodeURIComponent(MONGODB_USERNAME || "");
    const password = encodeURIComponent(MONGODB_PASSWORD || "");
    const host = MONGODB_HOST || "localhost";
    const port = MONGODB_PORT || "27017";
    const database = MONGODB_DATABASE || "viva_mama";
    if (username && password) {
        return `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=admin`;
    }
    return `mongodb://${host}:${port}/${database}`;
};

async function run() {
    const uri = buildMongoUri();
    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri);
    console.log("Connected.");
    await migrate();
    await mongoose.disconnect();
    console.log("Disconnected.");
}

run().catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
