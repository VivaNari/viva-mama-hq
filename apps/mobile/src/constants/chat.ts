import { FlowType } from "../types/chat.types";

export const FLOW_SLUGS: Record<FlowType, string> = {
  [FlowType.ONBOARDING]: "onboarding-flow-v2",
  [FlowType.CHECKIN]: "weekly-checkin-v1",
  [FlowType.CHATBOT]: "chatbot-flow",
};

export const TYPING_SPEED_MS = 30;
export const SSE_RECONNECT_DELAY_MS = 5000;
export const MAX_SSE_RETRIES = 5;
export const NAVIGATION_DELAY_MS = 3000;

// ============================================
// Special Node IDs
// ============================================

export const DELIVERY_DATE_NODE_ID = "delivery_date";

// ============================================
// Special Values
// ============================================

export const NOT_PREGNANT_VALUE = "not_pragnent"; // Note: keeping original spelling for API compatibility

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
