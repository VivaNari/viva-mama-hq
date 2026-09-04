import { Router } from "express";
import cloudSchedulerMiddleware from "../../../../middlewares/cloudScheduler.middleware";
import {
    runLogsReminders,
    runDailyVivaInteraction,
    runWeeklyContentNotification,
    runPregnancyTransition,
    runWeekProgression,
    runCheckinNotification,
    runSubscriptionLifecycle,
    runConsultationReminders,
} from "../../controllers/cron-jobs/cron-jobs.controller";

/**
 * Internal cron-job endpoints driven by Google Cloud Scheduler.
 *
 * Mounted at /api/v1/internal/jobs. Every route is gated by
 * cloudSchedulerMiddleware (OIDC verification, with a dev-only secret bypass).
 */
const cronJobsRouter = Router();

cronJobsRouter.use(cloudSchedulerMiddleware);

cronJobsRouter.post("/logs-reminders", runLogsReminders);
cronJobsRouter.post("/daily-viva-interaction", runDailyVivaInteraction);
cronJobsRouter.post("/weekly-content-notification", runWeeklyContentNotification);
// Ordered as they run nightly: transition, then week rollover, then the evening nudge.
cronJobsRouter.post("/pregnancy-transition", runPregnancyTransition);
cronJobsRouter.post("/week-progression", runWeekProgression);
cronJobsRouter.post("/checkin-notification", runCheckinNotification);
cronJobsRouter.post("/subscription-lifecycle", runSubscriptionLifecycle);
// The only sub-daily schedule: every 5 minutes, for the 1-hour and 15-minute pre-call
// reminders. Needs its own Cloud Scheduler entry per environment.
cronJobsRouter.post("/consultation-reminders", runConsultationReminders);

export default cronJobsRouter;
