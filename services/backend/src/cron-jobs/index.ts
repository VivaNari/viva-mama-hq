import cron from "node-cron";
// import { startOrContinueConversation } from "./startOrContinueConversation";
// import { calculateCurrentPostpartumWeek } from "./calculateCurrentPostpartumWeekForAllUsers";
// import { currentWeekAndPreviousUpcomingDueDaysCalculator } from "./currentWeekAndPreviousUpcomingDueDaysCalculator";
import { logsReminders } from "./logsReminders";
import { dailyVivaInteraction } from "./dailyVivaInteraction";
import { weeklyContentNotification } from "./weeklyContentNotification";

export const initScheduledJobs = () => {
    // cron.schedule("0 8 * * *", () => {
    //     startOrContinueConversation();
    // }); // run at everyday 8AM

    // cron.schedule("*/10 * * * * *", () => {
    //     startOrContinueConversation();
    // }); // run at every 2 minutes for development

    // cron.schedule("0 8 * * *", () => {
    //     console.log("Calculating postpartum weeks for all users...");
    //     calculateCurrentPostpartumWeek();
    // });

    // Calculate the week and update users due days in one cron job
    cron.schedule("*/30 * * * * *", () => {
        // console.log("Calculating current week with the previous and upcoming due days for checkin");
        // currentWeekAndPreviousUpcomingDueDaysCalculator();
        // startCallbackStatusCron();
    });

    // 1. Logs Reminders (Every day at 10:00 AM)
    cron.schedule("0 10 * * *", () => {
        logsReminders();
    });

    // 2. Daily Viva Interaction (Every day at 9:00 AM)
    cron.schedule("0 9 * * *", () => {
        dailyVivaInteraction();
    });

    // 3. Weekly Content Notification (Every Sunday at 10:00 AM)
    cron.schedule("0 10 * * 0", () => {
        weeklyContentNotification();
    });
};
