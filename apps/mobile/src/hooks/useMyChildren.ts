import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import { chatDB } from '../db/sqlite';

export interface IMyChild {
    id: string;
    name: string;
}

/**
 * The babies she has finished adding (half-done onboarding entries are left out),
 * from the same SQLite user cache the Dashboard fills. Re-read on focus.
 */
export const useMyChildren = (): IMyChild[] => {
    const { userId } = useAuth();
    const [children, setChildren] = useState<IMyChild[]>([]);

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            chatDB
                .getUserData(userId as string)
                .then(cached => {
                    if (cancelled) return;
                    const childs = (cached?.data?.user?.childs ?? []) as any[];
                    setChildren(
                        childs
                            .filter(c => c?._id && c?.name && c?.onboarding_status !== 'DRAFT')
                            .map(c => ({ id: String(c._id), name: String(c.name) })),
                    );
                })
                .catch(() => undefined);
            return () => {
                cancelled = true;
            };
        }, [userId]),
    );

    return children;
};
