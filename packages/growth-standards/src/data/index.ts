/**
 * GENERATED — do not edit by hand.
 * Regenerate: pnpm --filter @vivamama/growth-standards run generate
 */
import { Indicator, LmsTable, Sex } from "../types";

import { WEIGHT_FOR_AGE_BOYS } from "./weight-for-age.boys";
import { WEIGHT_FOR_AGE_GIRLS } from "./weight-for-age.girls";
import { LENGTH_FOR_AGE_BOYS } from "./length-for-age.boys";
import { LENGTH_FOR_AGE_GIRLS } from "./length-for-age.girls";
import { HEAD_CIRCUMFERENCE_FOR_AGE_BOYS } from "./head-circumference-for-age.boys";
import { HEAD_CIRCUMFERENCE_FOR_AGE_GIRLS } from "./head-circumference-for-age.girls";
import { WEIGHT_FOR_LENGTH_BOYS } from "./weight-for-length.boys";
import { WEIGHT_FOR_LENGTH_GIRLS } from "./weight-for-length.girls";

export type TableKey = `${Indicator}:${Sex}`;

/** Every WHO table, addressed by indicator and sex. */
export const TABLES: Readonly<Record<TableKey, LmsTable>> = {
    "weight_for_age:Male": WEIGHT_FOR_AGE_BOYS,
    "weight_for_age:Female": WEIGHT_FOR_AGE_GIRLS,
    "length_for_age:Male": LENGTH_FOR_AGE_BOYS,
    "length_for_age:Female": LENGTH_FOR_AGE_GIRLS,
    "head_circumference_for_age:Male": HEAD_CIRCUMFERENCE_FOR_AGE_BOYS,
    "head_circumference_for_age:Female": HEAD_CIRCUMFERENCE_FOR_AGE_GIRLS,
    "weight_for_length:Male": WEIGHT_FOR_LENGTH_BOYS,
    "weight_for_length:Female": WEIGHT_FOR_LENGTH_GIRLS,
};

export const tableFor = (indicator: Indicator, sex: Sex): LmsTable | null =>
    TABLES[`${indicator}:${sex}`] ?? null;
