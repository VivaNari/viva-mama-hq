/**
 * Rebrand the flow intro greetings from "postpartum care assistant" to "perinatal care
 * assistant", in English and Hindi, for both `onboarding-flow-v2` and `weekly-checkin-v1`.
 *
 * VivaMama serves pregnant users too, so the old greeting named a phase many users have
 * not reached. Scope is the identity phrase on the intro node only — every other use of
 * "postpartum" in these documents is clinical and is left alone.
 *
 * Idempotent — safe to re-run; matches on the phrase, so it is a no-op once applied.
 * Run this AFTER add-hindi-translations, which rewrites `translations.hi` wholesale.
 *
 * Run:  npm run migrate:rebrand-perinatal-flow-copy
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { migrate } from "../src/services/migration/steps/rebrand-perinatal-flow-copy.step";

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
    console.log("Rebrand result:", result);
    await mongoose.disconnect();
    console.log("Disconnected.");
}

run().catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
