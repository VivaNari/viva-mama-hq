import { calculatePostpartumState } from "./postpartumWeek";

/**
 * Backwards-compatible shape for the existing call sites (onboarding, profile edit).
 *
 * The real logic lives in `calculatePostpartumState`, which also returns the check-in
 * due-day counters. Prefer calling that directly in new code; this wrapper exists so the
 * onboarding paths that only ever wanted `{ mode, weeks, days }` keep working.
 */
export const calculateUserCurrentWeek = (
    deliveryDate: Date,
    now: Date = new Date(),
): { mode: string; weeks: number; days: number } => {
    const { mode, weeks, days } = calculatePostpartumState(deliveryDate, now);
    return { mode, weeks, days };
};
