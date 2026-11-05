/**
 * Check whether onboarding-flow-v2 contains the PRD section 1 questions, and take them out.
 *
 * Changes nothing unless --apply is passed. Back up flow_definitions before applying.
 *
 * Run:
 *   npm run migrate:restore-onboarding-v2             # report only
 *   npm run migrate:restore-onboarding-v2 -- --apply  # remove them
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { restore } from "../src/services/migration/steps/restore-onboarding-v2.step";

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
    const apply = process.argv.includes("--apply");
    await mongoose.connect(buildMongoUri());
    console.log(`Connected to database "${mongoose.connection.name}".`);
    console.log("Restore onboarding-flow-v2 result:", await restore({ apply }));
    if (!apply) console.log("Report only. Pass --apply to remove the questions.");
    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error("Restore failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
