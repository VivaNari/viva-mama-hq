const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;

/** Mirrored server-side in services/backend/src/constants/onboarding.ts. Keep in step. */
export const WEIGHT_KG_BOUNDS = { min: 30, max: 200 };
export const HEIGHT_CM_BOUNDS = { min: 100, max: 220 };

export type WeightUnit = 'kg' | 'lb';
export type HeightUnit = 'cm' | 'ft';

const toNumber = (raw: string): number | null => {
    const value = Number.parseFloat(raw.trim());
    return Number.isFinite(value) ? value : null;
};

const inBounds = (value: number, bounds: { min: number; max: number }) =>
    value >= bounds.min && value <= bounds.max;

/** Weight in kg to one decimal, or null when it is not a usable weight. */
export const toWeightKg = (raw: string, unit: WeightUnit): number | null => {
    const value = toNumber(raw);
    if (value === null) return null;
    const kg = Math.round((unit === 'lb' ? value * KG_PER_LB : value) * 10) / 10;
    return inBounds(kg, WEIGHT_KG_BOUNDS) ? kg : null;
};

/** Height in whole cm, or null when it is not a usable height. */
export const toHeightCm = (
    primary: string,
    inches: string,
    unit: HeightUnit,
): number | null => {
    const value = toNumber(primary);
    if (value === null) return null;

    let cm = value;
    if (unit === 'ft') {
        const extra = inches.trim() ? toNumber(inches) : 0;
        if (extra === null || extra < 0 || extra >= 12) return null;
        cm = (value * 12 + extra) * CM_PER_INCH;
    }

    const rounded = Math.round(cm);
    return inBounds(rounded, HEIGHT_CM_BOUNDS) ? rounded : null;
};

/** The lowest and highest weight allowed, in the unit she is using. */
export const weightBoundsIn = (unit: WeightUnit): { min: number; max: number } =>
    unit === 'kg'
        ? WEIGHT_KG_BOUNDS
        : {
              min: Math.ceil(WEIGHT_KG_BOUNDS.min / KG_PER_LB),
              max: Math.floor(WEIGHT_KG_BOUNDS.max / KG_PER_LB),
          };
