import React from 'react';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH, blendMouth } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { ContactShadow, Nursery } from '../rig/Nursery';
import { CaregiverFace, SpeechBubble } from '../rig/annotations';
import { animate, clamp, interpolate } from '../rig/motion';
import { SKIN } from '../rig/palette';
import { vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';
import { FREE_UNIT, freeSittingSkeleton } from './sittingFree';

/**
 * "Uses one or two common words in mother tongue" (10-12 months).
 *
 * **The count is the milestone.** Not that a sound is being made — babbling covers that at
 * four months — but that there is now one word, and perhaps a second. Three years later the
 * card asks for three or more joined into a sentence, and the two drawings have to be
 * different in the one respect the cards differ in.
 *
 * So the bubble here pops **one** blob, holds it long enough to be counted, and then adds a
 * second. Nothing joins, nothing runs together; two separate words with a gap between them is
 * exactly what "one or two words" looks like. Item 33's blobs will slide into a single bar,
 * and that difference is the whole distance between twelve months and three years.
 *
 * Blobs rather than letters, here and everywhere: the app ships in English and Hindi, and a
 * word written into the artwork is wrong in one of them. It is also the only way to draw *how
 * many words* without picking which ones.
 *
 * She is talking **to someone** — a parent at the edge of frame — because a first word is
 * addressed. A baby producing words alone into a room is a different and sadder picture.
 */

export const FIRST_WORDS_DURATION = 8.2;

export const FIRST_WORDS_CUES = {
    /** Sitting, with somebody listening. */
    together: 0,
    /** One word. */
    firstWord: 1.8,
    /** And another. */
    secondWord: 4.0,
} as const;

/** Both blobs out, separate, with the parent still there. */
export const FIRST_WORDS_STILL = 5.0;

const C = FIRST_WORDS_CUES;

const BUBBLE_AT = vec(474, 132);
const PARENT_AT = vec(630, 228);

/** How many words have been said so far — fractional, so they arrive one at a time. */
function spokenCount(t: number): number {
    'worklet';

    return interpolate(
        t,
        [C.firstWord, C.firstWord + 0.3, C.secondWord, C.secondWord + 0.3, FIRST_WORDS_DURATION - 0.8],
        [0, 1, 1, 2, 2],
        'easeOutCubic',
    );
}

/** The bubble itself, arriving and leaving. */
function bubblePop(t: number): number {
    'worklet';

    const inn = animate(t, { start: C.firstWord - 0.2, end: C.firstWord + 0.25, ease: 'easeOutBack' });
    const out = animate(t, {
        start: FIRST_WORDS_DURATION - 1.1,
        end: FIRST_WORDS_DURATION - 0.3,
        ease: 'easeInOutSine',
    });

    return clamp(inn - out, 0, 1);
}

/** A small push on each word — babies put their whole body behind a word at this age. */
function effort(t: number): number {
    'worklet';

    const one = animate(t, { start: C.firstWord, end: C.firstWord + 0.18, ease: 'easeOutQuad' })
        * (1 - animate(t, { start: C.firstWord + 0.18, end: C.firstWord + 0.6, ease: 'easeInOutSine' }));
    const two = animate(t, { start: C.secondWord, end: C.secondWord + 0.18, ease: 'easeOutQuad' })
        * (1 - animate(t, { start: C.secondWord + 0.18, end: C.secondWord + 0.6, ease: 'easeInOutSine' }));

    return clamp(one + two, 0, 1);
}

const FirstWordsScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = freeSittingSkeleton();
    const frozenAt = still ? FIRST_WORDS_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    return (
        <Nursery>
            <ContactShadow left={208} top={394} width={252} height={34} />

            <Leg skeleton={skeleton} skin={skin} side="left" far {...part} />
            <Leg skeleton={skeleton} skin={skin} side="right" {...part} />

            <Torso
                skeleton={skeleton}
                skin={skin}
                breathe={(t) => {
                    'worklet';
                    return 1 + 0.012 * Math.sin(t * 2.4) + 0.02 * effort(t);
                }}
                {...part}
            />

            <Arm skeleton={skeleton} skin={skin} side="left" far hand="open" {...part} />
            <Arm skeleton={skeleton} skin={skin} side="right" hand="open" {...part} />

            <Joint
                pivot={skeleton.neckBase}
                turn={(t) => {
                    'worklet';
                    // A nod into each word.
                    return 4 + 5 * effort(t);
                }}
                {...part}
            >
                <Head
                    at={skeleton.headCentre}
                    unit={FREE_UNIT}
                    skin={skin}
                    facing={0.42}
                    gaze={(t) => {
                        'worklet';
                        // On the person she is talking to — a word is addressed to somebody.
                        // Lifting to meet their eyes on each one, which is what makes it
                        // speech rather than noise made in someone's direction.
                        return vec(0.85, -0.1 - 0.3 * effort(t));
                    }}
                    mouthAt={(t) => {
                        'worklet';
                        // Opens on each word and closes between them — two words, two
                        // openings, which is the count again in a second place.
                        return blendMouth(MOUTH.smile, MOUTH.ah, effort(t) * 0.85);
                    }}
                    {...part}
                />
            </Joint>

            {/*
              * One blob, then two. Separate, with a gap. The gap is the milestone.
              */}
            <SpeechBubble
                at={BUBBLE_AT}
                width={196}
                words={2}
                tail="left"
                pop={bubblePop}
                spoken={spokenCount}
                {...part}
            />

            {rich && (
                <CaregiverFace
                    at={PARENT_AT}
                    unit={FREE_UNIT * 0.92}
                    skin={skin}
                    facing={-0.55}
                    mouth={MOUTH.smile}
                />
            )}
        </Nursery>
    );
};

export default FirstWordsScene;
