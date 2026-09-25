import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the viewer has asked the system to reduce motion.
 *
 * A grid of babies all moving at once is exactly the kind of thing this setting exists for,
 * and the people most likely to have it on — vestibular disorders, migraine, motion
 * sensitivity — are not a rare audience among new and pregnant mothers. Honouring it is a
 * requirement rather than a courtesy.
 *
 * Scenes need no special case for it: a milestone illustration already has a still frame
 * chosen as its most legible moment, for frozen thumbnails. Reduce Motion simply means every
 * card gets that frame instead of a clock, so the screen loses its movement and none of its
 * meaning.
 */
export const useReduceMotion = (): boolean => {
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        let alive = true;

        AccessibilityInfo.isReduceMotionEnabled()
            .then((enabled) => {
                // The query is async, so a screen that unmounts quickly would otherwise
                // settle this promise into a component that is gone.
                if (alive) setReduced(enabled);
            })
            .catch(() => undefined);

        const subscription = AccessibilityInfo.addEventListener(
            'reduceMotionChanged',
            setReduced,
        );

        return () => {
            alive = false;
            subscription.remove();
        };
    }, []);

    return reduced;
};

export default useReduceMotion;
