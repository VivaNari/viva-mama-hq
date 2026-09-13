import { API_DIAPER_LOGS } from '../constants/endpoints';
import {
    IDiaperEntryCreated,
    IDiaperLog,
    TDiaperKind,
} from '../types/diaperLog.types';
import apiClientInterceptor from './apiClientInterceptor';

/**
 * Infant diaper logs.
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

/** A child's days, oldest first. */
export const getDiaperLogs = async (
    childId: string,
    from?: string,
    to?: string,
): Promise<IDiaperLog[]> => {
    const params: Record<string, string> = { childId };
    if (from) params.from = from;
    if (to) params.to = to;

    const res = await apiClientInterceptor().get<ApiEnvelope<IDiaperLog[]>>(
        API_DIAPER_LOGS,
        { params },
    );
    return res.data.data ?? [];
};

/**
 * Record one nappy change.
 *
 * Appends rather than replacing the day, so two taps a second apart cannot overwrite each
 * other. `loggedAt` is sent by the client so an entry keeps the time it actually happened
 * rather than the time the request reached the server.
 */
export const addDiaperEntry = async (payload: {
    childId: string;
    kind: TDiaperKind;
    loggedAt: string;
}): Promise<IDiaperEntryCreated> => {
    const res = await apiClientInterceptor().post<ApiEnvelope<IDiaperEntryCreated>>(
        API_DIAPER_LOGS,
        payload,
    );
    return res.data.data;
};

/** DELETE carries a body, as the mood- and growth-log endpoints do. */
export const removeDiaperEntry = async (payload: {
    childId: string;
    loggedOn: string;
    entryId: string;
}): Promise<void> => {
    await apiClientInterceptor().delete(API_DIAPER_LOGS, { data: payload });
};
