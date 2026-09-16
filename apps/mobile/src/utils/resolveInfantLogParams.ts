import { getUserData } from "../api/userData.api";
import { IUserDataResponse } from "../types/dashboard.types";
import { InfantLogRouteParams } from "../types/infantLog.types";

/**
 * What the infant log screens need, resolved from a childId the push can carry alone.
 *
 * There is deliberately no "get one child" endpoint (see `apps/mobile/src/api/child.api.ts`'s
 * own comment on why) — `GET /user` is the one place `childs[]` is read from, so a
 * notification tap goes through it too rather than opening a second source that could
 * disagree with the first.
 *
 * Kept out of `RootNavigator.tsx` so it can be unit-tested on its own: that file's own
 * import tree pulls in every screen on `AppStack`, native modules and all.
 */
export const resolveInfantLogParams = async (
    childId: string,
): Promise<InfantLogRouteParams | null> => {
    try {
        const response = (await getUserData()) as IUserDataResponse;
        const child = response.data?.user?.childs?.find((candidate) => candidate._id === childId);
        if (!child) return null;

        return {
            childId: child._id,
            childName: child.name,
            childDob: child.date_of_birth ? new Date(child.date_of_birth).toISOString() : undefined,
            childSex: child.sex,
            vaccinationSector: child.vaccination_sector,
        };
    } catch (error) {
        console.log('[resolveInfantLogParams] Failed to resolve child for infant log notification', error);
        return null;
    }
};
