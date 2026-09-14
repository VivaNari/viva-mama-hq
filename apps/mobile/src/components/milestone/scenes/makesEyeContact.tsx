import React from 'react';

import { Torso } from '../rig/BabyBody';
import Head, { MOUTH } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { animate } from '../rig/motion';
import { SKIN } from '../rig/palette';
import { vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';
import { closeUpSkeleton } from './closeUp';

/**
 * "Makes eye contact" (2-3 months).
 *
 * The hardest of the three face milestones to draw, because what it is made of is *nothing
 * happening*. A baby who looks at you is not smiling, not responding to anybody, not
 * reacting — they are simply holding still and looking, and the holding is the achievement.
 *
 * So this scene deliberately withholds everything the neighbouring cards use. No parent
 * enters. The mouth never changes. Compared to "develops a social smile" next to it, the
 * absence is the difference: that one is a response to somebody, this one is contact held
 * for its own sake.
 *
 * The shape of it is wander, lock, hold, release. The wander at the start matters — a gaze
 * that begins locked has not *made* contact, it was already there, and the arrival is what
 * a parent recognises.
 */

export const MAKES_EYE_CONTACT_DURATION = 7.2;

export const MAKES_EYE_CONTACT_CUES = {
    /** Eyes drifting, not yet settled on anything. */
    wander: 0,
    /** They find you. */
    lock: 2.0,
    /** And stay. */
    hold: 3.0,
} as const;

/** Mid-hold: eyes open, dead centre, looking out of the card. */
export const MAKES_EYE_CONTACT_STILL = 4.2;

const C = MAKES_EYE_CONTACT_CUES;

/**
 * How far the gaze has settled, 0 wandering to 1 locked, and out again at the end.
 *
 * One function because every part of the scene reads from the same number — the eyes, the
 * head's micro-tilt and the last of the drift all have to agree, or the face comes apart
 * into independently twitching pieces.
 */
function settled(t: number): number {
    'worklet';

    const arrive = animate(t, { start: C.lock, end: C.lock + 0.55, ease: 'easeOutCubic' });
    const leave = animate(t, {
        start: MAKES_EYE_CONTACT_DURATION - 1.1,
        end: MAKES_EYE_CONTACT_DURATION,
        ease: 'easeInOutSine',
    });

    return arrive * (1 - leave);
}

const MakesEyeContactScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = closeUpSkeleton();
    const frozenAt = still ? MAKES_EYE_CONTACT_STILL : undefined;
    const part = { clock, frozenAt };

    return (
        <Nursery mat={false}>
            <Torso
                skeleton={skeleton}
                skin={skin}
                breathe={(t) => {
                    'worklet';
                    return 1 + 0.012 * Math.sin(t * 2.2);
                }}
                {...part}
            />

            {/*
              * A small tilt of the whole head. Never still, even at the height of the hold —
              * a face frozen perfectly is a photograph, and this is a baby working to keep
              * their eyes where they have put them.
              */}
            <Joint
                pivot={skeleton.neckBase}
                turn={(t) => {
                    'worklet';
                    const lock = settled(t);
                    // The wander tilts the head about; locking on quiets it down to a
                    // tremor without ever quite stopping it.
                    return (
                        Math.sin(t * 0.7) * 5.5 * (1 - lock) + Math.sin(t * 3.4) * 0.9 * lock
                    );
                }}
                {...part}
            >
                <Head
                    at={skeleton.headCentre}
                    unit={skeleton.unit}
                    skin={skin}
                    mouth={MOUTH.rest}
                    gaze={(t) => {
                        'worklet';
                        const lock = settled(t);

                        // Off looking at nothing in particular, then straight down the
                        // lens. Two frequencies so the wander does not read as a metronome.
                        const driftX = Math.sin(t * 0.9) * 0.85 + Math.sin(t * 2.3) * 0.2;
                        const driftY = Math.sin(t * 0.6 + 1.4) * 0.55;

                        return vec(driftX * (1 - lock), driftY * (1 - lock));
                    }}
                    blink={
                        // A blink is a detail that costs nothing extra — it rides the same
                        // node as the gaze — but it is invisible at thumbnail size, so the
                        // arithmetic is skipped there.
                        detail === 'full'
                            ? (t) => {
                                  'worklet';
                                  // One mid-hold, which makes the stillness read as held
                                  // rather than as a frozen frame.
                                  const at = C.hold + 1.6;
                                  const shut = animate(t, {
                                      start: at,
                                      end: at + 0.09,
                                      ease: 'easeInQuad',
                                  });
                                  const open = animate(t, {
                                      start: at + 0.09,
                                      end: at + 0.22,
                                      ease: 'easeOutQuad',
                                  });

                                  return shut * (1 - open);
                              }
                            : undefined
                    }
                    {...part}
                />
            </Joint>
        </Nursery>
    );
};

export default MakesEyeContactScene;
