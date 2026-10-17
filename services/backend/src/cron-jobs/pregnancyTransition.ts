import UserModel from "../models/user.model";
import { EUserCategory } from "../types/user.types";
import logger, { createModuleLogger } from "../utils/logger";
import { getEndOfISTDay } from "../services/date/date.service";

const log = createModuleLogger(logger, "pregnancyTransition");

export interface IPregnancyTransitionResult {
    transitioned: number;
}

/**
 * Move pregnant (NP) users to postpartum (PP) once their delivery date arrives.
 *
 * Nothing did this before: the only NP -> PP transition was an explicit profile edit,
 * which is itself blocked for PP users. A woman who delivered stayed NP forever, and the
 * week job's `user_category != "NP"` filter meant she never progressed a week or received
 * a single check-in.
 *
 * Runs just before `weekProgression` so the same night's run already treats her as
 * postpartum. Idempotent — it only ever matches users still marked NP.
 */
export const pregnancyTransition = async (
    now: Date = new Date(),
): Promise<IPregnancyTransitionResult> => {
    log.info("Starting pregnancy -> postpartum transition job");

    try {
        // Exclusive upper bound on the real instant the IST day ends, NOT the
        // UTC-midnight marker for today. Delivery dates are stored with whatever
        // time-of-day they were captured at, so comparing against the marker missed
        // everyone whose timestamp fell later than 00:00 UTC on their due date — which is
        // most of them.
        const endOfToday = getEndOfISTDay(now);

        const result = await UserModel.updateMany(
            {
                user_category: EUserCategory.NP,
                "onboarding_data.delivery_date": { $ne: null, $lt: endOfToday },
            },
            { $set: { user_category: EUserCategory.PP } },
        );

        const transitioned = result.modifiedCount ?? 0;

        log.info({ transitioned }, "Pregnancy -> postpartum transition job completed");

        return { transitioned };
    } catch (error) {
        log.error({ error }, "Pregnancy -> postpartum transition job failed");
        throw error;
    }
};
