import { API_CHILD } from '../constants/endpoints';
import { IChild } from '../types/user.types';
import apiClientInterceptor from './apiClientInterceptor';

/**
 * Editing and removing a child.
 *
 * There is no read here on purpose: `GET /user` already returns `childs[]` embedded on the
 * user, and the dashboard reads them from there. A second source for the same rows would
 * only be a way for the two to disagree.
 *
 * No try/catch either, matching the rest of `src/api` — screens decide what a failure looks
 * like to the user, and swallowing it here would hide it from the Crashlytics reporting the
 * interceptor already does.
 */

interface ApiEnvelope<T> {
    success: boolean;
    message: string;
    child?: T;
}

/**
 * What a mother may change about a child after onboarding.
 *
 * The date of birth, the sex and the vaccination sector are absent, and that is the whole
 * contract rather than an oversight. Percentiles are computed against the date of birth and
 * the sex, the immunisation schedule comes from the sector, the six-month solids gate and
 * every date strip's floor come from the date of birth. Changing one would not correct a
 * value, it would invalidate a history — so they are set once, at onboarding, and a
 * correction means removing the child and adding them again.
 *
 * The API refuses them outright, so this type is the same rule said twice, on purpose: the
 * one that fails at compile time is the one a developer actually meets.
 */
export interface UpdateChildPayload {
    name?: string;
    birth_measurements?: {
        head_circumference_cm?: number;
        length_cm?: number;
        weight_grams?: number;
    };
}

export const updateChild = async (
    childId: string,
    payload: UpdateChildPayload,
): Promise<IChild | undefined> => {
    const res = await apiClientInterceptor().patch<ApiEnvelope<IChild>>(
        `${API_CHILD}/${childId}`,
        payload,
    );
    return res.data.child;
};

/**
 * Remove a child, and with them every log recorded against them.
 *
 * The cascade is the server's — growth, diaper, feeding, milestone and vaccination rows all
 * go. Callers must have said so plainly before getting here; this function cannot warn.
 */
export const deleteChild = async (childId: string): Promise<void> => {
    await apiClientInterceptor().delete(`${API_CHILD}/${childId}`);
};
