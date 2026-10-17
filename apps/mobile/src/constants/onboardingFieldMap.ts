import { IUser } from "../types/user.types";

type OnboardingData = IUser["onboarding_data"];

/**
 * Maps an onboarding-flow-v2 node `id` to the `onboarding_data` field it fills.
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
};
