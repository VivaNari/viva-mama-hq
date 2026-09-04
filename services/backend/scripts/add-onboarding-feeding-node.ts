/**
 * Insert the "feeding" question ("How are you feeding your baby right now?") into the
 * published onboarding flow, directly after `delivery_outcome`.
 *
 * The document is edited in place — no version bump — so onboarding sessions already in
 * progress are not stranded on an archived definition. Who sees the question is decided
 * in code (ChatFlowService.findNextValidNode), not here.
 *
 * Idempotent — safe to re-run; a second run inserts nothing and re-applies only the
 * Hindi, which matters because add-hindi-translations rewrites `translations.hi`
 * wholesale. Run this AFTER that one. See the step's doc comment.
 *
 * Run:  npm run migrate:add-onboarding-feeding-node
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { migrate } from "../src/services/migration/steps/add-onboarding-feeding-node.step";

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
    console.log("Feeding node result:", result);
    await mongoose.disconnect();
    console.log("Disconnected.");
}

run().catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
