import { IGrowthMeasurementField } from '../types/infantLog.types';

/**
 * The three measurements the PRD asks for at every growth log, in the design's order.
 *
 * The same three are captured at birth during baby onboarding (as the day-0 point), which
 * is why the keys match `IChildBirthMeasurements` exactly — the growth series and its
 * first point share a shape.
 */
export const GROWTH_FIELDS: IGrowthMeasurementField[] = [
  {
    key: 'head_circumference_cm',
    labelKey: 'infant.growth.headLabel',
    unitKey: 'infant.growth.unitCm',
    placeholder: '36.2',
  },
  {
    key: 'length_cm',
    labelKey: 'infant.growth.lengthLabel',
    unitKey: 'infant.growth.unitCm',
    placeholder: '52.0',
  },
  {
    key: 'weight_grams',
    labelKey: 'infant.growth.weightLabel',
    unitKey: 'infant.growth.unitGrams',
    placeholder: '3600',
  },
];

/**
 * Sane bounds for an ongoing growth entry.
 *
 * Wider than the birth bounds in the backend's MEASUREMENT_BOUNDS
 * (services/backend/src/services/chat-system/child-onboarding.projection.ts), because those
 * describe a newborn and this screen follows the child to two years — a toddler is past
 * both the 100 cm and 8 kg ceilings a birth measurement is held to.
 *
 * They exist to catch a slipped decimal or a weight typed in kilograms, not to make a
 * clinical judgement: anything inside the range is accepted as entered.
 */
export const GROWTH_BOUNDS: Record<
  IGrowthMeasurementField['key'],
  { min: number; max: number }
> = {
  head_circumference_cm: { min: 20, max: 60 },
  length_cm: { min: 30, max: 110 },
  weight_grams: { min: 500, max: 20000 },
};
