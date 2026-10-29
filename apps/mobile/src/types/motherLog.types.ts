/**
 * The mother's own logs, as the backend's single log engine stores them. Enum values
 * are the backend's snake_case; screens translate them with `i18nKey`.
 */

export type AppendLogType =
  | 'bp'
  | 'sugar'
  | 'weight'
  | 'hb'
  | 'temperature'
  | 'urine_protein'
  | 'fetal_heart_rate'
  | 'pumping'
  | 'meal'
  | 'anc_visit';

export type DailyLogType = 'water' | 'kicks';

export type SugarTiming = 'fasting' | 'post_meal';
export type PumpingSide = 'left' | 'right' | 'both';
export type MealTime = 'breakfast' | 'lunch' | 'evening_snack' | 'dinner';
export type MealFood =
  | 'dal'
  | 'rice'
  | 'vegetables'
  | 'roti'
  | 'curd'
  | 'fruit'
  | 'egg'
  | 'paneer'
  | 'khichdi'
  | 'poha'
  | 'nuts';
export type AncCheck = 'bp' | 'weight' | 'abdominal' | 'hb' | 'urine' | 'fetal_heartbeat';

export type MedicinePreset = 'iron_folic_acid' | 'calcium' | 'vitamin_d' | 'insulin';
export type MedicineFrequency = 'once_a_day' | 'sos' | 'twice_a_day' | 'thrice_a_day';

export interface MotherLog {
  _id: string;
  logType: AppendLogType | DailyLogType;
  logDate: string; // "YYYY-MM-DD"
  loggedAt: string; // ISO instant
  source: 'manual' | 'chat';
  fields: Record<string, any>;
  /** Weight entries only; null when her height is not recorded. */
  bmi?: number | null;
}

export interface MotherMedicine {
  _id: string;
  presetKey: MedicinePreset | null;
  name: string | null;
  frequency: MedicineFrequency;
  takenToday: boolean;
}

export interface MedicinesSnapshot {
  medicines: MotherMedicine[];
  hasIfa: boolean;
  /** Seven days, oldest first, ending today. */
  ifaWeek: boolean[];
}

/** snake_case backend value to the camelCase i18n key ("post_meal" -> "postMeal"). */
export const i18nKey = (value: string): string =>
  value.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
