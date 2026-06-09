import mongoose from "mongoose";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import UserModel from "../src/models/user.model";
import recommendationHistoryModel from "../src/models/recommendation-history.model";

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

async function exportData() {
    try {
        const uri = buildMongoUri();
        console.log("Connecting to MongoDB...");
        await mongoose.connect(uri);
        console.log("Connected successfully.");

        console.log("Fetching users...");
        const users = await UserModel.find().lean();
        
        console.log(`Found ${users.length} users. Fetching recommendations...`);
        const exportsData: any[] = [];
        
        for (const user of users) {
            const latestRec = await recommendationHistoryModel
                .findOne({ userId: user._id })
                .sort({ createdAt: -1 })
                .lean();

            const row: any = {
                _id: user._id?.toString(),
                user_id: user.user_id,
            };

            // Flatten onboarding_data
            if (user.onboarding_data) {
                for (const [key, value] of Object.entries(user.onboarding_data)) {
                    if (Array.isArray(value)) {
                        row[key] = value.join(", ");
                    } else if (value instanceof Date) {
                        row[key] = value.toISOString();
                    } else {
                        row[key] = value;
                    }
                }
            }

            // Recommendation data
            if (latestRec) {
                row.finalScore = latestRec.finalScore;
                row.zone = latestRec.zone;
                row.week = latestRec.week;

                if (Array.isArray(latestRec.checkinAnswersDump)) {
                    for (const qa of latestRec.checkinAnswersDump) {
                        row[`Question: ${qa.question}`] = qa.answer;
                    }
                }
            }

            exportsData.push(row);
        }

        const exportsDir = path.join(__dirname, "../exports");
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
        }

        // Write JSON
        const jsonPath = path.join(exportsDir, "user_data_export.json");
        fs.writeFileSync(jsonPath, JSON.stringify(exportsData, null, 2), "utf-8");
        console.log(`JSON exported to ${jsonPath}`);

        // Write CSV
        if (exportsData.length > 0) {
            // Get all unique keys for header
            const keysSet = new Set<string>();
            exportsData.forEach(row => {
                Object.keys(row).forEach(k => keysSet.add(k));
            });
            const headers = Array.from(keysSet);

            const csvRows = [];
            // Header row
            csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(","));

            // Data rows
            for (const row of exportsData) {
                const values = headers.map(header => {
                    let val = row[header];
                    if (val === null || val === undefined) {
                        val = "";
                    }
                    const strVal = String(val).replace(/"/g, '""');
                    return `"${strVal}"`;
                });
                csvRows.push(values.join(","));
            }

            const csvPath = path.join(exportsDir, "user_data_export.csv");
            fs.writeFileSync(csvPath, csvRows.join("\n"), "utf-8");
            console.log(`CSV exported to ${csvPath}`);
        }

        console.log("Export complete!");
    } catch (err) {
        console.error("Error exporting data:", err);
    } finally {
        await mongoose.disconnect();
    }
}

exportData();
