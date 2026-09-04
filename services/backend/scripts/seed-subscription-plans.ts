/**
 * Seed the four subscription plans (Lite ₹299 / Monthly ₹999 / Quarterly ₹2,799 /
 * Half-yearly ₹3,999) into `subscription_plans`.
 *
 * Idempotent — upserts on `code`, so re-running is safe and never overwrites a price
 * an operator has edited in the database (the step is insert-only).
 *
 * This is the standalone equivalent of the `seed-subscription-plans` migration step;
 * it exists so the catalog can be populated with a plain command, without going through
 * the OIDC-guarded /admin/migrate endpoint.
 *
 * Run:  npx ts-node scripts/seed-subscription-plans.ts
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { migrate } from "../src/services/migration/steps/seed-subscription-plans.step";

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
    console.log("Seed result:", result);
    await mongoose.disconnect();
    console.log("Disconnected.");
}

run().catch(async (err) => {
    console.error("Seed failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
