import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const { width } = Dimensions.get("window");


export default function VivaScoreGauge({ percentage = 0, size = width, strokeWidth = 50 }) {
    const [score, setScore] = useState(0);

    useEffect(() => {
        setScore(percentage)
    }, [])

    const clampedPercentage = Math.max(0, Math.min(100, score));

    const radius = (size - strokeWidth) / 2;
    const cx = size / 2;
    const cy = size / 2;

    const angleRad = (1 - clampedPercentage / 100) * Math.PI;

    const indicatorX = cx + radius * Math.cos(angleRad);
    const indicatorY = cy - radius * Math.sin(angleRad);

    // Path for the semi-circle arc
    const arcPath = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;


    return (
        <View style={[styles.gaugeContainer, { width: '100%', padding: 0 }]}>
            <Svg height={size / 2 + strokeWidth} width={'100%'} viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}>
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

                {/* Indicator Circle */}
                <Circle
                    cx={indicatorX}
                    cy={indicatorY}
                    r={strokeWidth / 2}
                    fill="white"
                    stroke="#E8E8E8"
                    strokeWidth="2"
                />
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    appContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F5F5F5',
        padding: 20,
    },
    gaugeWrapper: {
        alignItems: 'center',
    },
    gaugeContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        position: 'absolute',
        alignItems: 'center',
        top: '30%',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    subtitle: {
        fontSize: 14,
        color: '#888',
    },
    sliderContainer: {
        width: '90%',
        maxWidth: 320,
        alignItems: 'stretch',
        padding: 20,
        backgroundColor: '#FFF',
        borderRadius: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
        marginBottom: 20,
    },
    sliderLabel: {
        fontSize: 16,
        marginBottom: 10,
        color: '#555',
        textAlign: 'center',
    },
    geminiButton: {
        backgroundColor: '#4A90E2',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginTop: 10,
        alignItems: 'center',
    },
    geminiButtonDisabled: {
        backgroundColor: '#AECBFA',
    },
    geminiButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    insightContainer: {
        width: '90%',
        maxWidth: 400,
        marginTop: 20,
        padding: 15,
        backgroundColor: '#E3F2FD',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#BBDEFB',
    },
    insightText: {
        color: '#1E88E5',
        textAlign: 'left',
        lineHeight: 22,
    },
    errorText: {
        marginTop: 20,
        color: '#D32F2F',
        fontWeight: 'bold',
        textAlign: 'center',
    }
});

