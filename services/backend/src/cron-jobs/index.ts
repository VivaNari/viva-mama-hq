import cron from "node-cron";
// import { startOrContinueConversation } from "./startOrContinueConversation";
// import { calculateCurrentPostpartumWeek } from "./calculateCurrentPostpartumWeekForAllUsers";
import { currentWeekAndPreviousUpcomingDueDaysCalculator } from "./currentWeekAndPreviousUpcomingDueDaysCalculator";

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
    cron.schedule("*/3000 * * * * *", () => {
        //console.log("Calculating current week with the previous and upcoming due days for checkin");
        // currentWeekAndPreviousUpcomingDueDaysCalculator();
    });
};
