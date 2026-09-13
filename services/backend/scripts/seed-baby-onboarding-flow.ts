/**
 * Seed the `baby-onboarding-v1` flow definition — the per-child onboarding questionnaire
 * that runs through ChatWithVivaAI on the same guided-flow engine as the mother flows.
 *
 * The document is upserted and then edited in place on re-runs — no version bump — so
 * baby onboardings already in progress are not stranded on an archived definition.
 *
 * Run reindex-flow-instances-subject BEFORE this one: without the widened unique index a
 * mother cannot add a second child. See that step's doc comment.
 *
 * Idempotent — safe to re-run; a second run re-applies the copy and Hindi and creates
 * nothing.
 *
 * Run:  npm run migrate:seed-baby-onboarding-flow
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { migrate } from "../src/services/migration/steps/seed-baby-onboarding-flow.step";

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
    const result = await migrate();
    console.log("Baby onboarding flow result:", result);
    await mongoose.disconnect();
    console.log("Disconnected.");
}

run().catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
