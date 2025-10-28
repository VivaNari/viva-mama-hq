import cron from "node-cron";
import { startOrContinueConversation } from "./startOrContinueConversation";

export const initScheduledJobs = () => {
    // cron.schedule("0 8 * * *", () => {
    //     startOrContinueConversation();
    // }); // run at everyday 8AM

    cron.schedule("*/60 * * * * *", () => {
        startOrContinueConversation();
    }); // run at every 2 minutes for dvelopment
};
