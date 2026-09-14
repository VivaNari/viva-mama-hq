import React, { ReactNode } from 'react';
import { View } from 'react-native';

import { SCENE } from './palette';
import { STAGE_HEIGHT, STAGE_WIDTH, Stripes } from './parts';

/**
 * The room every milestone scene is set in.
 *
 * Shared rather than repeated per scene for two reasons: 33 copies of a wall would be 33
 * places to fix a colour, and a parent flipping between milestones should feel they are
 * watching the same baby in the same room rather than a series of unrelated drawings.
 */

interface NurseryProps {
    /** Draw the play mat. Scenes set on the floor want it; a scene in arms does not. */
    mat?: boolean;
    children?: ReactNode;
}

export const Nursery: React.FC<NurseryProps> = ({ mat = true, children }) => (
    <View
        style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: STAGE_WIDTH,
            height: STAGE_HEIGHT,
            backgroundColor: SCENE.backdrop,
        }}
    >
        {/* wall */}
        <View
            style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: STAGE_WIDTH,
                height: 262,
                experimental_backgroundImage: `linear-gradient(180deg, ${SCENE.wallTop} 0%, ${SCENE.wallBottom} 100%)`,
            }}
        />
        <View
            style={{
                position: 'absolute',
                left: 0,
                top: 262,
                width: STAGE_WIDTH,
                height: 218,
                backgroundColor: SCENE.floor,
            }}
        />
        <View
            style={{
                position: 'absolute',
                left: 0,
                top: 256,
                width: STAGE_WIDTH,
                height: 10,
                backgroundColor: SCENE.skirting,
            }}
        />

        {/* window */}
        <View
            style={{
                position: 'absolute',
                left: 92,
                top: 54,
                width: 168,
                height: 150,
                borderRadius: 12,
                backgroundColor: SCENE.windowFill,
                borderWidth: 10,
                borderColor: SCENE.windowFrame,
            }}
        />

        {/* a low shelf, to give the right-hand side something to sit against */}
        <View
            style={{
                position: 'absolute',
                left: 470,
                top: 132,
                width: 160,
                height: 76,
                borderTopLeftRadius: 14,
                borderTopRightRadius: 14,
                borderBottomLeftRadius: 4,
                borderBottomRightRadius: 4,
                backgroundColor: SCENE.furniture,
            }}
        />

        {mat && (
            <>
                <Stripes
                    width={556}
                    height={138}
                    colors={[SCENE.matStripeA, SCENE.matStripeB]}
                    style={{
                        position: 'absolute',
                        left: 82,
                        top: 292,
                        borderRadius: 69,
                    }}
                />
                <View
                    style={{
                        position: 'absolute',
                        left: 132,
                        top: 312,
                        width: 456,
                        height: 100,
                        borderRadius: 50,
                        backgroundColor: SCENE.matInner,
                    }}
                />
            </>
        )}

        {children}
    </View>
);

/**
 * The soft shadow a baby casts on the mat.
 *
 * `filter: blur` is real in React Native 0.81, but on Android it is backed by RenderEffect
 * and needs API 31+. Below that it simply does not blur and this reads as a flat ellipse —
 * softer than nothing, and not worth a second code path.
 */
export const ContactShadow: React.FC<{
    left: number;
    top: number;
    width: number;
    height: number;
}> = ({ left, top, width, height }) => (
    <View
        style={{
            position: 'absolute',
            left,
            top,
            width,
            height,
            borderRadius: height / 2,
            backgroundColor: SCENE.shadow,
            filter: [{ blur: 7 }],
        }}
    />
);
