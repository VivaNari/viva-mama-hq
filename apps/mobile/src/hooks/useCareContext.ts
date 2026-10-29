import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import { chatDB } from '../db/sqlite';
import { CareModelEnum, UserCategoryEnum } from '../types/user.types';

export interface CareContext {
    /** Public (government) or private care route. Unknown falls back to public. */
    careModel: CareModelEnum;
    /** NP pregnant, PP postpartum, NN neither. Null until the cached user has loaded. */
    category: UserCategoryEnum | null;
    /** Her height for BMI, or null when not recorded yet. */
    heightCm: number | null;
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
        careModel: CareModelEnum.PUBLIC,
        category: null,
        heightCm: null,
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

                    setState({
                        careModel:
                            user?.onboarding_data?.care_model === CareModelEnum.PRIVATE
                                ? CareModelEnum.PRIVATE
                                : CareModelEnum.PUBLIC,
                        category: user?.user_category ?? null,
                        heightCm: user?.onboarding_data?.height_cm ?? null,
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
