import React from 'react';

import { Torso } from '../rig/BabyBody';
import Head, { MOUTH, blendMouth } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { CaregiverFace, Sparkles } from '../rig/annotations';
import { animate, clamp } from '../rig/motion';
import { SKIN } from '../rig/palette';
import { vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';
import { PARENT_AT, PARENT_ENTRY, pairSkeleton } from './closeUp';

/**
 * "Begins to recognize the mother's face" (2-3 months).
 *
 * This card and the social smile beside it are both a baby and a parent, and they would be
 * the same drawing if the timing were not doing the work. The difference is deliberate and
 * it is the whole reason both exist:
 *
 *  - **Here**, the eyes *follow her the whole way down*. Tracking a particular face through
 *    a movement is what recognition looks like from outside — the baby is not noticing that
 *    something appeared, they are keeping hold of someone they already know.
 *  - **In the smile**, she arrives and is only then noticed, and the reply is the mouth.
 *
 * So the gaze here is continuous where the smile's is a snap, and the reaction here is the
 * whole body — a wriggle of delight, which is what a two-month-old actually does — where the
 * smile's is the mouth alone.
 */

export const RECOGNISES_FACE_DURATION = 9.0;

export const RECOGNISES_FACE_CUES = {
    /** Awake, looking about, alone in frame. */
    alone: 0,
    /** A face starts coming down towards her. */
    approach: 1.5,
    /** Recognition lands. */
    knows: 4.0,
} as const;

/** Recognition at its peak: eyes on her, sparkles out, body mid-wriggle. */
export const RECOGNISES_FACE_STILL = 4.9;

const C = RECOGNISES_FACE_CUES;

/**
 * How far the parent has descended, 0 above the frame to 1 settled.
 *
 * Slower than the social smile's arrival on purpose. The eyes have to be seen to travel
 * with her, and a face that drops into place in half a second gives them nothing to follow.
 */
function descent(t: number): number {
    'worklet';

    const down = animate(t, {
        start: C.approach,
        end: C.approach + 2.1,
        ease: 'easeInOutSine',
    });
    const away = animate(t, {
        start: RECOGNISES_FACE_DURATION - 1.3,
        end: RECOGNISES_FACE_DURATION,
        ease: 'easeInOutSine',
    });

    return down * (1 - away);
}

/** How far recognition has landed, 0 to 1. */
function knowing(t: number): number {
    'worklet';

    const spark = animate(t, { start: C.knows, end: C.knows + 0.5, ease: 'easeOutBack' });
    const settle = animate(t, {
        start: RECOGNISES_FACE_DURATION - 1.5,
        end: RECOGNISES_FACE_DURATION,
        ease: 'easeInOutSine',
    });

    return clamp(spark - settle * 0.7, 0, 1);
}

const RecognisesFaceScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = pairSkeleton();
    const frozenAt = still ? RECOGNISES_FACE_STILL : undefined;
    const part = { clock, frozenAt };

    return (
        <Nursery mat={false}>
            <Torso
                skeleton={skeleton}
                skin={skin}
                breathe={(t) => {
                    'worklet';
                    // The wriggle rides on the breath's node rather than costing its own.
                    // A two-month-old recognising their mother kicks and squirms with their
                    // whole body, and leaving that out makes recognition look like mere
                    // looking.
                    const joy = knowing(t);
                    return 1 + 0.014 * Math.sin(t * 2.3) + 0.03 * Math.sin(t * 9.5) * joy;
                }}
                {...part}
            />

            <Joint
                pivot={skeleton.neckBase}
                turn={(t) => {
                    'worklet';
                    const near = descent(t);
                    const joy = knowing(t);

                    // The head lifts to follow her down, then jiggles with the wriggle.
                    return 6.5 * near + Math.sin(t * 8.2) * 2.2 * joy;
                }}
                {...part}
            >
                <Head
                    at={skeleton.headCentre}
                    unit={skeleton.unit}
                    skin={skin}
                    gaze={(t) => {
                        'worklet';
                        const near = descent(t);
                        const drift = Math.sin(t * 0.85) * 0.8;

                        // The tracking. Her face travels from above the frame down to its
                        // resting place, and the pupils are wherever she is at that instant
                        // — which is what makes it reading a face rather than spotting one.
                        const towardsHer = vec(0.95, -0.8);
                        const chaseY = -1 + near * (towardsHer.y + 1);

                        return vec(
                            drift * (1 - near) + towardsHer.x * near,
                            chaseY * near + drift * 0.3 * (1 - near),
                        );
                    }}
                    mouthAt={(t) => {
                        'worklet';
                        // A smile, but a smaller one than the social-smile card's — that
                        // milestone owns the big one, and this one owns the recognition.
                        return blendMouth(MOUTH.rest, MOUTH.smile, knowing(t) * 0.85);
                    }}
                    {...part}
                />
            </Joint>

            <Joint
                pivot={PARENT_AT}
                shift={(t) => {
                    'worklet';
                    return vec(0, PARENT_ENTRY * (1 - descent(t)));
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

            {/*
              * Recognition landing. The one mark in this band that is not anatomy — without
              * it, "knows her face" and "is looking at her" are the same picture, and the
              * card is specifically about the first.
              */}
            {detail === 'full' && (
                <Sparkles
                    at={vec(skeleton.headCentre.x + 96, skeleton.headCentre.y - 104)}
                    size={34}
                    pop={(t) => {
                        'worklet';
                        return animate(t, {
                            start: C.knows - 0.1,
                            end: C.knows + 1.3,
                            ease: 'easeOutQuad',
                        });
                    }}
                    {...part}
                />
            )}
        </Nursery>
    );
};

export default RecognisesFaceScene;
