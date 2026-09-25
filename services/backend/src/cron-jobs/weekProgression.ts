import flowDefinitionModel from "../models/flowDefinition.model";
import flowInstanceModel from "../models/flowInstance.model";
import UserModel from "../models/user.model";

import { WEEKLY_CHECKIN_SLUG } from "../constants/chat";
import { entitlementService } from "../services/entitlements/entitlement.service";
import { getOrCreateFlowConversation } from "../services/chat-system/flow-conversation.service";
import { FlowInstanceStateEnum, IFlowDefinition } from "../types/chat.types";
import { ESubscriptionTier } from "../types/subscription.types";
import { EUserCategory } from "../types/user.types";
import { IUser } from "../types";
import {
    calculatePostpartumState,
    isCheckinEligibleWeek,
    toCurrentWeekdaysUpdate,
    IPostpartumState,
} from "../utils/functions/postpartumWeek";
import logger, { createModuleLogger } from "../utils/logger";

const log = createModuleLogger(logger, "weekProgression");

export interface IWeekProgressionResult {
    processed: number;
    skipped: number;
    errors: number;
    instancesCreated: number;
    instancesExpired: number;
}

/**
 * Ensure the weekly check-in exists for the week the user is currently in.
 *
 * Race-safe by construction: the unique index on
 * (userId, flowSlug, postpartumWeek) means a concurrent run — Cloud Scheduler retries on
 * 500 — loses the insert with E11000 rather than creating a duplicate.
 */
const ensureCheckinForWeek = async (
    user: IUser,
    week: number,
    flowDefinition: IFlowDefinition,
): Promise<boolean> => {
    const existing = await flowInstanceModel.findOne({
        userId: user._id,
        flowSlug: WEEKLY_CHECKIN_SLUG,
        postpartumWeek: week,
    });

    if (existing) return false;

    const conversation = await getOrCreateFlowConversation(user, WEEKLY_CHECKIN_SLUG);

    try {
        await flowInstanceModel.create({
            userId: user._id,
            conversationId: conversation._id,
            flowDefId: flowDefinition._id,
            flowSlug: WEEKLY_CHECKIN_SLUG,
            version: flowDefinition.version,
            postpartumWeek: week,
            // PENDING until she opens it; the notification job looks for exactly this.
            state: FlowInstanceStateEnum.PENDING,
            cursorNodeId: flowDefinition.startNodeId,
            variables: {},
            outcome: null,
        });

        log.info({ userId: user._id, week }, "Opened weekly check-in");
        return true;
    } catch (error: any) {
        // A parallel run won the insert. Not an error.
        if (error?.code === 11000) return false;
        throw error;
    }
};

/**
 * Close out check-ins whose week has passed.
 *
 * Expiry used to be applied lazily, only when a user happened to open the flow, so
 * abandoned rows sat PENDING forever and were rescanned by every notification run.
 *
 * PENDING (never opened) closes the moment its week ends. ACTIVE — she has answered at
 * least one question — is left alone for an extra week, because this job runs at 00:15
 * and expiring ACTIVE on the boundary would destroy a conversation someone was in the
 * middle of: her next answer would come back "this check-in has expired" with her partial
 * answers stranded.
 *
 * The real bound on finishing is tighter than the week of slack here: validation.service
 * independently rejects answers more than CHECKIN_EXPIRY_DAYS after the instance was
 * created. That is deliberate — this grace exists to save an in-flight conversation
 * (minutes), not to open a backfill window. The dashboard still only ever offers the
 * current week.
 */
const expirePastCheckins = async (user: IUser, currentWeek: number): Promise<number> => {
    const result = await flowInstanceModel.updateMany(
        {
            userId: user._id,
            flowSlug: WEEKLY_CHECKIN_SLUG,
            $or: [
                {
                    state: FlowInstanceStateEnum.PENDING,
                    postpartumWeek: { $lt: currentWeek },
                },
                {
                    state: FlowInstanceStateEnum.ACTIVE,
                    postpartumWeek: { $lt: currentWeek - 1 },
                },
            ],
        },
        { $set: { state: FlowInstanceStateEnum.EXPIRED, cursorNodeId: null } },
    );

    return result.modifiedCount ?? 0;
};

const persistWeekdays = async (user: IUser, state: IPostpartumState): Promise<void> => {
    await UserModel.updateOne({ _id: user._id }, { $set: toCurrentWeekdaysUpdate(state) });
};

/**
 * Advance every user's week and open the current week's check-in.
 *
 * Deliberately does NOT send notifications — that is `checkinNotification`, so the week
 * can roll over at midnight while the nudge goes out in the evening.
 *
 * Deliberately does NOT filter on FCM_token. Gating week math on push delivery meant a
 * user who declined notifications had a frozen week, a permanently-enabled check-in
 * button (`upcoming_checkin_due_days` stuck at its default of 0) and frozen week-scoped
 * content.
 *
 * Every value is recomputed from `delivery_date`, so running this twice, late, or not at
 * all for three days all converge on the same result.
 */
export const weekProgression = async (now: Date = new Date()): Promise<IWeekProgressionResult> => {
    log.info("Starting week progression job");

    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let instancesCreated = 0;
    let instancesExpired = 0;

    try {
        const flowDefinition = await flowDefinitionModel.findOne({
            slug: WEEKLY_CHECKIN_SLUG,
            status: "PUBLISHED",
        });

        if (!flowDefinition) {
            log.error("Weekly check-in flow definition not found; weeks will still advance");
        }

        const users = await UserModel.find({
            "onboarding_data.delivery_date": { $exists: true, $ne: null },
        });

        log.info({ userCount: users.length }, "Processing users for week progression");

        for (const user of users) {
            try {
                const state = calculatePostpartumState(
                    user.onboarding_data.delivery_date as Date,
                    now,
                );

                await persistWeekdays(user, state);
                processed++;

                if (state.mode !== "postpartum") continue;

                instancesExpired += await expirePastCheckins(user, state.weeks);

                // Check-ins are for postpartum women only. An NN user (never pregnant)
                // can still carry an old delivery_date, and gating purely on the date
                // would have opened check-ins — and sent notifications — for her.
                if (user.user_category !== EUserCategory.PP) continue;

                // Check-ins require a finished questionnaire (the flow reads answers from
                // it) and a published definition.
                if (!user.is_onboarded?.is_questionnaire_completed || !flowDefinition) continue;

                if (!isCheckinEligibleWeek(state)) continue;

                // FREE has no check-in entitlement, so creating the instance would only
                // produce a row nobody can ever open. resolveTier is date-lazy, so this
                // does not depend on the subscription lifecycle cron having run.
                const tier = entitlementService.resolveTier(user, now);
                if (tier === ESubscriptionTier.FREE) continue;

                if (await ensureCheckinForWeek(user, state.weeks, flowDefinition)) {
                    instancesCreated++;
                }
            } catch (error: any) {
                errors++;
                log.error(
                    { error: error?.message, userId: user._id },
                    "Failed to progress week for user",
                );
            }
        }

        skipped = users.length - processed - errors;

        log.info(
            { processed, skipped, errors, instancesCreated, instancesExpired },
            "Week progression job completed",
        );

        return { processed, skipped, errors, instancesCreated, instancesExpired };
    } catch (error) {
        log.error({ error }, "Week progression job failed");
        throw error;
    }
};
