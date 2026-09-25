import * as dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { migrate } from "../src/services/migration/steps/add-expert-referral-codes.step";

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/viva_mama";

async function run() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");

    try {
        const result = await migrate();
        console.log("Migration result:", result);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }

    await mongoose.disconnect();
    console.log("Disconnected.");
    process.exit(0);
}

run();
