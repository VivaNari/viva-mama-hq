import { IUser } from "../types/user.types";

type OnboardingData = IUser["onboarding_data"];

/**
 * Maps an onboarding-flow-v3 node `id` to the `onboarding_data` field it fills.
 * Mirrors the backend switch in chat-flow.service.ts (updateOnboardingData).
 *
 * Only editable question nodes are listed. Nodes absent from this map
 * (`intro`, `wrap_up`, and INFO/BRANCH/CALC/END nodes) are skipped when
 * rendering the Edit Profile form.
 */
export const NODE_ID_TO_ONBOARDING_FIELD: Record<
  string,
  keyof OnboardingData
> = {
  name: "preferred_name",
  dob: "date_of_birth",
  location: "location",
  conception: "conception_method",
  pregnancy_conditions: "pregnancy_conditions",
  delivery_date: "delivery_date",
  delivery_type: "delivery_type",
  delivery_outcome: "delivery_outcome",
  feeding: "feeding_method",
  meds_history: "past_medications",
  current_meds: "current_medications",
  smoking: "tobacco_use",
  alcohol: "alcohol_use",
  support: "social_support",
  parity: "parity",
  care_facility: "care_facility",
  health_history: "health_history",
  pregnancies: "pregnancies_count",
  living_children: "living_children_count",
};

/**
 * Questions not-pregnant women are not asked, so Edit Profile does not show them either.
 * Mirrors NN_WOMEN_INDICATORS in services/backend/src/constants/chat.ts.
 */
export const HIDDEN_FOR_NOT_PREGNANT: readonly string[] = [
  "care_facility",
  "health_history",
  "pregnancies_count",
  "living_children_count",
];

/** Only asked when this is not her first pregnancy. Stored as numbers, edited as text. */
export const COUNT_FIELD_BOUNDS: Record<string, { min: number; max: number }> = {
  pregnancies_count: { min: 2, max: 20 },
  living_children_count: { min: 0, max: 20 },
};
