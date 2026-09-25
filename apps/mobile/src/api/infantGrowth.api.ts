import { API_GROWTH_LOGS } from '../constants/endpoints';
import { IGrowthLog, IGrowthLogUpsert } from '../types/growthLog.types';
import apiClientInterceptor from './apiClientInterceptor';

/**
 * Infant growth logs.
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

/** A child's growth history, oldest first — the order the chart plots. */
export const getGrowthLogs = async (
    childId: string,
    from?: string,
    to?: string,
): Promise<IGrowthLog[]> => {
    const params: Record<string, string> = { childId };
    if (from) params.from = from;
    if (to) params.to = to;

    const res = await apiClientInterceptor().get<ApiEnvelope<IGrowthLog[]>>(
        API_GROWTH_LOGS,
        { params },
    );
    return res.data.data ?? [];
};

/**
 * Create or update the growth log for a calendar day.
 *
 * Upsert, not insert: one editable entry per child per day, and a mother correcting a
 * number she just typed is the normal case.
 */
export const upsertGrowthLog = async (
    payload: IGrowthLogUpsert,
): Promise<IGrowthLog> => {
    const res = await apiClientInterceptor().post<ApiEnvelope<IGrowthLog>>(
        API_GROWTH_LOGS,
        payload,
    );
    return res.data.data;
};

/** DELETE carries a body, as the mood-log endpoint does. */
export const deleteGrowthLog = async (
    childId: string,
    measuredOn: string,
): Promise<void> => {
    await apiClientInterceptor().delete(API_GROWTH_LOGS, {
        data: { childId, measuredOn },
    });
};
