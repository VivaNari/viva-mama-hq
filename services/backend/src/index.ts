// MUST stay the first import. The OpenTelemetry SDK patches modules as they are required,
// and `./app` below transitively loads express, mongoose, ioredis, axios and
// firebase-admin, while the logger calls pino() at import time. Anything ordered above
// this line is invisible to telemetry. It loads dotenv itself, so it is safe here.
import "./telemetry";

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
