import { GRAMS_PER_KG, IN_TO_CM, LB_TO_KG } from "./constants";
import { GrowthMeasurement } from "./types";

/**
 * Unit normalisation.
 *
 * Everything downstream of this file is kilograms and centimetres — WHO's units, and the
 * units growth logs are stored in. Conversion happens once, at the boundary, and never on
 * a rounded value: rounding before the z-score moves the percentile visibly.
 */

export const gramsToKg = (grams: number): number => grams / GRAMS_PER_KG;

export const kgToGrams = (kg: number): number => kg * GRAMS_PER_KG;

/** Both factors are exact by definition, so these conversions lose nothing. */
export const lbToKg = (lb: number): number => lb * LB_TO_KG;
export const inToCm = (inches: number): number => inches * IN_TO_CM;

/**
 * The child's day-0 growth point, from the birth measurements baby onboarding captured.
 *
 * The one place grams become kilograms. `birth_measurements` stores weight in grams
 * (the unit a hospital reports and a mother repeats), WHO works in kilograms, and two units
 * for one quantity in one codebase is a bug factory — so every caller routes through here
 * rather than dividing by 1000 in place.
 */
export const birthMeasurementsToGrowthPoint = (birth: {
    weight_grams?: number | null;
    length_cm?: number | null;
    head_circumference_cm?: number | null;
}): GrowthMeasurement => ({
    weight_kg:
        birth.weight_grams === undefined || birth.weight_grams === null
            ? null
            : gramsToKg(birth.weight_grams),
    length_cm: birth.length_cm ?? null,
    head_circumference_cm: birth.head_circumference_cm ?? null,
});
