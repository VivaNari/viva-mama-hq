import { Request, Response } from "express";
import logger from "../../../../utils/logger";
import { logsReminders } from "../../../../cron-jobs/logsReminders";
import { dailyVivaInteraction } from "../../../../cron-jobs/dailyVivaInteraction";
import { weeklyContentNotification } from "../../../../cron-jobs/weeklyContentNotification";
import { pregnancyTransition } from "../../../../cron-jobs/pregnancyTransition";
import { weekProgression } from "../../../../cron-jobs/weekProgression";
import { checkinNotification } from "../../../../cron-jobs/checkinNotification";
import { subscriptionLifecycle } from "../../../../cron-jobs/subscriptionLifecycle";
import { consultationReminders } from "../../../../cron-jobs/consultationReminders";

/**
 * HTTP entrypoints for the scheduled jobs, invoked by Cloud Scheduler.
 *
 * Each handler awaits the underlying job so the Cloud Run instance (and its CPU)
 * stays alive for the whole run — returning before completion would let Cloud Run
 * reap the scaled-to-zero instance and drop in-flight work. Auth is enforced
 * upstream by cloudSchedulerMiddleware on the route.
 *
 * The job functions own their try/catch and never throw, but we still wrap each
 * call defensively so an unexpected error surfaces as a 500 to Cloud Scheduler
 * (which will then retry per its retry_config).
 */
const runJob = async (
    res: Response,
    jobName: string,
    job: () => Promise<unknown>,
): Promise<void> => {
    const startedAt = Date.now();
    try {
        logger.info({ jobName }, "Cron endpoint invoked");
        const result = await job();
        res.status(200).json({
            success: true,
            job: jobName,
            durationMs: Date.now() - startedAt,
            result: result ?? null,
        });
    } catch (error: any) {
        logger.error({ error, jobName }, "Cron endpoint failed");
        res.status(500).json({
            success: false,
            job: jobName,
            durationMs: Date.now() - startedAt,
            error: error?.message ?? String(error),
        });
    }
};

export const runLogsReminders = (_req: Request, res: Response): Promise<void> =>
    runJob(res, "logs-reminders", logsReminders);

export const runDailyVivaInteraction = (_req: Request, res: Response): Promise<void> =>
    runJob(res, "daily-viva-interaction", dailyVivaInteraction);

export const runWeeklyContentNotification = (_req: Request, res: Response): Promise<void> =>
    runJob(res, "weekly-content-notification", weeklyContentNotification);

export const runPregnancyTransition = (_req: Request, res: Response): Promise<void> =>
    runJob(res, "pregnancy-transition", () => pregnancyTransition());

export const runWeekProgression = (_req: Request, res: Response): Promise<void> =>
    runJob(res, "week-progression", () => weekProgression());

export const runCheckinNotification = (_req: Request, res: Response): Promise<void> =>
    runJob(res, "checkin-notification", () => checkinNotification());

export const runSubscriptionLifecycle = (_req: Request, res: Response): Promise<void> =>
    runJob(res, "subscription-lifecycle", () => subscriptionLifecycle());

export const runConsultationReminders = (_req: Request, res: Response): Promise<void> =>
    runJob(res, "consultation-reminders", () => consultationReminders());
