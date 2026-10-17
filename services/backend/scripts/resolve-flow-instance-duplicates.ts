/**
 * Remove the duplicate flow_instances that block the unique index.
 *
 * DRY RUN BY DEFAULT — prints exactly what it would delete and deletes nothing.
 * Pass --apply to actually remove the rows.
 *
 *   npm run migrate:resolve-flow-instance-duplicates            # report only
 *   npm run migrate:resolve-flow-instance-duplicates -- --apply # delete
 *
 * Run this BEFORE migrate:reindex-flow-instances-subject, which cannot build the unique
 * index while duplicates exist. See the step's doc comment for how a survivor is chosen.
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { migrate } from "../src/services/migration/steps/resolve-flow-instance-duplicates.step";

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
    const uri = buildMongoUri();

    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri);
    console.log(`Connected to ${uri.replace(/\/\/[^@]*@/, "//***:***@")}`);

    const result = await migrate({ apply });
    console.log("Duplicate resolution result:", {
        applied: result.applied,
        groups: result.groups,
        instancesRemoved: result.instancesRemoved,
        responsesRemoved: result.responsesRemoved,
        messagesRemoved: result.messagesRemoved,
    });

    await mongoose.disconnect();
    console.log("Disconnected.");
}

run().catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
