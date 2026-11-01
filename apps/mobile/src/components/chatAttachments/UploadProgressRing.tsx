import React from 'react';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../../public/assets/colors';

interface IUploadProgressRingProps {
    /** 0-1. */
    progress: number;
    size?: number;
    strokeWidth?: number;
}

/** Determinate upload progress, drawn over a thumbnail. */
const UploadProgressRing = ({ progress, size = 28, strokeWidth = 3 }: IUploadProgressRingProps) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0.04, Math.min(1, progress));
    return (
        <Svg width={size} height={size} accessibilityElementsHidden importantForAccessibility="no">
            <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="rgba(255,255,255,0.45)"
                strokeWidth={strokeWidth}
                fill="rgba(0,0,0,0.35)"
            />
            <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={colors.white}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference * (1 - clamped)}
                strokeLinecap="round"
                rotation={-90}
                originX={size / 2}
                originY={size / 2}
            />
        </Svg>
    );
};

export default UploadProgressRing;
