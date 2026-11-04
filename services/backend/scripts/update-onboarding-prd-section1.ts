/**
 * Bring the published onboarding flow up to PRD section 1: new intro, name and parity
 * wording, plus the ABHA, weight, height, care model, care facility, health history and
 * pregnancy count questions.
 *
 * Run this only after the app build that understands these nodes has been adopted. An
 * older build shows them as plain text boxes with no units, upload or Skip.
 *
 * Idempotent — safe to re-run. Run it AFTER add-hindi-translations, which rewrites
 * `translations.hi` wholesale. See the step's doc comment.
 *
 * Run:  npm run migrate:update-onboarding-prd-section1
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { migrate } from "../src/services/migration/steps/update-onboarding-prd-section1.step";

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
    console.log("Onboarding PRD section 1 result:", result);
    await mongoose.disconnect();
    console.log("Disconnected.");
}

run().catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
