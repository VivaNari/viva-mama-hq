import { API_FEEDING_LOGS, API_FEEDING_LOG_SETTINGS } from '../constants/endpoints';
import {
    IFeedingEntryCreated,
    IFeedingLogResponse,
    IFeedingSettings,
    TDeliveryMethod,
    TFeedSide,
    TFeedingEntryKind,
    TFoodReaction,
    TMilkSource,
    TSolidQuantityUnit,
    TSolidTexture,
} from '../types/feedingLog.types';
import { FeedingMethodEnum } from '../types/user.types';
import apiClientInterceptor from './apiClientInterceptor';

/**
 * Infant feeding logs.
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

/** An empty screen is a valid state, so a missing payload falls back rather than throwing. */
const EMPTY: IFeedingLogResponse = {
    settings: {
        feedingMethod: FeedingMethodEnum.ONLY_BREASTMILK,
        feedingMethodSource: 'default',
        solidsStartedOn: null,
        solidsAvailable: false,
    },
    days: [],
};

/**
 * A child's days, oldest first, with the settings the screen opens with.
 *
 * Settings come back with the list rather than being read from route params: those are a
 * snapshot of the app's cached copy of the user, and another device — or Edit Profile — can
 * have moved on from it.
 */
export const getFeedingLogs = async (
    childId: string,
    from?: string,
    to?: string,
): Promise<IFeedingLogResponse> => {
    const params: Record<string, string> = { childId };
    if (from) params.from = from;
    if (to) params.to = to;

    const res = await apiClientInterceptor().get<ApiEnvelope<IFeedingLogResponse>>(
        API_FEEDING_LOGS,
        { params },
    );
    return res.data.data ?? EMPTY;
};

/**
 * One milk feed. `feedAt` is the client's, so an entry keeps the time it happened.
 *
 * `side`/`minutes` go with `deliveryMethod: 'direct'` and `ml` with everything else; the
 * server forbids the wrong pairing rather than dropping it, so the screen must send one
 * shape or the other and never both.
 */
export const addFeed = async (payload: {
    childId: string;
    milkSource: TMilkSource;
    deliveryMethod?: TDeliveryMethod;
    side?: TFeedSide;
    minutes?: number;
    ml?: number;
    feedAt: string;
}): Promise<IFeedingEntryCreated> => {
    const res = await apiClientInterceptor().post<ApiEnvelope<IFeedingEntryCreated>>(
        API_FEEDING_LOGS,
        { ...payload, kind: 'feed' },
    );
    return res.data.data;
};

/** One solid food. Everything but the name is optional — see the server's `solidPayload`. */
export const addSolid = async (payload: {
    childId: string;
    food: string;
    reactions: TFoodReaction[];
    quantity?: number;
    quantityUnit?: TSolidQuantityUnit;
    texture?: TSolidTexture;
    feedAt: string;
}): Promise<IFeedingEntryCreated> => {
    const res = await apiClientInterceptor().post<ApiEnvelope<IFeedingEntryCreated>>(
        API_FEEDING_LOGS,
        { ...payload, kind: 'solid' },
    );
    return res.data.data;
};

export const addWater = async (payload: {
    childId: string;
    ml: number;
    drankAt: string;
}): Promise<IFeedingEntryCreated> => {
    const res = await apiClientInterceptor().post<ApiEnvelope<IFeedingEntryCreated>>(
        API_FEEDING_LOGS,
        { ...payload, kind: 'water' },
    );
    return res.data.data;
};

/** DELETE carries a body, as the mood-, growth- and diaper-log endpoints do. */
export const removeFeedingEntry = async (payload: {
    childId: string;
    loggedOn: string;
    kind: TFeedingEntryKind;
    entryId: string;
}): Promise<void> => {
    await apiClientInterceptor().delete(API_FEEDING_LOGS, { data: payload });
};

/**
 * The per-child feeding settings.
 *
 * `solidsStartedOn: null` is how a mother takes back "we have started solids", so the field
 * is nullable rather than merely optional — omitting it and clearing it are different
 * instructions and the API reads them differently.
 */
export const updateFeedingSettings = async (payload: {
    childId: string;
    feedingMethod?: FeedingMethodEnum;
    solidsStartedOn?: string | null;
}): Promise<IFeedingSettings> => {
    const res = await apiClientInterceptor().patch<
        ApiEnvelope<{ childId: string; settings: IFeedingSettings }>
    >(API_FEEDING_LOG_SETTINGS, payload);
    return res.data.data.settings;
};
