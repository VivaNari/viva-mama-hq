import { useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    Easing,
    cancelAnimation,
    useSharedValue,
    withRepeat,
    withTiming,
    type SharedValue,
} from 'react-native-reanimated';

/**
 * The single clock every milestone scene derives from.
 *
 * One shared value, counting seconds, looping. Every moving part in a scene is a function
 * of this number — which is the whole reason the illustrations need no assets and can be
 * scrubbed to any moment: there is no state to wind forward, only a time to read.
 *
 * Deliberately one clock per screen rather than one per card. Six visible cards driven by
 * six `withTiming` loops is six animations the UI thread has to advance; driven by one,
 * it is one, and they stay in step with each other for free.
 */

export interface SceneClock {
    /** Seconds elapsed in the loop. Read inside worklets. */
    time: SharedValue<number>;
    /** Length of one full pass, in seconds. */
    duration: number;
    /** Jump to a moment — what a step chip does. */
    seek: (seconds: number) => void;
    /** Restart from zero. */
    replay: () => void;
}

export const useSceneClock = (duration: number, enabled = true): SceneClock => {
    const time = useSharedValue(0);

    const run = useCallback(
        (from: number) => {
            cancelAnimation(time);
            time.value = from;

            // Linear, because the easing belongs to the parts rather than the clock. A
            // clock that eased would bend every curve in the scene on top of its own.
            time.value = withRepeat(
                withTiming(duration, {
                    duration: Math.max(1, (duration - from) * 1000),
                    easing: Easing.linear,
                }),
                -1,
                false,
            );
        },
        [duration, time],
    );

    useEffect(() => {
        if (!enabled) {
            cancelAnimation(time);
            return;
        }

        run(0);
        return () => cancelAnimation(time);
    }, [enabled, run, time]);

    /**
     * Stop while the screen is away.
     *
     * Without this the loop keeps advancing behind whatever the parent navigated to —
     * invisible work on the UI thread, for a card nobody is looking at.
     */
    useFocusEffect(
        useCallback(() => {
            if (enabled) run(0);
            return () => cancelAnimation(time);
        }, [enabled, run, time]),
    );

    return {
        time,
        duration,
        seek: useCallback(
            (seconds: number) => {
                if (!enabled) {
                    time.value = seconds;
                    return;
                }
                run(Math.max(0, Math.min(seconds, duration)));
            },
            [duration, enabled, run, time],
        ),
        replay: useCallback(() => run(0), [run]),
    };
};
