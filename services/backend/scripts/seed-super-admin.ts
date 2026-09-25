/**
 * Create or rotate the SUPER_ADMIN account used by the admin panel.
 *
 * Idempotent — upserts on `email`, so re-running rotates the password on the existing
 * account rather than creating a second administrator.
 *
 * Run:
 *   SUPER_ADMIN_EMAIL=ops@vivamama.app SUPER_ADMIN_PASSWORD='...' npm run seed:super-admin
 *
 * The credentials are read from the environment and never logged. They are seed-time
 * only — deliberately absent from src/config/env.ts, which the running server imports
 * and which would then demand them in production.
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import userModel from "../src/models/user.model";
import { EUserRole } from "../src/types";
import { ADMIN_PASSWORD_SALT_ROUNDS } from "../src/services/admin/admin-auth.service";

const MIN_PASSWORD_LENGTH = 12;

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
    const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ?? "admin@vivamama.in";
    const password = process.env.SUPER_ADMIN_PASSWORD ?? "Pa$$w0rd@vivamamaadmin";

    if (!email) {
        throw new Error("SUPER_ADMIN_EMAIL is required");
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(
            `SUPER_ADMIN_PASSWORD is required and must be at least ${MIN_PASSWORD_LENGTH} characters`,
        );
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(buildMongoUri());
    console.log("Connected.");

    const hash = await bcrypt.hash(password, ADMIN_PASSWORD_SALT_ROUNDS);

    const existing = await userModel.findOne({ email });

    if (existing && existing.role !== EUserRole.SUPER_ADMIN) {
        // Someone already signed up with this address through the app. Promoting a
        // real patient's account would hand an administrator their consultations,
        // subscription and children — refuse and let a human pick another address.
        throw new Error(
            `A non-admin user already exists with ${email} (${existing._id}). ` +
                `Refusing to promote it. Use a dedicated staff address.`,
        );
    }

    if (existing) {
        // A rotation, not a creation.
        existing.set({ password: hash, role: EUserRole.SUPER_ADMIN });
        await existing.save();
        console.log(`Rotated password for existing administrator ${existing._id} (${email}).`);
    } else {
        // Goes through the document constructor rather than an upsert so the
        // mongoose-sequence plugin assigns a user_id like it does for every other doc.
        const created = await userModel.create({
            email,
            password: hash,
            role: EUserRole.SUPER_ADMIN,
        });
        console.log(`Created administrator ${created._id} (${email}).`);
    }

    await mongoose.disconnect();
    console.log("Disconnected.");
}

run().catch(async (err) => {
    console.error("Seed failed:", err instanceof Error ? err.message : err);
    await mongoose.disconnect();
    process.exit(1);
});
