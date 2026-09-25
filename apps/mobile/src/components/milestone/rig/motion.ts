/**
 * The timing arithmetic behind the milestone illustrations.
 *
 * Ported from the Claude-design artifact the scenes were authored in, so a curve tuned
 * there behaves identically here — same constants, same shapes. Every function is a
 * worklet: the scenes read one clock on the UI thread and derive every visible value from
 * it, so none of this may hop back to JS.
 *
 * Easings are named rather than passed as functions. A worklet can only call another
 * worklet, and function-valued properties on a captured object are exactly the case where
 * Reanimated's serialisation gets fragile — a string and a switch has no such failure mode
 * and costs nothing. Adding a curve means adding a case.
 */

export type EaseName =
    | 'linear'
    | 'easeInQuad'
    | 'easeOutQuad'
    | 'easeInOutQuad'
    | 'easeOutCubic'
    | 'easeInOutCubic'
    | 'easeInSine'
    | 'easeOutSine'
    | 'easeInOutSine'
    | 'easeOutBack'
    | 'easeOutElastic';

/** Apply a named easing to a normalised 0..1 progress. */
export function ease(name: EaseName, t: number): number {
    'worklet';

    switch (name) {
        case 'easeInQuad':
            return t * t;
        case 'easeOutQuad':
            return t * (2 - t);
        case 'easeInOutQuad':
            return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        case 'easeOutCubic': {
            const u = t - 1;
            return u * u * u + 1;
        }
        case 'easeInOutCubic':
            return t < 0.5
                ? 4 * t * t * t
                : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
        case 'easeInSine':
            return 1 - Math.cos((t * Math.PI) / 2);
        case 'easeOutSine':
            return Math.sin((t * Math.PI) / 2);
        case 'easeInOutSine':
            return -(Math.cos(Math.PI * t) - 1) / 2;
        case 'easeOutBack': {
            // The overshoot the artifact uses for a head lift — it carries past the target
            // and settles, which is what makes the motion read as effort rather than a slide.
            const c1 = 1.70158;
            const c3 = c1 + 1;
            return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        }
        case 'easeOutElastic': {
            if (t === 0) return 0;
            if (t === 1) return 1;
            const c4 = (2 * Math.PI) / 3;
            return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
        }
        case 'linear':
        default:
            return t;
    }
}

export function clamp(value: number, min: number, max: number): number {
    'worklet';
    return Math.max(min, Math.min(max, value));
}

export interface Tween {
    from?: number;
    to?: number;
    /** Seconds on the scene clock. */
    start: number;
    end: number;
    ease?: EaseName;
}

/**
 * A single-segment tween sampled at time `t`.
 *
 * Holds `from` before `start` and `to` after `end`, which is what lets a scene describe a
 * whole 10-second performance as a handful of overlapping tweens rather than a state
 * machine — each one simply does nothing outside its own window.
 */
export function animate(t: number, tween: Tween): number {
    'worklet';

    const from = tween.from ?? 0;
    const to = tween.to ?? 1;

    if (t <= tween.start) return from;
    if (t >= tween.end) return to;

    const span = tween.end - tween.start;
    const local = span === 0 ? 1 : (t - tween.start) / span;

    return from + (to - from) * ease(tween.ease ?? 'easeInOutCubic', local);
}

/**
 * Multi-stop interpolation, Popmotion-style: maps `t` across `input` onto `output`.
 *
 * Used where a value has to pass through an intermediate — a limb that rises, holds, then
 * drops — which a pair of overlapping tweens can express but far less legibly.
 */
export function interpolate(
    t: number,
    input: readonly number[],
    output: readonly number[],
    easeName: EaseName = 'linear',
): number {
    'worklet';

    if (input.length === 0) return 0;
    if (t <= input[0]) return output[0];
    if (t >= input[input.length - 1]) return output[output.length - 1];

    for (let i = 0; i < input.length - 1; i++) {
        if (t >= input[i] && t <= input[i + 1]) {
            const span = input[i + 1] - input[i];
            const local = span === 0 ? 0 : (t - input[i]) / span;
            return output[i] + (output[i + 1] - output[i]) * ease(easeName, local);
        }
    }

    return output[output.length - 1];
}

/** Degrees to a CSS-style rotate string, which is what RN's transform takes. */
export function deg(value: number): string {
    'worklet';
    return `${value}deg`;
}
