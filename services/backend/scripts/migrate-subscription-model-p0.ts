/**
 * Run the P0 subscription-model migration standalone.
 *
 * Brings existing documents up to the subscription-redesign schema:
 *   1. contents.category      string -> [string]
 *   2. products.userCategory  string -> [string]
 *   3. contents.contentGroup / sortOrder / isFreeOverride  (new fields)
 *   4. users.subscription     legacy sub-doc -> tier snapshot
 *
 * Idempotent and re-runnable — a second run finds nothing left to convert.
 *
 * NOTE: step 3 fills `contentGroup` by a crude heuristic (a VIDEO body => GLOBAL_HEALTH,
 * everything else => WEEKLY_RECOVERY). That is a STARTING POINT, not correct
 * classification — content-ops must still review each article and set `contentGroup`
 * and `sortOrder` by hand before the free tier is trustworthy.
 *
 * Run:  npx ts-node scripts/migrate-subscription-model-p0.ts
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { migrate } from "../src/services/migration/steps/subscription-model-p0.step";

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
    console.log("Migration result:", JSON.stringify(result, null, 2));
    await mongoose.disconnect();
    console.log("Disconnected.");
}

run().catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
