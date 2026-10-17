/**
 * Linear scales — the mapping between data values and pixels.
 *
 * A hand-rolled chart needs exactly this and little else, and keeping it in its own module
 * means the arithmetic can be tested without rendering anything. It is also the reason
 * this chart is drawn with react-native-svg rather than a chart library: the point for a
 * child measured at 6.01 months has to land at 6.01 months, and weight-for-length's axis
 * has to start at 45 cm — neither is expressible on an index-based x-axis.
 */

export interface LinearScale {
    /** Data value -> pixel position. */
    scale: (value: number) => number;
    /** Pixel position -> data value. Used to turn a touch into an age. */
    invert: (pixel: number) => number;
    domain: readonly [number, number];
    range: readonly [number, number];
}

export const createLinearScale = ({
    domain,
    range,
}: {
    domain: readonly [number, number];
    range: readonly [number, number];
}): LinearScale => {
    const [d0, d1] = domain;
    const [r0, r1] = range;

    // A zero-width domain would divide by zero. It only happens with degenerate data, and
    // pinning everything to the start of the range keeps the chart drawable.
    const span = d1 - d0;
    const ratio = span === 0 ? 0 : (r1 - r0) / span;

    return {
        domain,
        range,
        scale: (value) => r0 + (value - d0) * ratio,
        invert: (pixel) => (ratio === 0 ? d0 : d0 + (pixel - r0) / ratio),
    };
};

/**
 * Round, human-looking tick values covering a domain.
 *
 * Chooses a step from the 1/2/5/10 family so the axis reads 0, 5, 10, 15 rather than
 * 0, 4.8, 9.6 — the same reason every charting library does this.
 */
export const niceTicks = (
    domain: readonly [number, number],
    targetCount: number,
): number[] => {
    const [min, max] = domain;
    const span = max - min;

    if (span <= 0 || targetCount < 1) return [min];

    const rawStep = span / targetCount;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalised = rawStep / magnitude;

    const step =
        (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;

    const first = Math.ceil(min / step) * step;
    const ticks: number[] = [];

    // The 1e-9 slack absorbs the float drift that otherwise drops the final tick.
    for (let tick = first; tick <= max + 1e-9; tick += step) {
        // Re-round each tick: repeated addition of 0.1 drifts to 0.30000000000000004.
        ticks.push(Number(tick.toFixed(6)));
    }

    return ticks;
};

/** Pads a value range so the outermost curves are not drawn flush against the frame. */
export const padDomain = (
    domain: readonly [number, number],
    fraction = 0.05,
): readonly [number, number] => {
    const [min, max] = domain;
    const padding = (max - min) * fraction;
    return [min - padding, max + padding];
};
