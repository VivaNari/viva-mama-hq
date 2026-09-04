/**
 * Migration: add Hindi (hi) translation bundles to the published onboarding
 * and weekly check-in flow definitions, and resolve the duplicate
 * "weekly-checkin-v1" documents by keeping the newer one (startNodeId "intro")
 * PUBLISHED and ARCHIVING the older one.
 *
 * Idempotent & re-runnable: it $sets `translations.hi` by slug and only
 * archives stale duplicates. Logic/structure fields are never touched.
 *
 * Run:  npx ts-node scripts/add-hindi-translations.ts
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { migrate } from "../src/services/migration/steps/add-hindi-translations.step";

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
    console.log("Done. Disconnected.");
}

run().catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
