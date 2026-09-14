import { API_MILESTONE_LOGS } from '../constants/endpoints';
import { IMilestoneLog } from '../types/milestoneLog.types';
import apiClientInterceptor from './apiClientInterceptor';

/**
 * Developmental milestone logs.
 *
 * No try/catch here, matching the rest of `src/api` — screens decide what a failure looks
 * like to the user, and swallowing it at this layer would hide it from the Crashlytics
 * reporting the interceptor already does.
 */

interface ApiEnvelope<T> {
    data: T;
    success: boolean;
    message: string;
    statusCode: number;
    totalCount?: number;
}

/** Everything logged for a child. Small enough that there is nothing to page. */
export const getMilestoneLogs = async (childId: string): Promise<IMilestoneLog[]> => {
    const res = await apiClientInterceptor().get<ApiEnvelope<IMilestoneLog[]>>(
        API_MILESTONE_LOGS,
        { params: { childId } },
    );
    return res.data.data ?? [];
};

/**
 * Mark a milestone reached.
 *
 * `achievedOn` is optional and omitted for the common case — the server dates it today.
 * Re-sending an already-logged milestone corrects its date rather than failing.
 */
export const achieveMilestone = async (payload: {
    childId: string;
    milestoneKey: string;
    achievedOn?: string;
}): Promise<IMilestoneLog> => {
    const res = await apiClientInterceptor().post<ApiEnvelope<IMilestoneLog>>(
        API_MILESTONE_LOGS,
        payload,
    );
    return res.data.data;
};

/** DELETE carries a body, as the mood-, growth- and diaper-log endpoints do. */
export const forgetMilestone = async (payload: {
    childId: string;
    milestoneKey: string;
}): Promise<void> => {
    await apiClientInterceptor().delete(API_MILESTONE_LOGS, { data: payload });
};
