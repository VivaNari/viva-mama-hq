import { API_INFANT_WELLBEING } from '../constants/endpoints';
import { IInfantWellbeing } from '../types/infantWellbeing.types';
import apiClientInterceptor from './apiClientInterceptor';

/**
 * The infant dashboard's wellbeing summary.
 *
 * Derived server-side on every read rather than stored: it summarises five logs that change
 * through the day, so a cached copy would be stale the moment a feed is logged.
 */

interface ApiEnvelope<T> {
    data: T;
    success: boolean;
    message: string;
    statusCode: number;
}

export const getInfantWellbeing = async (childId: string): Promise<IInfantWellbeing> => {
    const res = await apiClientInterceptor().get<ApiEnvelope<IInfantWellbeing>>(
        API_INFANT_WELLBEING,
        { params: { childId } },
    );
    return res.data.data;
};
