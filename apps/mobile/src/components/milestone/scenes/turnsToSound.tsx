import React from 'react';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { SoundArcs } from '../rig/annotations';
import { animate, clamp } from '../rig/motion';
import { SKIN } from '../rig/palette';
import { vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';
import { Cushion, SITTING_UNIT, sittingSkeleton } from './sitting';

/**
 * "Turns head towards the direction of sound" (4-6 months).
 *
 * There are three head turns in this catalogue and they are three different milestones:
 * this one at 4-6 months, following a moving toy at 7-9, and answering to their own name at
 * 10-12. A rig that drew them all as "baby turns head" would lose two of the three, so each
 * has one property that is only true of it.
 *
 * **This one is a snap.** The sound arrives from somewhere the baby cannot see, so there is
 * nothing to follow — there is a beat of nothing, and then the head goes, fast, in a third of
 * a second, with a small overshoot as it arrives. Following a toy (item 15) is the opposite
 * shape: continuous, slow, and with no startle in it at all.
 *
 * The beat before the turn is doing real work. Cut it and the head moves *with* the sound,
 * which reads as coincidence; leave it in and the sound is visibly the cause.
 *
 * Fast out and slow back, too. Locating a sound is a reflex and letting it go is not.
 */

export const TURNS_TO_SOUND_DURATION = 7.6;

export const TURNS_TO_SOUND_CUES = {
    /** Propped, facing out, attending to nothing. */
    quiet: 0,
    /** A sound, from off to the left. */
    sound: 1.6,
    /** The head goes. */
    turn: 2.05,
} as const;

/** Turned to the source, with the second wavefront still arriving. */
export const TURNS_TO_SOUND_STILL = 3.4;

const C = TURNS_TO_SOUND_CUES;

/** Where the sound is coming from — off the left edge, deliberately out of frame. */
const SOURCE = vec(36, 214);

/**
 * How far round the head is, 0 facing out to 1 facing the sound.
 *
 * The asymmetry is the point: 0.34s to arrive, 1.6s to return.
 */
function turned(t: number): number {
    'worklet';

    const snap = animate(t, { start: C.turn, end: C.turn + 0.34, ease: 'easeOutBack' });
    const back = animate(t, { start: C.turn + 2.9, end: C.turn + 4.5, ease: 'easeInOutSine' });

    return clamp(snap - back, 0, 1);
}

/** Two bursts, so the sound is still going on when the baby gets there to look at it. */
function soundPulse(t: number): number {
    'worklet';

    const first = animate(t, { start: C.sound, end: C.sound + 1.1, ease: 'linear' });
    const second = animate(t, { start: C.sound + 1.5, end: C.sound + 2.6, ease: 'linear' });

    return first < 1 ? first : second;
}

const TurnsToSoundScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = sittingSkeleton();
    const frozenAt = still ? TURNS_TO_SOUND_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    return (
        <Nursery>
            <Cushion skeleton={skeleton} />

            <Leg skeleton={skeleton} skin={skin} side="left" far {...part} />
            <Leg skeleton={skeleton} skin={skin} side="right" {...part} />

            <Torso
                skeleton={skeleton}
                skin={skin}
                breathe={(t) => {
                    'worklet';
                    // A small start at the sound. The body hears it too.
                    const jump = animate(t, { start: C.sound, end: C.sound + 0.18, ease: 'easeOutQuad' })
                        * (1 - animate(t, { start: C.sound + 0.18, end: C.sound + 0.7, ease: 'easeOutQuad' }));
                    return 1 + 0.013 * Math.sin(t * 2.4) + 0.02 * jump;
                }}
                {...part}
            />

            <Arm
                skeleton={skeleton}
                skin={skin}
                side="left"
                far
                hand="open"
                {...part}
            />
            <Arm
                skeleton={skeleton}
                skin={skin}
                side="right"
                hand="open"
                root={
                    rich
                        ? (t) => {
                              'worklet';
                              // The near shoulder comes round a little after the head. A
                              // head that turns with the body completely still reads as
                              // detached from it.
                              return turned(t) * 7;
                          }
                        : undefined
                }
                {...part}
            />

            <Joint
                pivot={skeleton.neckBase}
                turn={(t) => {
                    'worklet';
                    // A tilt into the turn, which is what people actually do when locating
                    // a sound — the ear leads.
                    return -turned(t) * 6;
                }}
                {...part}
            >
                <Head
                    at={skeleton.headCentre}
                    unit={SITTING_UNIT}
                    skin={skin}
                    mouth={MOUTH.rest}
                    turnTo={(t) => {
                        'worklet';
                        // Negative is stage left, which is where the sound is.
                        return -turned(t);
                    }}
                    gaze={(t) => {
                        'worklet';
                        // Eyes lead the head by a twelfth of a second. Small, and it is most
                        // of what makes the movement look like a living reflex rather than
                        // a rotating object.
                        const eyes = turned(t + 0.08);
                        const head = turned(t);
                        const idle = Math.sin(t * 0.8) * 0.5 * (1 - head);

                        return vec(-eyes + idle * 0.4, Math.sin(t * 0.6) * 0.25 * (1 - head));
                    }}
                    {...part}
                />
            </Joint>

            {/*
              * The sound itself. Without this the card is a baby looking to one side, which
              * is not a milestone — the arcs are what make the turn an answer to something.
              */}
            <SoundArcs
                at={SOURCE}
                towards={0}
                size={46}
                pulse={soundPulse}
                {...part}
            />
        </Nursery>
    );
};

export default TurnsToSoundScene;
