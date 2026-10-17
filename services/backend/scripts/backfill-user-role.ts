/**
 * Backfill `role: USER` onto every user document created before roles existed.
 *
 * Not strictly required — every read of `role` treats a missing value as USER, and
 * `$ne: SUPER_ADMIN` filters match documents where the field is absent, so the app is
 * correct either way. What this buys is a collection where `role` means something you
 * can query and index on directly: `countDocuments({ role: USER })` currently misses
 * every legacy row, and a future `find({ role: USER })` would silently return nothing
 * for them.
 *
 * Never touches an existing SUPER_ADMIN: the filter only matches documents that have
 * no `role` field at all, so re-running is a no-op and an administrator can never be
 * demoted by it.
 *
 * Run:  npm run migrate:user-role
 *       npm run migrate:user-role -- --dry-run
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import userModel from "../src/models/user.model";
import { EUserRole } from "../src/types";

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
    const dryRun = process.argv.includes("--dry-run");

    console.log("Connecting to MongoDB...");
    await mongoose.connect(buildMongoUri());
    console.log("Connected." + (dryRun ? "  [DRY RUN — nothing will be written]" : ""));

    const collection = userModel.collection;

    // Only documents with no `role` at all. A row that already says USER or
    // SUPER_ADMIN is left exactly as it is.
    const filter = { role: { $exists: false } };

    const [total, pending, admins] = await Promise.all([
        collection.countDocuments({}),
        collection.countDocuments(filter),
        collection.countDocuments({ role: EUserRole.SUPER_ADMIN }),
    ]);

    console.log(`  users total .............. ${total}`);
    console.log(`  already have a role ...... ${total - pending}`);
    console.log(`  missing a role ........... ${pending}`);
    console.log(`  administrators (skipped) . ${admins}`);

    if (pending === 0) {
        console.log("Nothing to backfill.");
        await mongoose.disconnect();
        return;
    }

    if (dryRun) {
        const sample = await collection.find(filter).limit(5).project({ _id: 1 }).toArray();
        console.log("Would set role=USER on, for example: " + sample.map((d) => d._id).join(", "));
        await mongoose.disconnect();
        return;
    }

    // Straight through the driver rather than the ODM: this touches every historical
    // user, and there is no reason to hydrate documents or fire validators to write a
    // single constant field.
    const result = await collection.updateMany(filter, { $set: { role: EUserRole.USER } });
    console.log(`Updated ${result.modifiedCount} document(s).`);

    const remaining = await collection.countDocuments(filter);
    const stillAdmins = await collection.countDocuments({ role: EUserRole.SUPER_ADMIN });
    console.log(`  remaining without a role . ${remaining}`);
    console.log(`  administrators after ..... ${stillAdmins}`);

    if (remaining !== 0) {
        throw new Error(`${remaining} document(s) still have no role`);
    }
    if (stillAdmins !== admins) {
        throw new Error(`administrator count changed: ${admins} -> ${stillAdmins}`);
    }

    await mongoose.disconnect();
    console.log("Disconnected.");
}

run().catch(async (err) => {
    console.error("Backfill failed:", err instanceof Error ? err.message : err);
    await mongoose.disconnect();
    process.exit(1);
});
