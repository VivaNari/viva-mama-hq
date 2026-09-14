import React from 'react';

import { Torso } from '../rig/BabyBody';
import Head, { MOUTH, blendMouth } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { CaregiverFace } from '../rig/annotations';
import { animate, clamp } from '../rig/motion';
import { SKIN } from '../rig/palette';
import { vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';
import { PARENT_AT, PARENT_ENTRY, pairSkeleton } from './closeUp';

/**
 * "Develops a social smile" (2-3 months).
 *
 * The word doing the work on the MCP card is *social*. Babies smile in their sleep from
 * birth; what changes at around two months is that the smile becomes a reply. So the order
 * of events is the entire milestone, and it has to be unmistakable:
 *
 *   1. The baby is awake and content, and is not smiling.
 *   2. Somebody arrives.
 *   3. *Then* the smile.
 *
 * Draw the smile first, or at the same time, and the card says "babies smile" — which is
 * true of a newborn and therefore says nothing. The gap between the parent arriving and the
 * mouth moving is about six tenths of a second, which is long enough to read as caused and
 * short enough not to look like hesitation.
 */

export const SOCIAL_SMILE_DURATION = 8.4;

export const SOCIAL_SMILE_CUES = {
    /** Content, unsmiling, looking off at nothing. */
    quiet: 0,
    /** A parent leans into the frame. */
    arrive: 1.7,
    /** The baby finds her face. */
    notice: 2.9,
    /** And smiles back. */
    smile: 3.6,
} as const;

/** The smile at its widest, with the parent still in frame. */
export const SOCIAL_SMILE_STILL = 5.0;

const C = SOCIAL_SMILE_CUES;

/** How far the parent has leaned in, 0 out of frame to 1 settled. */
function leanedIn(t: number): number {
    'worklet';

    const down = animate(t, { start: C.arrive, end: C.arrive + 1.1, ease: 'easeOutCubic' });
    const away = animate(t, {
        start: SOCIAL_SMILE_DURATION - 1.2,
        end: SOCIAL_SMILE_DURATION,
        ease: 'easeInOutSine',
    });

    return down * (1 - away);
}

/** How far the smile has arrived, 0 to 1. */
function smiling(t: number): number {
    'worklet';

    // easeOutBack, so the smile overshoots very slightly and settles. A linear smile looks
    // mechanical; this is the small spring a real face makes.
    const up = animate(t, { start: C.smile, end: C.smile + 0.7, ease: 'easeOutBack' });
    const soften = animate(t, {
        start: SOCIAL_SMILE_DURATION - 1.4,
        end: SOCIAL_SMILE_DURATION,
        ease: 'easeInOutSine',
    });

    // Softens rather than switching off. A social smile fades to a smaller one, it does not
    // snap back to a neutral mouth.
    return clamp(up - soften * 0.55, 0, 1);
}

const SocialSmileScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = pairSkeleton();
    const frozenAt = still ? SOCIAL_SMILE_STILL : undefined;
    const part = { clock, frozenAt };

    return (
        <Nursery mat={false}>
            <Torso
                skeleton={skeleton}
                skin={skin}
                breathe={(t) => {
                    'worklet';
                    return 1 + 0.014 * Math.sin(t * 2.3);
                }}
                {...part}
            />

            <Joint
                pivot={skeleton.neckBase}
                turn={(t) => {
                    'worklet';
                    const joy = smiling(t);
                    // Tips toward her as the smile lands. Bodies join in with a smile; a
                    // face that moves while the head stays bolted forward reads as a mask.
                    return 4.5 * leanedIn(t) + Math.sin(t * 2.6) * 1.6 * joy;
                }}
                {...part}
            >
                <Head
                    at={skeleton.headCentre}
                    unit={skeleton.unit}
                    skin={skin}
                    gaze={(t) => {
                        'worklet';
                        const found = animate(t, {
                            start: C.notice,
                            end: C.notice + 0.45,
                            ease: 'easeOutCubic',
                        });
                        const drift = Math.sin(t * 0.8) * 0.7;

                        // Up and to the right, which is where she is.
                        return vec(
                            drift * (1 - found) + 0.95 * found,
                            -0.75 * found,
                        );
                    }}
                    mouthAt={(t) => {
                        'worklet';
                        const joy = smiling(t);

                        // Through a plain smile on the way to the big one, so the mouth
                        // grows rather than appearing at full width.
                        return joy < 0.5
                            ? blendMouth(MOUTH.rest, MOUTH.smile, joy * 2)
                            : blendMouth(MOUTH.smile, MOUTH.bigSmile, (joy - 0.5) * 2);
                    }}
                    blink={
                        detail === 'full'
                            ? (t) => {
                                  'worklet';
                                  // Eyes crease as the smile widens. A mouth that smiles
                                  // while the eyes stay wide is the classic dead smile, and
                                  // this is the cheapest possible fix for it — it rides the
                                  // gaze's node and costs nothing extra.
                                  return smiling(t) * 0.28;
                              }
                            : undefined
                    }
                    {...part}
                />
            </Joint>

            {/*
              * The parent, leaning in from above. One animated node for the whole of her:
              * she is a presence rather than a performance, and anything she did beyond
              * arriving would pull attention off the mouth that matters.
              */}
            <Joint
                pivot={PARENT_AT}
                shift={(t) => {
                    'worklet';
                    return vec(0, PARENT_ENTRY * (1 - leanedIn(t)));
                }}
                {...part}
            >
                <CaregiverFace
                    at={PARENT_AT}
                    unit={skeleton.unit}
                    skin={skin}
                    mouth={MOUTH.smile}
                />
            </Joint>
        </Nursery>
    );
};

export default SocialSmileScene;
