import cron from "node-cron";
import { pregnancyTransition } from "./pregnancyTransition";
import { weekProgression } from "./weekProgression";
import { checkinNotification } from "./checkinNotification";
import { logsReminders } from "./logsReminders";
import { dailyVivaInteraction } from "./dailyVivaInteraction";
import { weeklyContentNotification } from "./weeklyContentNotification";
import { subscriptionLifecycle } from "./subscriptionLifecycle";
import { consultationReminders } from "./consultationReminders";
import { randomUUID } from "crypto";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import env from "../config/env";
import logger, { createModuleLogger, createWorkerLogger } from "../utils/logger";
import { runWithContext } from "../utils/asyncLocalStorage";

const log = createModuleLogger(logger, "cron-scheduler");
const tracer = trace.getTracer("cron-jobs");

/**
 * Schedules are expressed in IST, matching Cloud Scheduler's timezone in prod. The jobs
 * themselves compute from IST calendar days regardless of when they fire, so a late or
 * repeated run changes freshness, never correctness.
 */
const IST_TIMEZONE = "Asia/Kolkata";

export const initScheduledJobs = () => {
    // In prod/uat these jobs are driven by Cloud Scheduler hitting the HTTP
    // endpoints at /api/v1/internal/jobs/* — in-process node-cron does not fire
    // reliably on Cloud Run (the instance scales to zero between requests, and
    // multiple instances would each run their own copy). Only enable the
    // in-process scheduler for local development.
    if (!env.ENABLE_IN_PROCESS_CRON) {
        log.info("In-process cron disabled; jobs are driven by Cloud Scheduler");
        return;
    }

    log.info("In-process cron enabled (development mode)");

    // Each tick runs inside its own correlation context and span. A cron tick has no
    // ambient request to inherit from, so without this every line a job logs — and there
    // are many — arrives at the collector with no id tying it to the run that produced it,
    // and two overlapping jobs interleave indistinguishably.
    const schedule = (expression: string, job: () => Promise<unknown>, name: string) =>
        cron.schedule(
            expression,
            () => {
                const jobId = randomUUID();
                const jobLog = createWorkerLogger(logger, name, jobId);

                void runWithContext({ correlationId: jobId, jobName: name }, () =>
                    tracer.startActiveSpan(`cron ${name}`, async (span) => {
                        const startedAt = Date.now();
                        try {
                            await job();
                            jobLog.info({ durationMs: Date.now() - startedAt }, "Scheduled job completed");
                        } catch (error) {
                            span.recordException(error as Error);
                            span.setStatus({ code: SpanStatusCode.ERROR });
                            jobLog.error(
                                { error, name, durationMs: Date.now() - startedAt },
                                "Scheduled job failed",
                            );
                        } finally {
                            span.end();
                        }
                    }),
                );
            },
            { timezone: IST_TIMEZONE },
        );

    // 00:05 — flip NP users to PP once their delivery date arrives, so the week job
    // below already sees them as postpartum on the same night.
    schedule("5 0 * * *", pregnancyTransition, "pregnancy-transition");

    // 00:15 — advance everyone's week and open the current week's check-in. No pushes.
    schedule("15 0 * * *", weekProgression, "week-progression");

    // 18:00 — nudge open, unfinished check-ins. Deliberately hours after the rollover.
    schedule("0 18 * * *", checkinNotification, "checkin-notification");

    // 10:00 — mood/sleep log reminders.
    schedule("0 10 * * *", logsReminders, "logs-reminders");

    // 09:00 — daily Viva interaction prompt.
    schedule("0 9 * * *", dailyVivaInteraction, "daily-viva-interaction");

    // Sundays 10:00 — weekly content digest.
    schedule("0 10 * * 0", weeklyContentNotification, "weekly-content-notification");

    // 02:00 — retire lapsed trials and terms, expire unconsumed credits, send boundary
    // reminders. Access control does not depend on this running; see subscriptionLifecycle.ts.
    schedule("0 2 * * *", subscriptionLifecycle, "subscription-lifecycle");

    // Every 5 minutes — pre-call reminders at 1 hour and 15 minutes before a confirmed
    // consultation. The only sub-daily job here: the 15-minute reminder cannot be served
    // by a job that wakes once a day, and the interval is what bounds how late a
    // reminder can be. See consultationReminders.ts.
    // To fire it on demand rather than waiting for a tick, run
    // `npm run job:consultation-reminders`. Pinning this expression to a chosen minute
    // is not a reliable way to test: the schedule is read once at startup, so an edit
    // only takes effect after a restart, and a run landing exactly on T-15 sits on the
    // boundary of "not yet due".
    schedule("*/5 * * * *", consultationReminders, "consultation-reminders");
};
