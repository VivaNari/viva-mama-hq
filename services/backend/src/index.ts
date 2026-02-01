import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import env from "./config/env";
import connectDb from "./config/db";
import { initScheduledJobs } from "./cron-jobs";
import RedisSubscriberService from "./services/redis/redis-subscriber.service";

const startServer = async () => {
    try {
        app.listen(env.PORT, "0.0.0.0", async () => {
            console.log("info", `\x1b[33m \x1b[1m Server is running on port ${env.PORT} \x1b[0m`);
            await connectDb();
            await RedisSubscriberService.initialize();
            initScheduledJobs();
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};
startServer();
