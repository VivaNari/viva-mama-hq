import { colors } from '../../public/assets/colors';
import { ChartPadding } from './chartGeometry';

/**
 * Visual constants for the growth chart.
 *
 * Kept out of the component so the geometry tests can reference the same padding the
 * renderer uses, and so the palette stays in one place rather than inline in path props.
 */

/**
 * Curve colours, keyed by percentile.
 *
 * Deliberately a single hue at varying weight rather than a red/amber/green ramp. A
 * traffic-light chart tells a mother that her baby's position is good or bad, which is a
 * clinical judgement this product does not make — the 3rd percentile is a healthy place
 * for three in every hundred children to be.
 */
export const CURVE_COLORS: Record<number, string> = {
    3: '#C7C4E8',
    15: '#A9A4DC',
    50: colors.purple,
    85: '#A9A4DC',
    97: '#C7C4E8',
};

/** The median gets more weight — it is the line the eye should find first. */
export const curveStrokeWidth = (percentile: number): number => (percentile === 50 ? 2 : 1.25);

/** The outer pair are dashed, so the reference range reads as a band, not a boundary. */
export const curveDashArray = (percentile: number): string | undefined =>
    percentile === 3 || percentile === 97 ? '5,4' : undefined;

export const chartTheme = {
    grid: colors.lightGray,
    axis: colors.mediumGray,
    axisLabel: colors.gray,
    childLine: colors.darkPurple,
    childPoint: colors.darkPurple,
    childPointBorder: colors.white,
    guide: colors.darkPurple,
    guideDashArray: '4,4',
    labelBackground: colors.darkPurple,
    labelText: colors.white,
} as const;

export const CHART_PADDING: ChartPadding = {
    top: 16,
    right: 16,
    // Room for the x-axis labels and its caption.
    bottom: 34,
    // Room for y-axis labels, which run to four characters ("20.5").
    left: 38,
};

export const CHART_HEIGHT = 260;

export const POINT_RADIUS = 5;
