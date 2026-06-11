import React, { JSX, useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View, Text, Animated } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { globalStyles } from '../public/styles';

const { width } = Dimensions.get('window');

interface VivaScoreGaugeProps {
    percentage?: number;
    size?: number;
    strokeWidth?: number;
}

interface AnimatedGaugeContentProps {
    percentage: number;
    size: number;
    strokeWidth: number;
}

export default function VivaScoreGauge({
    percentage = 0,
    size = width,
    strokeWidth = 50
}: VivaScoreGaugeProps): JSX.Element {
    return (
        <AnimatedGaugeContent
            percentage={percentage}
            size={size}
            strokeWidth={strokeWidth}
        />
    );
}

function AnimatedGaugeContent({
    percentage,
    size,
    strokeWidth
}: AnimatedGaugeContentProps): JSX.Element {
    const animatedValue = useRef(new Animated.Value(0)).current;
    const [displayScore, setDisplayScore] = useState<number>(0);

    useEffect(() => {
        // Reset and animate to new value
        animatedValue.setValue(0);

        Animated.timing(animatedValue, {
            toValue: percentage,
            duration: 800,
            useNativeDriver: false,
        }).start();

        // Listen to animation updates
        const listenerId = animatedValue.addListener(({ value }: { value: number }) => {
            setDisplayScore(value);
        });

        return () => {
            animatedValue.removeListener(listenerId);
        };
    }, [percentage, animatedValue]);

    const clampedPercentage = Math.max(0, Math.min(100, displayScore));

    const radius = (size - strokeWidth) / 2;
    const cx = size / 2;
    const cy = size / 2;

    const angleRad = (1 - clampedPercentage / 100) * Math.PI;

    const indicatorX = cx + radius * Math.cos(angleRad);
    const indicatorY = cy - radius * Math.sin(angleRad);

    // Path for the semi-circle arc
    const arcPath = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;

    // Labels to display at the bottom
    const labels: number[] = [0, 25, 50, 75, 100];

    return (
        <View style={[styles.gaugeContainer, { width: '100%', padding: 0 }]}>
            <Svg
                height={size / 2 + strokeWidth}
                width="100%"
                viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}
            >
                <Defs>
                    <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor="#F47741" />
                        <Stop offset="50%" stopColor="#F4B841" />
                        <Stop offset="100%" stopColor="#86C553" />
                    </LinearGradient>
                </Defs>

                {/* Background Arc */}
                <Path
                    d={arcPath}
                    fill="none"
                    stroke="#E8E8E8"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />

                {/* Foreground/Progress Arc */}
                <Path
                    d={arcPath}
                    fill="none"
                    stroke="url(#grad)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />

                {/* Animated Indicator Circle */}
                <Circle
                    cx={indicatorX}
                    cy={indicatorY}
                    r={strokeWidth / 2}
                    fill="white"
                    stroke="#E8E8E8"
                    strokeWidth="2"
                />
            </Svg>

            {/* Labels positioned at the bottom */}
            <View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    width: size,
                    height: size / 2 + strokeWidth,
                    top: 0,
                }}
            >
                {labels.map((label: number) => {
                    const angle = Math.PI * (1 - label / 100);

                    // Slightly outside the arc
                    const labelRadius = radius - strokeWidth * 1.6;

                    const x = cx + labelRadius * Math.cos(angle);
                    const y = cy - labelRadius * Math.sin(angle);

                    return (
                        <Text
                            key={label}
                            style={[
                                globalStyles.fontSemiBold,
                                {
                                    position: 'absolute',
                                    left: x - 10,
                                    top: y - strokeWidth * 0.5,
                                    fontSize: 13,
                                    fontWeight: '600',
                                    color: '#6B6B6B',
                                },
                            ]}
                        >
                            {label}
                        </Text>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    gaugeContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
});