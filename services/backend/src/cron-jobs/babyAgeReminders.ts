import { MILESTONE_BAND_WINDOWS, VACCINATION_SCHEDULE_WINDOWS } from "@vivamama/infant-schedules";

import { sectorOf } from "../api/v1/controllers/vaccination-log/vaccination-log.controller";
import {
    getVaccinationDueNotification,
    getMilestoneDueNotification,
} from "../constants/chat";
import milestoneLogModel from "../models/milestone-log.model";
import UserModel from "../models/user.model";
import vaccinationLogModel from "../models/vaccination-log.model";
import { getISTCalendarDate } from "../services/date/date.service";
import { IChild, IPendingMilestoneReminder, IPendingVaccinationReminder } from "../types/user.types";
import { getAgeInMonths, hasVaccinationVisitBecomeDue } from "../utils/functions/babyAgeWindow";
import { resolveLanguage } from "../utils/i18n/localizeFlowDefinition";
import logger, { createModuleLogger } from "../utils/logger";
import { sendPushNotification } from "../utils/sendPushNotification";

const log = createModuleLogger(logger, "babyAgeReminders");

const REMINDER_INTERVAL_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface IBabyAgeRemindersResult {
    childrenScanned: number;
    vaccinationRemindersSent: number;
    milestoneRemindersSent: number;
    errors: number;
}

interface IDueItem {
    key: string;
    unloggedCount: number;
}

/**
 * The add/renew/clear state machine shared by the vaccination and milestone sides,
 * written twice rather than shared behind a generic: `visitKey`/`bandKey` are
 * deliberately distinct field names on the two pending arrays (so a raw document is
 * self-describing without knowing which array it came from), and threading that through a
 * generic buys less clarity than it costs here.
 */
function nextVaccinationPending(
    dateOfBirth: Date | string | null | undefined,
    sector: "public" | "private",
    given: Set<string>,
    pending: IPendingVaccinationReminder[],
    today: Date,
): { pending: IPendingVaccinationReminder[]; due: IDueItem[]; changed: boolean } {
    const byKey = new Map(pending.map((entry) => [entry.visitKey, entry]));
    const nextPending: IPendingVaccinationReminder[] = [];
    const due: IDueItem[] = [];
    // Whether `nextPending` differs from `pending` at all — not just whether anything is
    // due to send today. A visit whose last dose was just logged has nothing to send but
    // must still be written: dropping it from the array IS the change, and gating the
    // write on "anything to send" would leave a satisfied visit pending forever.
    let changed = false;

    for (const visit of VACCINATION_SCHEDULE_WINDOWS[sector]) {
        const unloggedCount = visit.doseKeys.filter((key) => !given.has(key)).length;
        const existing = byKey.get(visit.key);

        // Every dose in this visit is logged — nothing to remind about, and nothing to
        // keep tracking if it was pending before (a late-logged dose clears the nudge).
        if (unloggedCount === 0) {
            if (existing) changed = true;
            continue;
        }

        if (!hasVaccinationVisitBecomeDue(dateOfBirth, visit.due, today)) {
            // Not due yet. Nothing should already be pending — due dates don't reverse —
            // but carry it forward unmodified rather than drop it if one somehow exists.
            if (existing) nextPending.push(existing);
            continue;
        }

        if (!existing) {
            nextPending.push({ visitKey: visit.key, firstDueOn: today, lastRemindedOn: today });
            due.push({ key: visit.key, unloggedCount });
            changed = true;
            continue;
        }

        const daysSinceLastReminder = existing.lastRemindedOn
            ? Math.round((today.getTime() - new Date(existing.lastRemindedOn).getTime()) / MS_PER_DAY)
            : Infinity;

        if (daysSinceLastReminder >= REMINDER_INTERVAL_DAYS) {
            nextPending.push({ ...existing, lastRemindedOn: today });
            due.push({ key: visit.key, unloggedCount });
            changed = true;
        } else {
            nextPending.push(existing);
        }
    }

    return { pending: nextPending, due, changed };
}

/** Same shape as {@link nextVaccinationPending}, for milestone bands instead of visits. */
function nextMilestonePending(
    dateOfBirth: Date | string | null | undefined,
    achieved: Set<string>,
    pending: IPendingMilestoneReminder[],
    today: Date,
): { pending: IPendingMilestoneReminder[]; due: IDueItem[]; changed: boolean } {
    const byKey = new Map(pending.map((entry) => [entry.bandKey, entry]));
    const nextPending: IPendingMilestoneReminder[] = [];
    const due: IDueItem[] = [];
    const ageInMonths = getAgeInMonths(dateOfBirth, today);
    let changed = false;

    for (const band of MILESTONE_BAND_WINDOWS) {
        const unloggedCount = band.milestoneKeys.filter((key) => !achieved.has(key)).length;
        const existing = byKey.get(band.key);

        if (unloggedCount === 0) {
            if (existing) changed = true;
            continue;
        }

        if (ageInMonths === null || ageInMonths < band.ageMonths.from) {
            if (existing) nextPending.push(existing);
            continue;
        }

        if (!existing) {
            nextPending.push({ bandKey: band.key, firstDueOn: today, lastRemindedOn: today });
            due.push({ key: band.key, unloggedCount });
            changed = true;
            continue;
        }

        const daysSinceLastReminder = existing.lastRemindedOn
            ? Math.round((today.getTime() - new Date(existing.lastRemindedOn).getTime()) / MS_PER_DAY)
            : Infinity;

        if (daysSinceLastReminder >= REMINDER_INTERVAL_DAYS) {
            nextPending.push({ ...existing, lastRemindedOn: today });
            due.push({ key: band.key, unloggedCount });
            changed = true;
        } else {
            nextPending.push(existing);
        }
    }

    return { pending: nextPending, due, changed };
}

/**
 * Daily sweep: has a child reached a vaccination visit or milestone band that still has
 * something unlogged in it, and if so, is it time to say so.
 *
 * Recurring rather than one-shot, by design: a due visit/band stays in the child's pending
 * list and is re-notified every `REMINDER_INTERVAL_DAYS` until every dose/milestone in it
 * is logged, at which point it drops out on its own. `lastRemindedOn` is stamped to
 * *today* the same run a reminder sends — including the very first one — which is what
 * makes a same-day re-run of this job inert without needing an atomic claim: the other
 * daily jobs in this file get the same property from running once a day, and this one
 * gets it from the timestamp it writes matching that day exactly.
 *
 * Pending state is written before the push is sent, not after — a push that then fails is
 * lost rather than retried, the same tradeoff `consultationReminders.ts` makes and for the
 * same reason: a missed reminder is cheaper than a duplicate one.
 *
 * Bounded to users who actually have a child, not the full user base — the daily
 * pregnancy/week jobs are bounded the same way, by the field they filter on rather than by
 * an index that does not exist yet.
 */
export const babyAgeReminders = async (
    now: Date = new Date(),
): Promise<IBabyAgeRemindersResult> => {
    log.info("Starting baby age-reminder job");

    const today = getISTCalendarDate(now);
    let childrenScanned = 0;
    let vaccinationRemindersSent = 0;
    let milestoneRemindersSent = 0;
    let errors = 0;

    try {
        const users = await UserModel.find(
            { "childs.0": { $exists: true } },
            { childs: 1, FCM_token: 1, preferred_language: 1 },
        ).lean();

        for (const user of users) {
            for (const child of user.childs as IChild[]) {
                if (!child.date_of_birth || !child._id) continue;

                childrenScanned += 1;

                try {
                    const childId = child._id;

                    const [givenDoses, achievedMilestones] = await Promise.all([
                        vaccinationLogModel
                            .find({ userId: user._id, childId })
                            .select("vaccineKey")
                            .lean(),
                        milestoneLogModel
                            .find({ userId: user._id, childId })
                            .select("milestoneKey")
                            .lean(),
                    ]);

                    const given = new Set(givenDoses.map((entry) => entry.vaccineKey));
                    const achieved = new Set(achievedMilestones.map((entry) => entry.milestoneKey));

                    const vaccination = nextVaccinationPending(
                        child.date_of_birth,
                        sectorOf(child),
                        given,
                        child.pending_vaccination_reminders ?? [],
                        today,
                    );
                    const milestone = nextMilestonePending(
                        child.date_of_birth,
                        achieved,
                        child.pending_milestone_reminders ?? [],
                        today,
                    );

                    if (!vaccination.changed && !milestone.changed) continue;

                    await UserModel.updateOne(
                        { _id: user._id, "childs._id": childId },
                        {
                            $set: {
                                "childs.$.pending_vaccination_reminders": vaccination.pending,
                                "childs.$.pending_milestone_reminders": milestone.pending,
                            },
                        },
                    );

                    if (!user.FCM_token) continue;

                    const lang = resolveLanguage(user.preferred_language);

                    for (const item of vaccination.due) {
                        const copy = getVaccinationDueNotification(lang);
                        await sendPushNotification({
                            token: user.FCM_token,
                            title: copy.title,
                            body: copy.body
                                .replace("{{child_name}}", child.name || "your baby")
                                .replace("{{count}}", String(item.unloggedCount)),
                            data: {
                                type: "VACCINATION_DUE",
                                childId: String(childId),
                                visitKey: item.key,
                            },
                        });
                        vaccinationRemindersSent += 1;
                    }

                    for (const item of milestone.due) {
                        const copy = getMilestoneDueNotification(lang);
                        await sendPushNotification({
                            token: user.FCM_token,
                            title: copy.title,
                            body: copy.body
                                .replace("{{child_name}}", child.name || "your baby")
                                .replace("{{count}}", String(item.unloggedCount)),
                            data: {
                                type: "MILESTONE_DUE",
                                childId: String(childId),
                                bandKey: item.key,
                            },
                        });
                        milestoneRemindersSent += 1;
                    }
                } catch (error: any) {
                    errors += 1;
                    log.error(
                        { error: error?.message, userId: user._id, childId: child._id },
                        "Failed to process baby age reminders for child",
                    );
                }
            }
        }

        log.info(
            { childrenScanned, vaccinationRemindersSent, milestoneRemindersSent, errors },
            "Baby age-reminder job completed",
        );

        return { childrenScanned, vaccinationRemindersSent, milestoneRemindersSent, errors };
    } catch (error) {
        log.error({ error }, "Baby age-reminder job failed");
        throw error;
    }
};
