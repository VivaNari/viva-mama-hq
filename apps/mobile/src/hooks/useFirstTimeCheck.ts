import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { UseFirstTimeCheckReturn } from '../types/subscription.types';
import { ASYNC_STORAGE_KEYS, CURATING_PLAN_ANIMATION_DURATION_MS } from '../constants/subscription';
import { subscriptionLogger } from '../utils/logger';

export const useFirstTimeCheck = (): UseFirstTimeCheckReturn => {
    const [isFirstTime, setIsFirstTime] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        const checkFirstTimeStatus = async () => {
            try {
                const curatingData = await AsyncStorage.getItem(
                    ASYNC_STORAGE_KEYS.FIRST_TIME_CURATING
                );

                if (!isMountedRef.current) return;

                if (!curatingData) {
                    // First time user - show animation
                    setIsFirstTime(true);

                    // Set timeout to mark as returning user and hide loader
                    timeoutRef.current = setTimeout(async () => {
                        if (!isMountedRef.current) return;

                        try {
                            await AsyncStorage.setItem(
                                ASYNC_STORAGE_KEYS.FIRST_TIME_CURATING,
                                'true'
                            );
                        } catch (storageError) {
                            subscriptionLogger.error(
                                'Failed to save first time status',
                                storageError
                            );
                        }

                        if (isMountedRef.current) {
                            setIsLoading(false);
                        }
                    }, CURATING_PLAN_ANIMATION_DURATION_MS);
                } else {
                    // Returning user
                    setIsFirstTime(false);
                    setIsLoading(false);
                }
            } catch (error) {
                subscriptionLogger.error('Error checking first time status', error);

                if (isMountedRef.current) {
                    setIsFirstTime(false);
                    setIsLoading(false);
                }
            }
        };

        checkFirstTimeStatus();

        // Cleanup
        return () => {
            isMountedRef.current = false;
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, []);

    const markAsReturningUser = useCallback(async () => {
        try {
            await AsyncStorage.setItem(
                ASYNC_STORAGE_KEYS.FIRST_TIME_CURATING,
                'true'
            );
            setIsFirstTime(false);
        } catch (error) {
            subscriptionLogger.error('Failed to mark as returning user', error);
        }
    }, []);

    return {
        isFirstTime,
        isLoading,
        markAsReturningUser,
    };
};