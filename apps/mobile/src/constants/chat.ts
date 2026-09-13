import { FlowType } from "../types/chat.types";

export const FLOW_SLUGS: Record<FlowType, string> = {
  [FlowType.ONBOARDING]: "onboarding-flow-v2",
  [FlowType.CHECKIN]: "weekly-checkin-v1",
  [FlowType.CHATBOT]: "chatbot-flow",
  [FlowType.BABY_ONBOARDING]: "baby-onboarding-v1",
};

export const TYPING_SPEED_MS = 30;
export const SSE_RECONNECT_DELAY_MS = 5000;
export const MAX_SSE_RETRIES = 5;
export const NAVIGATION_DELAY_MS = 3000;

// ============================================
// Special Node IDs
// ============================================

export const DELIVERY_DATE_NODE_ID = "delivery_date";
export const DOB_NODE_ID = "dob";

// ============================================
// Baby Onboarding Node IDs
// ============================================

/**
 * The child's date of birth. Needs its own identity because the shared date handling caps
 * the picker at MIN_AGE_YEARS ago — correct for the mother, absurd for a newborn.
 */
export const CHILD_DOB_NODE_ID = "child_dob";

/** Growth is tracked to age 5, which bounds how old a child being added can be. */
export const MAX_CHILD_AGE_YEARS = 5;

/**
 * Birth measurements. The flow engine has no numeric node type, so these are
 * QUESTION_FREE_TEXT nodes recognised by id and given a numeric keypad plus range checks.
 * Bounds are mirrored server-side in child-onboarding.projection.ts, which discards
 * anything outside them — keep the two in step.
 */
export const MEASUREMENT_NODE_BOUNDS: Record<
  string,
  { min: number; max: number; unit: string }
> = {
  child_birth_head_circumference: { min: 20, max: 60, unit: "cm" },
  child_birth_length: { min: 30, max: 100, unit: "cm" },
  child_birth_weight: { min: 500, max: 8000, unit: "g" },
};

// Synthetic node id for the grief-sensitive acknowledgement message shown when a
// user reports a stillbirth. Distinct from the real "delivery_outcome" node so
// the bubble can render dedicated support buttons.
export const STILL_BIRTH_NODE_ID = "still_birth_support";

// Minimum age (in years) a user must be to register a date of birth.
export const MIN_AGE_YEARS = 18;

// ============================================
// Special Values
// ============================================

export const NOT_PREGNANT_VALUE = "not_pragnent"; // Note: keeping original spelling for API compatibility

// Termination reason returned by the backend when onboarding is ended early due
// to a reported stillbirth.
export const STILL_BIRTH_TERMINATION = "still_birth";

// Prefix used to flag a Last Menstrual Period date submission on the
// delivery_date node. Backend derives the expected delivery date from it.
export const LMP_DATE_PREFIX = "lmp:";

// ============================================
// None Option Values (for multi-select)
// ============================================

export const NONE_OPTION_VALUES = [
  "none",
  "history_none",
  "meds_none",
] as const;

// ============================================
// Default State
// ============================================

export const INITIAL_CHAT_STATE = {
  messages: [],
  isLoading: false,
  isFlowComplete: false,
  animatingMessageId: null,
  inputText: "",
  selectedMultiOptions: new Set<string>(),
  connectionStatus: "disconnected" as const,
  errorMessage: null,
  bookMarkedMessages: [],
};
