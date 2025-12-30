// import cron from "node-cron";
import callbackRequestModel from "../models/callback-request.model";

/**
 * Runs every hour
 * Checks callback requests older than 72 hours
 * Marks them as UNHANDLED if still PENDING
 */
export const startCallbackStatusCron = async () => {
    // cron.schedule("0 * * * *", async () => {
    try {
        const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
        console.log("[CRON] Starting callback cleanup for requests older than 72 hours");
        const result = await callbackRequestModel.updateMany(
            {
                requestStatus: "PENDING",
                requestedAt: { $lte: seventyTwoHoursAgo },
            },
            {
                $set: { requestStatus: "UNHANDLED" },
            },
        );

        console.log(`[CRON] Callback cleanup completed. Updated: ${result.modifiedCount}`);
    } catch (error) {
        console.error("[CRON] Callback cleanup failed", error);
    }
    // });
};
