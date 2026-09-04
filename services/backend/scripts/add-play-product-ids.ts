/**
 * Point each subscription plan at its Google Play Console product and base plan.
 *
 * Safe to re-run: the step writes only where `playProductId` is still null, so an id an
 * operator corrected by hand is never overwritten. It also asserts the Play products are
 * distinct before writing anything — two plans sharing one product would silently give
 * the cheaper plan's buyers the dearer plan's credits.
 *
 * This is the standalone equivalent of the `add-play-product-ids` migration step; it
 * exists so the mapping can be applied with a plain command, without going through the
 * OIDC-guarded /admin/migrate endpoint (whose `x-cron-secret` bypass is development-only,
 * and whose run-all executes every other step as a side effect).
 *
 * Run:  npx ts-node scripts/add-play-product-ids.ts
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { migrate } from "../src/services/migration/steps/add-play-product-ids.step";

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
    console.log("Play product id mapping result:", result);

    // A non-empty missingPlans means a plan in PLAY_PRODUCTS has no row in the catalog:
    // the seed has not run, or a plan code was renamed. The app would then offer a plan
    // it cannot purchase, so surface it as a failure rather than a line of log output.
    if (result.missingPlans.length > 0) {
        throw new Error(
            `Plans missing from the catalog: ${result.missingPlans.join(", ")}. ` +
                `Run migrate:seed-subscription-plans first.`,
        );
    }

    await mongoose.disconnect();
    console.log("Disconnected.");
}

run().catch(async (err) => {
    console.error("Play product id mapping failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
