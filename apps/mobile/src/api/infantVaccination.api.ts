import { API_VACCINATION_LOGS } from '../constants/endpoints';
import { IVaccinationLog } from '../types/vaccinationLog.types';
import apiClientInterceptor from './apiClientInterceptor';

/**
 * Immunisation doses.
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

/**
 * The whole card for a child.
 *
 * Not paged and not fetched per visit: the schedule is 48 doses at the very most, and the
 * screen counts what is done per visit to label its chips, so it needs all of it anyway.
 */
export const getVaccinationLogs = async (childId: string): Promise<IVaccinationLog[]> => {
    const res = await apiClientInterceptor().get<ApiEnvelope<IVaccinationLog[]>>(
        API_VACCINATION_LOGS,
        { params: { childId } },
    );
    return res.data.data ?? [];
};

/**
 * Record a dose as given.
 *
 * `givenOn` is optional and omitted for the common case — the server dates it today.
 * Re-sending an already-recorded dose corrects its date rather than failing.
 */
export const recordVaccineDose = async (payload: {
    childId: string;
    vaccineKey: string;
    givenOn?: string;
}): Promise<IVaccinationLog> => {
    const res = await apiClientInterceptor().post<ApiEnvelope<IVaccinationLog>>(
        API_VACCINATION_LOGS,
        payload,
    );
    return res.data.data;
};

/** DELETE carries a body, as the mood-, growth-, diaper- and milestone-log endpoints do. */
export const removeVaccineDose = async (payload: {
    childId: string;
    vaccineKey: string;
}): Promise<void> => {
    await apiClientInterceptor().delete(API_VACCINATION_LOGS, { data: payload });
};
