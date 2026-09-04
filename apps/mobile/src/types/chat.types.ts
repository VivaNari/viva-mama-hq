import { RouteProp } from "@react-navigation/native";

export enum FlowType {
  ONBOARDING = "ONBOARDING",
  CHECKIN = "CHECK_IN",
  CHATBOT = "CHATBOT",
}

export enum NodeType {
  QUESTION_SINGLE = "QUESTION_SINGLE",
  QUESTION_MULTI = "QUESTION_MULTI",
  QUESTION_FREE_TEXT = "QUESTION_FREE_TEXT",
  QUESTION_DATE = "QUESTION_DATE",
  INFO = "INFO",
}

export enum MessageEventType {
  AI_MESSAGE = "ai_message",
  USER_MESSAGE = "user_message",
  END_FLOW = "end_flow",
  ERROR = "error",
}

// ============================================
// Message Types
// ============================================

export interface IOption {
  id: string;
  label: string;
  value: string;
  score: number;
}

/**
 * An expert the AI recommended in its answer. Already validated server-side against
 * the experts this user is allowed to see, so it is always safe to deep-link.
 */
export interface ISuggestedExpert {
  expertId: string;
  name: string;
  speciality?: string;
}

export interface IAiMessage {
  type: "ai";
  id: string;
  flowInstanceId: string;
  text: string;
  educationalMessage?: string;
  whyThisMatters?: string;
  options: IOption[];
  nodeType?: NodeType;
  timestamp: number;
  uuid: string;
  sessionId?: string;
  conversationId?: string;
  /** Drives the "Connect" button under the bubble. Empty or absent means no button. */
  suggestedExperts?: ISuggestedExpert[];
}

export interface IUserMessage {
  type: "user";
  text: string;
  timestamp: number;
}

export type IChatMessage = IAiMessage | IUserMessage;

// ============================================
// SSE Event Types
// ============================================

export interface ISSEMessageData {
  type: MessageEventType;
  id?: string;
  flowInstanceId?: string;
  text?: string;
  educationalMessage?: string;
  whyThisMatters?: string;
  options?: IOption[];
  nodeType?: NodeType;
  uuid?: string;
  flowType?: FlowType;
  message?: string;
  sessionId?: string;
  conversationId?: string;
  suggestedExperts?: ISuggestedExpert[];
}

// ============================================
// State Types
// ============================================

export type InputMode =
  | "none"
  | "text"
  | "date"
  | "multiSelect"
  | "deliveryDate";

export interface ChatState {
  messages: IChatMessage[];
  isLoading: boolean;
  isFlowComplete: boolean;
  animatingMessageId: string | null;
  inputText: string;
  selectedMultiOptions: Set<string>;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  errorMessage: string | null;
  bookMarkedMessages: string[];
}

export type ChatAction =
  | { type: "SET_MESSAGES"; payload: IChatMessage[] }
  | { type: "ADD_MESSAGE"; payload: IChatMessage }
  | { type: "CLEAR_OPTIONS_FOR_MESSAGE"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_FLOW_COMPLETE"; payload: boolean }
  | { type: "SET_ANIMATING_MESSAGE_ID"; payload: string | null }
  | { type: "SET_INPUT_TEXT"; payload: string }
  | {
      type: "TOGGLE_MULTI_OPTION";
      payload: { optionId: string; allOptions: IOption[] };
    }
  | { type: "CLEAR_MULTI_OPTIONS" }
  | { type: "SET_CONNECTION_STATUS"; payload: ChatState["connectionStatus"] }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET" }
  | { type: "RESET_ERROR" }
  | { type: "TOGGLE_BOOKMARK"; payload: string }
  | { type: "SET_BOOKMARKED_MESSAGES"; payload: string[] };

// ============================================
// Navigation Types
// ============================================

export type ChatRouteParams = {
  ChatWithVivaAI: {
    flowSlug?: string;
  };
};

export type ChatScreenRouteProp = RouteProp<ChatRouteParams, "ChatWithVivaAI">;

// ============================================
// Hook Return Types
// ============================================

export interface UseChatSessionReturn {
  connect: () => void;
  disconnect: () => void;
  isConnected: boolean;
}

export interface UseChatMessagesReturn {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
  loadHistory: () => Promise<void>;
  saveMessage: (message: IChatMessage) => Promise<void>;
}

// ============================================
// Component Props
// ============================================

export interface ChatBubbleProps {
  isFirst: boolean;
  message: IChatMessage;
  isLast: boolean;
  isAnimating: boolean;
  isFlowComplete: boolean;
  onOptionSelect: (option: IOption) => void;
  onMultiOptionToggle: (option: IOption, allOptions: IOption[]) => void;
  selectedMultiOptions: Set<string>;
  onDatePickerOpen: () => void;
  onLmpDatePickerOpen: () => void;
  onNotPregnantSelect: () => void;
  onConsultExpert: () => void;
  onChatWithViva: () => void;
  onAnimationComplete?: () => void;
  onBookmarkPress: (id: string) => void;
  isBookmarked?: boolean;
  /**
   * Flag this AI reply as offensive or harmful. Required by Play's AI-Generated
   * Content policy: reporting model output must be possible without leaving the app.
   */
  onFlagPress?: (id: string) => void;
  /** Opens the recommended expert's details screen. Omit to hide the button. */
  onConnectExpert?: (expertId: string) => void;
}

export interface ChatInputBarProps {
  inputMode: InputMode;
  inputText: string;
  isLoading: boolean;
  selectedOptionsCount: number;
  onInputChange: (text: string) => void;
  onSend: () => void;
  onDatePickerOpen: () => void;
  onMultiSelectSubmit: () => void;
}
