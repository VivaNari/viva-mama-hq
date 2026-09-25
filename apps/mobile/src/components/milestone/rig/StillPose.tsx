import React from 'react';
import { View } from 'react-native';

import { Nursery, ContactShadow } from './Nursery';
import { SCENE, SKIN, SkinTone } from './palette';
import { capsule, dot } from './parts';

/**
 * A still illustration for a milestone that has no authored animation.
 *
 * Four postures cover all thirty-three. That is the trade this rig exists to make: an
 * animated scene is a hand-tuned performance and costs a day, while a still pose is a
 * posture plus a prop and costs minutes — so every milestone gets a real drawing in the
 * same art style now, and any of them can be promoted to a full scene later without the
 * card around it changing.
 *
 * The prop in the baby's world does the identifying work: a mirror for "likes to look at
 * self", a cup for "drinks from a cup", a container for "puts pebbles in a container".
 */

export type Posture = 'tummy' | 'sitting' | 'standing' | 'closeUp';
export type Prop = 'none' | 'rattle' | 'mirror' | 'cup' | 'container' | 'book' | 'blocks';

interface StillPoseProps {
    posture: Posture;
    prop?: Prop;
    skinTone?: SkinTone;
}

const PropPiece: React.FC<{ prop: Prop; skin: ReturnType<() => typeof SKIN.warm> }> = ({
    prop,
}) => {
    switch (prop) {
        case 'rattle':
            return (
                <View style={{ position: 'absolute', left: 566, top: 286 }}>
                    <View style={{ ...capsule(0, 44, 16, 58, SCENE.toyPink), borderRadius: 8 }} />
                    <View style={dot(-20, 0, 56, SCENE.toyLilac)} />
                </View>
            );
        case 'mirror':
            return (
                <View
                    style={{
                        position: 'absolute',
                        left: 556,
                        top: 250,
                        width: 96,
                        height: 118,
                        borderRadius: 48,
                        backgroundColor: SCENE.windowFill,
                        borderWidth: 9,
                        borderColor: SCENE.toyLilac,
                    }}
                />
            );
        case 'cup':
            return (
                <View
                    style={{
                        position: 'absolute',
                        left: 560,
                        top: 286,
                        width: 62,
                        height: 74,
                        borderTopLeftRadius: 10,
                        borderTopRightRadius: 10,
                        borderBottomRightRadius: 26,
                        borderBottomLeftRadius: 26,
                        backgroundColor: SCENE.toyPink,
                    }}
                />
            );
        case 'container':
            return (
                <View style={{ position: 'absolute', left: 548, top: 300 }}>
                    <View
                        style={{
                            width: 104,
                            height: 66,
                            borderBottomLeftRadius: 18,
                            borderBottomRightRadius: 18,
                            backgroundColor: SCENE.toyLilac,
                        }}
                    />
                    <View style={dot(18, -26, 22, SCENE.toyPink)} />
                    <View style={dot(54, -18, 16, SCENE.toyPink)} />
                </View>
            );
        case 'book':
            return (
                <View style={{ position: 'absolute', left: 540, top: 318 }}>
                    <View
                        style={{
                            width: 120,
                            height: 12,
                            borderRadius: 4,
                            backgroundColor: SCENE.toyLilac,
                        }}
                    />
                    <View
                        style={{
                            position: 'absolute',
                            left: 6,
                            top: -44,
                            width: 108,
                            height: 46,
                            borderTopLeftRadius: 8,
                            borderTopRightRadius: 8,
                            backgroundColor: SCENE.windowFill,
                            transform: [{ rotate: '-4deg' }],
                        }}
                    />
                </View>
            );
        case 'blocks':
            return (
                <View style={{ position: 'absolute', left: 566, top: 288 }}>
                    <View
                        style={{
                            width: 58,
                            height: 58,
                            borderRadius: 10,
                            backgroundColor: SCENE.toyLilac,
                            marginTop: 58,
                        }}
                    />
                    <View
                        style={{
                            position: 'absolute',
                            width: 58,
                            height: 58,
                            borderRadius: 10,
                            backgroundColor: SCENE.toyPink,
                        }}
                    />
                </View>
            );
        default:
            return null;
    }
};

/** Head, drawn face-on or in profile, at a given origin. */
const Head: React.FC<{
    left: number;
    top: number;
    skin: typeof SKIN.warm;
    faceOn?: boolean;
    size?: number;
}> = ({ left, top, skin, faceOn = false, size = 132 }) => (
    <View style={{ position: 'absolute', left, top, width: 0, height: 0 }}>
        <View
            style={{
                ...dot(-size / 2, -size, size, skin.skin),
                boxShadow: 'inset -10px -14px 22px rgba(0,0,0,0.08)',
            }}
        />
        <View
            style={{
                position: 'absolute',
                left: -size / 2 + 2,
                top: -size - 6,
                width: size * 0.68,
                height: size * 0.44,
                borderTopLeftRadius: size / 2,
                borderTopRightRadius: size / 2,
                borderBottomRightRadius: size * 0.22,
                borderBottomLeftRadius: size * 0.3,
                backgroundColor: skin.hair,
                transform: [{ rotate: '-10deg' }],
            }}
        />
        {faceOn ? (
            <>
                <View style={dot(-size * 0.28, -size * 0.62, 16, SCENE.eye)} />
                <View style={dot(size * 0.1, -size * 0.62, 16, SCENE.eye)} />
                <View style={{ ...dot(-size * 0.34, -size * 0.4, 28, SCENE.cheek), height: 20 }} />
                <View style={{ ...dot(size * 0.12, -size * 0.4, 28, SCENE.cheek), height: 20 }} />
                <View
                    style={{
                        position: 'absolute',
                        left: -16,
                        top: -size * 0.34,
                        width: 32,
                        height: 15,
                        borderBottomLeftRadius: 16,
                        borderBottomRightRadius: 16,
                        backgroundColor: SCENE.mouth,
                    }}
                />
            </>
        ) : (
            <>
                <View style={dot(size * 0.12, -size * 0.62, 16, SCENE.eye)} />
                <View style={{ ...dot(-size * 0.1, -size * 0.4, 28, SCENE.cheek), height: 20 }} />
                <View style={dot(size * 0.3, -size * 0.46, 14, skin.shade)} />
                <View
                    style={{
                        position: 'absolute',
                        left: size * 0.1,
                        top: -size * 0.3,
                        width: 26,
                        height: 13,
                        borderBottomLeftRadius: 14,
                        borderBottomRightRadius: 14,
                        backgroundColor: SCENE.mouth,
                    }}
                />
                <View style={dot(-size * 0.42, -size * 0.56, 28, skin.shade)} />
            </>
        )}
    </View>
);

const StillPose: React.FC<StillPoseProps> = ({ posture, prop = 'none', skinTone = 'warm' }) => {
    const skin = SKIN[skinTone];

    return (
        <Nursery mat={posture !== 'closeUp'}>
            {posture !== 'closeUp' && (
                <ContactShadow left={180} top={352} width={300} height={44} />
            )}

            {posture === 'tummy' && (
                <>
                    <View style={{ ...capsule(140, 318, 128, 44, skin.shade), transform: [{ rotate: '-10deg' }] }} />
                    <View style={{ ...capsule(158, 330, 124, 50, SCENE.romper), transform: [{ rotate: '-6deg' }] }} />
                    <View style={{ ...capsule(92, 344, 92, 40, skin.skin), transform: [{ rotate: '16deg' }] }} />
                    <View
                        style={{
                            position: 'absolute',
                            left: 232,
                            top: 282,
                            width: 208,
                            height: 104,
                            borderTopLeftRadius: 104,
                            borderTopRightRadius: 92,
                            borderBottomRightRadius: 88,
                            borderBottomLeftRadius: 108,
                            backgroundColor: SCENE.romper,
                            transform: [{ rotate: '-9deg' }],
                        }}
                    />
                    <View style={{ ...capsule(386, 278, 76, 40, skin.skin), transform: [{ rotate: '38deg' }] }} />
                    <View style={{ ...capsule(430, 306, 82, 36, skin.shade), transform: [{ rotate: '-2deg' }] }} />
                    <View style={dot(500, 300, 38, skin.skin)} />
                    <Head left={470} top={288} skin={skin} />
                </>
            )}

            {posture === 'sitting' && (
                <>
                    <View style={{ ...capsule(258, 352, 190, 46, skin.shade), transform: [{ rotate: '4deg' }] }} />
                    <View style={{ ...capsule(268, 336, 180, 48, SCENE.romper), transform: [{ rotate: '-2deg' }] }} />
                    <View style={dot(232, 344, 40, skin.skin)} />
                    <View
                        style={{
                            position: 'absolute',
                            left: 392,
                            top: 236,
                            width: 132,
                            height: 130,
                            borderTopLeftRadius: 62,
                            borderTopRightRadius: 62,
                            borderBottomRightRadius: 40,
                            borderBottomLeftRadius: 40,
                            backgroundColor: SCENE.romper,
                        }}
                    />
                    <View style={{ ...capsule(360, 262, 74, 36, skin.skin), transform: [{ rotate: '28deg' }] }} />
                    <View style={{ ...capsule(492, 262, 74, 36, skin.skin), transform: [{ rotate: '-28deg' }] }} />
                    <Head left={458} top={240} skin={skin} faceOn />
                </>
            )}

            {posture === 'standing' && (
                <>
                    <View style={{ ...capsule(410, 320, 44, 108, skin.shade), transform: [{ rotate: '4deg' }] }} />
                    <View style={{ ...capsule(464, 320, 44, 108, skin.skin), transform: [{ rotate: '-4deg' }] }} />
                    <View style={{ ...capsule(398, 410, 68, 30, skin.skin) }} />
                    <View style={{ ...capsule(462, 412, 68, 30, skin.skin) }} />
                    <View
                        style={{
                            position: 'absolute',
                            left: 398,
                            top: 214,
                            width: 128,
                            height: 122,
                            borderTopLeftRadius: 56,
                            borderTopRightRadius: 56,
                            borderBottomRightRadius: 34,
                            borderBottomLeftRadius: 34,
                            backgroundColor: SCENE.romper,
                        }}
                    />
                    <View style={{ ...capsule(358, 232, 70, 34, skin.skin), transform: [{ rotate: '22deg' }] }} />
                    <View style={{ ...capsule(496, 230, 70, 34, skin.skin), transform: [{ rotate: '-30deg' }] }} />
                    <Head left={462} top={218} skin={skin} faceOn />
                </>
            )}

            {posture === 'closeUp' && (
                <>
                    <View
                        style={{
                            position: 'absolute',
                            left: 252,
                            top: 356,
                            width: 216,
                            height: 130,
                            borderTopLeftRadius: 70,
                            borderTopRightRadius: 70,
                            backgroundColor: SCENE.romper,
                        }}
                    />
                    <Head left={360} top={356} skin={skin} faceOn size={210} />
                </>
            )}

            <PropPiece prop={prop} skin={skin} />
        </Nursery>
    );
};

export default StillPose;
