import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Indicator, Sex, referenceCurves } from '@vivamama/growth-standards';

import { globalStyles } from '../../public/styles';
import {
    ChartGeometry,
    ChildPoint,
    buildChartGeometry,
    curveValuesAt,
} from './chartGeometry';
import {
    CHART_HEIGHT,
    CHART_PADDING,
    CURVE_COLORS,
    POINT_RADIUS,
    chartTheme,
    curveDashArray,
    curveStrokeWidth,
} from './growthChart.theme';
import GrowthChartTooltip from './GrowthChartTooltip';

interface GrowthChartProps {
    indicator: Indicator;
    sex: Sex;
    /** The child's measurements, oldest first. Empty draws the reference curves alone. */
    childPoints: ChildPoint[];
    height?: number;
}

/**
 * WHO percentile chart: five reference curves, the child's trajectory, and a draggable
 * read-out of the curve values at any age.
 *
 * Drawn with react-native-svg rather than a chart library because the two things this
 * chart must get right are the two an index-based chart cannot express: a point at a
 * fractional age (6.01 months, not "the 6th sample"), and an axis that starts at 45 cm for
 * weight-for-length.
 *
 * All arithmetic lives in chartGeometry.ts. This component only turns coordinates into
 * elements.
 */
const GrowthChart: React.FC<GrowthChartProps> = ({
    indicator,
    sex,
    childPoints,
    height = CHART_HEIGHT,
}) => {
    const { t } = useTranslation();

    const [width, setWidth] = useState(0);
    const [probeX, setProbeX] = useState<number | null>(null);

    const geometry: ChartGeometry | null = useMemo(() => {
        if (width <= 0) return null;

        return buildChartGeometry({
            indicator,
            sex,
            width,
            height,
            padding: CHART_PADDING,
            childPoints,
        });
    }, [indicator, sex, width, height, childPoints]);

    // Memoised inside the standards package too, so this is a map lookup after the first
    // call for a given indicator and sex.
    const curves = useMemo(() => referenceCurves(indicator, sex), [indicator, sex]);

    const onLayout = (event: LayoutChangeEvent) =>
        setWidth(event.nativeEvent.layout.width);

    /**
     * Tap or drag anywhere on the plot to read the curves at that age.
     *
     * Gesture handler rather than PanResponder, with an x activation threshold: both places
     * this chart appears sit inside a vertical ScrollView, and without the threshold a
     * vertical swipe that starts on the chart would be swallowed instead of scrolling the
     * page.
     */
    const gesture = useMemo(() => {
        // runOnJS(true) rather than reanimated's worklet path: the handler only drives React
        // state, so there is nothing to gain from the UI thread and it keeps reanimated out
        // of this component entirely.
        const pan = Gesture.Pan()
            .runOnJS(true)
            .activeOffsetX([-6, 6])
            .onBegin((event) => setProbeX(event.x))
            .onUpdate((event) => setProbeX(event.x))
            .onFinalize(() => setProbeX(null));

        const tap = Gesture.Tap()
            .runOnJS(true)
            .onEnd((event) => setProbeX(event.x));

        return Gesture.Race(pan, tap);
    }, []);

    const probe = useMemo(() => {
        if (!geometry || probeX === null) return null;

        const clampedPx = Math.min(Math.max(probeX, geometry.plot.left), geometry.plot.right);
        const xValue = geometry.x.invert(clampedPx);

        return {
            px: clampedPx,
            xValue,
            values: curveValuesAt(geometry, curves, xValue),
        };
    }, [geometry, probeX, curves]);

    return (
        <View onLayout={onLayout} style={[styles.container, { height }]}>
            {geometry && (
                <GestureDetector gesture={gesture}>
                    <View style={StyleSheet.absoluteFill}>
                        <Svg width={width} height={height}>
                            {/* Horizontal gridlines and their value labels. */}
                            <G>
                                {geometry.yTicks.map((tick) => (
                                    <React.Fragment key={`y-${tick.value}`}>
                                        <Line
                                            x1={geometry.plot.left}
                                            y1={tick.py}
                                            x2={geometry.plot.right}
                                            y2={tick.py}
                                            stroke={chartTheme.grid}
                                            strokeWidth={1}
                                        />
                                        <SvgText
                                            x={geometry.plot.left - 6}
                                            y={tick.py + 3}
                                            fontSize={9}
                                            fill={chartTheme.axisLabel}
                                            textAnchor="end"
                                        >
                                            {tick.value}
                                        </SvgText>
                                    </React.Fragment>
                                ))}
                            </G>

                            {/* Vertical gridlines and their key labels. */}
                            <G>
                                {geometry.xTicks.map((tick) => (
                                    <React.Fragment key={`x-${tick.value}`}>
                                        <Line
                                            x1={tick.px}
                                            y1={geometry.plot.top}
                                            x2={tick.px}
                                            y2={geometry.plot.bottom}
                                            stroke={chartTheme.grid}
                                            strokeWidth={1}
                                        />
                                        <SvgText
                                            x={tick.px}
                                            y={geometry.plot.bottom + 14}
                                            fontSize={9}
                                            fill={chartTheme.axisLabel}
                                            textAnchor="middle"
                                        >
                                            {tick.value}
                                        </SvgText>
                                    </React.Fragment>
                                ))}
                            </G>

                            {/* The five WHO reference curves. */}
                            {geometry.curves.map((curve) => (
                                <Path
                                    key={curve.percentile}
                                    d={curve.d}
                                    fill="none"
                                    stroke={CURVE_COLORS[curve.percentile] ?? chartTheme.axis}
                                    strokeWidth={curveStrokeWidth(curve.percentile)}
                                    strokeDasharray={curveDashArray(curve.percentile)}
                                />
                            ))}

                            {/* Axes, drawn over the gridlines. */}
                            <Line
                                x1={geometry.plot.left}
                                y1={geometry.plot.bottom}
                                x2={geometry.plot.right}
                                y2={geometry.plot.bottom}
                                stroke={chartTheme.axis}
                                strokeWidth={1}
                            />
                            <Line
                                x1={geometry.plot.left}
                                y1={geometry.plot.top}
                                x2={geometry.plot.left}
                                y2={geometry.plot.bottom}
                                stroke={chartTheme.axis}
                                strokeWidth={1}
                            />

                            {/* The dashed guide at the probed position. */}
                            {probe && (
                                <Line
                                    x1={probe.px}
                                    y1={geometry.plot.top}
                                    x2={probe.px}
                                    y2={geometry.plot.bottom}
                                    stroke={chartTheme.guide}
                                    strokeWidth={1}
                                    strokeDasharray={chartTheme.guideDashArray}
                                />
                            )}

                            {/* The child's trajectory. */}
                            {geometry.childPath.length > 0 && (
                                <Path
                                    d={geometry.childPath}
                                    fill="none"
                                    stroke={chartTheme.childLine}
                                    strokeWidth={2}
                                />
                            )}

                            {geometry.childPixels.map((pixel, index) => (
                                <Circle
                                    key={`${pixel.point.measuredOn ?? index}`}
                                    cx={pixel.cx}
                                    cy={pixel.cy}
                                    r={POINT_RADIUS}
                                    fill={chartTheme.childPoint}
                                    stroke={chartTheme.childPointBorder}
                                    strokeWidth={2}
                                />
                            ))}
                        </Svg>

                        {/*
                          The latest point's label is a React Native <Text>, not <SvgText>,
                          so it picks up the app's font. Same approach VivaScoreGauge takes.
                        */}
                        {geometry.latest && (
                            <View
                                pointerEvents="none"
                                style={[
                                    styles.pointLabel,
                                    {
                                        left: Math.max(
                                            0,
                                            Math.min(
                                                geometry.latest.cx - 42,
                                                width - 84,
                                            ),
                                        ),
                                        top: Math.max(0, geometry.latest.cy - 26),
                                    },
                                ]}
                            >
                                <Text
                                    style={[styles.pointLabelText, globalStyles.fontSemiBold]}
                                    numberOfLines={1}
                                >
                                    {t('infant.growth.chartPointLabel', {
                                        value: geometry.latest.point.y.toFixed(
                                            geometry.valueUnit === 'kg' ? 2 : 1,
                                        ),
                                        unit: t(
                                            geometry.valueUnit === 'kg'
                                                ? 'infant.growth.unitKg'
                                                : 'infant.growth.unitCm',
                                        ),
                                    })}
                                </Text>
                            </View>
                        )}

                        {probe && (
                            <GrowthChartTooltip
                                x={probe.px}
                                chartWidth={width}
                                xValue={probe.xValue}
                                xKind={geometry.xKind}
                                valueUnit={geometry.valueUnit}
                                values={probe.values}
                            />
                        )}
                    </View>
                </GestureDetector>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },

    pointLabel: {
        position: 'absolute',
        backgroundColor: chartTheme.labelBackground,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },

    pointLabelText: {
        fontSize: 11,
        color: chartTheme.labelText,
    },
});

export default GrowthChart;
