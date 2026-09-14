import React from 'react';
import { View } from 'react-native';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH, blendMouth } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { ContactShadow, Nursery } from '../rig/Nursery';
import { Part } from '../rig/parts';
import { CaregiverHand, SpeechBubble } from '../rig/annotations';
import { frontSkeleton } from '../rig/anatomy';
import { animate, clamp } from '../rig/motion';
import { SCENE, SKIN } from '../rig/palette';
import { ball, oval, vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';

/**
 * "Names and identifies common objects and their pictures" (18 months).
 *
 * Two claims in one line, and the drawing has to make both. **Identifies** is the pointing —
 * picking out the right thing when asked. **Names** is the word that goes with it. Either
 * alone is a different milestone: pointing without a word is twelve months, and a word
 * without the pointing is item 21.
 *
 * So the two happen *together* here, a beat apart — the finger lands, and the word follows it
 * by about a third of a second. That order matters and is the way round a child actually does
 * it; the word arriving first would look like recitation rather than recognition.
 *
 * The bubble carries a word-blob **beside a small echo of the pictured thing**, so the
 * drawing says "the word for *that*" rather than merely "a word". And "their pictures" is the
 * other half of the card: what is being named is a drawing on a card, not the object itself,
 * which is the harder and later skill of the two.
 *
 * The picture is a bird — a plain shape, recognisable at any size, and not tied to any one
 * language or place.
 */

export const NAMES_PICTURES_DURATION = 8.6;

export const NAMES_PICTURES_CUES = {
    /** A card is held up. */
    shown: 0,
    /** The finger goes to it. */
    points: 2.0,
    /** And the word. */
    names: 2.4,
} as const;

/** Finger on the picture, bubble out with the word and the echo beside it. */
export const NAMES_PICTURES_STILL = 3.6;

const C = NAMES_PICTURES_CUES;

const UNIT = 112;

const CARD_AT = vec(548, 208);
const CARD_W = 150;
const CARD_H = 186;

const BUBBLE_AT = vec(226, 96);

/** How far the arm is out toward the card, 0 to 1. */
function pointing(t: number): number {
    'worklet';

    const out = animate(t, { start: C.points, end: C.points + 0.55, ease: 'easeOutCubic' });
    const home = animate(t, {
        start: NAMES_PICTURES_DURATION - 1.8,
        end: NAMES_PICTURES_DURATION - 0.5,
        ease: 'easeInOutSine',
    });

    return clamp(out - home, 0, 1);
}

/** The naming, a beat behind the pointing. */
function naming(t: number): number {
    'worklet';

    const say = animate(t, { start: C.names, end: C.names + 0.3, ease: 'easeOutBack' });
    const done = animate(t, {
        start: NAMES_PICTURES_DURATION - 1.4,
        end: NAMES_PICTURES_DURATION - 0.4,
        ease: 'easeInOutSine',
    });

    return clamp(say - done, 0, 1);
}

/** A bird, as a picture on a card. Two ovals and a beak. */
const Bird: React.FC<{ at: { x: number; y: number }; size: number }> = ({ at, size }) => (
    <>
        <View style={oval(vec(at.x, at.y + size * 0.1), size * 0.78, size * 0.56, SCENE.accent)} />
        <View style={ball(vec(at.x - size * 0.3, at.y - size * 0.22), size * 0.38, SCENE.accent)} />
        <View
            style={oval(
                vec(at.x - size * 0.54, at.y - size * 0.2),
                size * 0.22,
                size * 0.12,
                SCENE.toyPink,
            )}
        />
        <View
            style={oval(
                vec(at.x + size * 0.34, at.y + size * 0.16),
                size * 0.38,
                size * 0.2,
                SCENE.accent,
                18,
            )}
        />
    </>
);

const NamesPicturesScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = frontSkeleton({
        headAt: vec(272, 146),
        unit: UNIT,
        age: 'toddler',
        armSpread: 22,
        legSpread: 54,
    });
    const frozenAt = still ? NAMES_PICTURES_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    return (
        <Nursery>
            <ContactShadow left={184} top={396} width={230} height={32} />

            {/* the card, held up by somebody out of frame */}
            <View
                style={{
                    position: 'absolute',
                    left: CARD_AT.x - CARD_W / 2,
                    top: CARD_AT.y - CARD_H / 2,
                    width: CARD_W,
                    height: CARD_H,
                    borderRadius: 14,
                    backgroundColor: SCENE.windowFill,
                    borderWidth: 6,
                    borderColor: SCENE.toyLilac,
                }}
            />
            <Bird at={vec(CARD_AT.x, CARD_AT.y)} size={94} />

            {rich && (
                <CaregiverHand
                    at={vec(CARD_AT.x + 66, CARD_AT.y + 96)}
                    unit={UNIT}
                    skin={skin}
                    gesture="open"
                    angle={-152}
                    from={vec(720, 460)}
                />
            )}

            <Leg skeleton={skeleton} skin={skin} side="left" far {...part} />
            <Leg skeleton={skeleton} skin={skin} side="right" {...part} />

            <Torso
                skeleton={skeleton}
                skin={skin}
                breathe={(t) => {
                    'worklet';
                    return 1 + 0.012 * Math.sin(t * 2.4) + 0.014 * naming(t);
                }}
                {...part}
            />

            <Arm skeleton={skeleton} skin={skin} side="left" far hand="open" {...part} />

            {/*
              * The pointing arm. `hand="point"` is the one place in the catalogue that shape
              * is used, and it is what makes this *identifying* rather than reaching.
              */}
            <Arm
                skeleton={skeleton}
                skin={skin}
                side="right"
                hand="point"
                root={(t) => {
                    'worklet';
                    return -58 * pointing(t);
                }}
                joint={
                    rich
                        ? (t) => {
                              'worklet';
                              return -26 * pointing(t);
                          }
                        : undefined
                }
                {...part}
            />

            <Joint
                pivot={skeleton.neckBase}
                turn={(t) => {
                    'worklet';
                    return -7 * pointing(t);
                }}
                {...part}
            >
                <Head
                    at={skeleton.headCentre}
                    unit={UNIT}
                    skin={skin}
                    facing={0.5}
                    gaze={(t) => {
                        'worklet';
                        // On the picture. Naming something you are not looking at would be
                        // reciting, which is not what the card is checking.
                        return vec(0.9, -0.1 - 0.2 * pointing(t));
                    }}
                    mouthAt={(t) => {
                        'worklet';
                        return blendMouth(MOUTH.smile, MOUTH.ah, naming(t) * 0.8);
                    }}
                    {...part}
                />
            </Joint>

            {/*
              * The word, beside a small echo of what was named. A blob alone would say "a
              * word"; the blob and the bird together say "the word for that".
              */}
            <SpeechBubble
                at={BUBBLE_AT}
                width={186}
                words={1}
                tail="right"
                pop={naming}
                {...part}
            />
            {rich && (
                <Part
                    {...part}
                    style={{
                        position: 'absolute',
                        left: BUBBLE_AT.x + 34,
                        top: BUBBLE_AT.y - 20,
                        opacity: 0,
                    }}
                    animate={(t) => {
                        'worklet';
                        // Arrives with the bubble it lives in. Left at a fixed opacity it
                        // would sit there through the whole loop, including the stretches
                        // where nothing has been named.
                        return { opacity: 0.92 * naming(t) };
                    }}
                >
                    <Bird at={vec(0, 0)} size={34} />
                </Part>
            )}
        </Nursery>
    );
};

export default NamesPicturesScene;
