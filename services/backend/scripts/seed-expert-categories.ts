/**
 * Seed the expert categories (Nutritionist, Lactation Consultant, Gynaecologist,
 * Paediatrician, Psychologist, Psychiatrist, General Physician) into
 * `expert_categories`, each with its covered-areas list.
 *
 * Idempotent — upserts on `key`, so re-running refreshes the content without
 * duplicating rows or changing `_id`s that experts reference.
 *
 * Run this BEFORE migrate-expert-category-to-ref, which maps existing experts'
 * string categories onto these documents' ObjectIds.
 *
 * Run:  npx ts-node scripts/seed-expert-categories.ts
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { migrate } from "../src/services/migration/steps/seed-expert-categories.step";

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
