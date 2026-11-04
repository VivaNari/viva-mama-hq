import UserModel from "../../models/user.model";
import { deriveRiskFlags } from "../../utils/functions/deriveRiskFlags";
import logger, { createModuleLogger } from "../../utils/logger";

const log = createModuleLogger(logger, "risk-flags");

/**
 * Recompute and store her risk flags. Deliberately non-fatal: a flag that could not be
 * saved must never stop her finishing onboarding or saving her profile. The next save
 * recomputes it.
 */
export const refreshRiskFlags = async (userId: string): Promise<void> => {
    try {
        const user = await UserModel.findById(userId)
            .select("user_category onboarding_data")
            .lean();
        if (!user) return;

        await UserModel.updateOne(
            { _id: userId },
            { $set: { "onboarding_data.risk_flags": deriveRiskFlags(user as any) } },
        );
    } catch (error) {
        log.error({ userId, error }, "Failed to refresh risk flags");
    }
};
