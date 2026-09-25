import React from 'react';

import { Torso } from '../rig/BabyBody';
import Head, { MOUTH, blendMouth } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { SoundArcs } from '../rig/annotations';
import { animate, clamp } from '../rig/motion';
import { SKIN } from '../rig/palette';
import { vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';
import { closeUpSkeleton, CLOSE_UNIT } from './closeUp';

/**
 * "Laughs aloud or makes squealing sounds" (4-6 months).
 *
 * Sits next to "begins to babble" on the same card, and the two are both a close-up of a
 * mouth making noise. The distinction the card is drawing is **volume against shape**: this
 * one is loud and undifferentiated, babbling is quiet and articulated. So:
 *
 *  - Here the mouth does essentially one thing — opens wide — and everything else does the
 *    work: the head tips back, the shoulders bounce on each pulse, and the sound comes out
 *    in big bursts.
 *  - In the babble scene the head barely moves and the mouth changes shape three times.
 *
 * The bounce and the sound share a single rhythm, on purpose. Arcs that pulsed on their own
 * timing would read as noise happening *near* the baby; locked to the shoulders they read as
 * noise coming *out of* her.
 */

export const LAUGHS_ALOUD_DURATION = 6.6;

export const LAUGHS_ALOUD_CUES = {
    /** Happy, about to go. */
    grin: 0,
    /** The laugh. */
    laugh: 1.2,
    /** Winding down, still pleased. */
    breathless: 4.4,
} as const;

/** Mid-laugh, mouth wide, head back, a wavefront on its way out. */
export const LAUGHS_ALOUD_STILL = 2.4;

const C = LAUGHS_ALOUD_CUES;

/** How hard she is laughing, 0 to 1. */
function laughter(t: number): number {
    'worklet';

    const up = animate(t, { start: C.laugh, end: C.laugh + 0.4, ease: 'easeOutBack' });
    const down = animate(t, { start: C.breathless, end: C.breathless + 1.3, ease: 'easeInOutSine' });

    return clamp(up - down, 0, 1);
}

/**
 * The pulse every part of the scene shares — roughly four a second, which is about the rate
 * of a real belly laugh.
 */
function pulse(t: number): number {
    'worklet';
    return Math.sin((t - C.laugh) * 13.5);
}

const LaughsAloudScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = closeUpSkeleton();
    const frozenAt = still ? LAUGHS_ALOUD_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    return (
        <Nursery mat={false}>
            <Torso
                skeleton={skeleton}
                skin={skin}
                breathe={(t) => {
                    'worklet';
                    // The shoulders bouncing. Much bigger than a breath, and the thing that
                    // makes it read as a laugh rather than an open mouth.
                    const go = laughter(t);
                    return 1 + 0.013 * Math.sin(t * 2.4) + 0.035 * pulse(t) * go;
                }}
                {...part}
            />

            <Joint
                pivot={skeleton.neckBase}
                turn={(t) => {
                    'worklet';
                    const go = laughter(t);
                    // Tipped back and shaking with it. A laughing head that stayed upright
                    // would just be a face with its mouth open.
                    return -13 * go + pulse(t) * 3.2 * go;
                }}
                {...part}
            >
                <Head
                    at={skeleton.headCentre}
                    unit={CLOSE_UNIT}
                    skin={skin}
                    mouthAt={(t) => {
                        'worklet';
                        const go = laughter(t);
                        // Opens and shuts a little on each pulse, so it is breathing rather
                        // than held open.
                        const beat = 0.82 + 0.18 * pulse(t);
                        return blendMouth(MOUTH.smile, MOUTH.laugh, go * beat);
                    }}
                    blink={(t) => {
                        'worklet';
                        // Eyes screwed up. Nobody laughs with their eyes wide open, and a
                        // face that does looks alarmed instead of delighted.
                        return laughter(t) * 0.55;
                    }}
                    {...part}
                />
            </Joint>

            {/*
              * Out of the mouth, upward and to the right, on the same beat as the shoulders.
              */}
            <SoundArcs
                at={vec(skeleton.headCentre.x + CLOSE_UNIT * 0.42, skeleton.headCentre.y + CLOSE_UNIT * 0.3)}
                towards={-34}
                size={38}
                pulse={(t) => {
                    'worklet';
                    const go = laughter(t);
                    if (go === 0) return 0;
                    // Two bursts a second, each one a full arrive-and-fade.
                    return ((t - C.laugh) * 2.15) % 1;
                }}
                {...part}
            />

            {rich && (
                <SoundArcs
                    at={vec(
                        skeleton.headCentre.x + CLOSE_UNIT * 0.52,
                        skeleton.headCentre.y + CLOSE_UNIT * 0.06,
                    )}
                    towards={-16}
                    size={26}
                    pulse={(t) => {
                        'worklet';
                        if (laughter(t) === 0) return 0;
                        // Offset from the first, so the sound overlaps itself the way a real
                        // laugh does instead of arriving in tidy separate packets.
                        return ((t - C.laugh) * 2.15 + 0.45) % 1;
                    }}
                    {...part}
                />
            )}
        </Nursery>
    );
};

export default LaughsAloudScene;
