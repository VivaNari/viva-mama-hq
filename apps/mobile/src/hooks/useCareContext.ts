import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import { chatDB } from '../db/sqlite';
import {
    CareModelEnum,
    DeliveryOutcomeEnum,
    DeliveryTypeEnum,
    IChild,
    UserCategoryEnum,
} from '../types/user.types';
import { getVisibleChildren } from '../utils/childAge';
import { hasGestationalDiabetes } from '../utils/careSchedule';

export interface CareContext {
    /** Public (government) or private care route. Null means she has not told us yet. */
    careModel: CareModelEnum | null;
    /** NP pregnant, PP postpartum, NN neither. Null until the cached user has loaded. */
    category: UserCategoryEnum | null;
    /** Her height for BMI, or null when not recorded yet. */
    heightCm: number | null;
    /**
     * Her gestational week, or null when she is not pregnant or it is not known yet. Not
     * `np_weeks`, which counts the weeks remaining until her due date.
     */
    pregnancyWeek: number | null;
    /** Her week since the birth, delivery day being week 1; null unless postpartum. */
    postpartumWeek: number | null;
    deliveryType: DeliveryTypeEnum | null;
    deliveryOutcome: DeliveryOutcomeEnum | null;
    /** Gestational diabetes, in this pregnancy or a past one. */
    hasGdm: boolean;
    /** Her children on record, without unfinished drafts. */
    children: IChild[];
    loading: boolean;
}

/**
 * Which log and reminder set a mother sees, and her height for BMI. All of it comes
 * from the profile, never from a toggle on screen: `onboarding_data.care_model` sets
 * the route and `user_category` sets the stage.
 *
 * Reads the same SQLite user cache the Dashboard fills, so it costs no network call.
 * Re-read on focus so a height just saved in Edit Profile shows on return.
 */
export const useCareContext = (): CareContext => {
    const { userId } = useAuth();
    const [state, setState] = useState<CareContext>({
        careModel: null,
        category: null,
        heightCm: null,
        pregnancyWeek: null,
        postpartumWeek: null,
        deliveryType: null,
        deliveryOutcome: null,
        hasGdm: false,
        children: [],
        loading: true,
    });

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;

            const load = async () => {
                try {
                    const cached = await chatDB.getUserData(userId as string);
                    const user = cached?.data?.user;
                    if (cancelled) return;

                    const weeks = user?.current_weekdays?.weeks ?? 0;

                    setState({
                        careModel: user?.onboarding_data?.care_model ?? null,
                        category: user?.user_category ?? null,
                        heightCm: user?.onboarding_data?.height_cm ?? null,
                        pregnancyWeek: user?.user_category === UserCategoryEnum.NP && weeks > 0 ? weeks : null,
                        postpartumWeek: user?.user_category === UserCategoryEnum.PP && weeks > 0 ? weeks : null,
                        deliveryType: user?.onboarding_data?.delivery_type ?? null,
                        deliveryOutcome: user?.onboarding_data?.delivery_outcome ?? null,
                        hasGdm: hasGestationalDiabetes(user?.onboarding_data),
                        children: getVisibleChildren(user?.childs),
                        loading: false,
                    });
                } catch {
                    if (!cancelled) setState(prev => ({ ...prev, loading: false }));
                }
            };

            load();
            return () => {
                cancelled = true;
            };
        }, [userId]),
    );

    return state;
};
