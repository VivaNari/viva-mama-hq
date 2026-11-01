import { RouteProp } from "@react-navigation/native";

export enum FlowType {
  ONBOARDING = "ONBOARDING",
  CHECKIN = "CHECK_IN",
  CHATBOT = "CHATBOT",
  /**
   * Per-child onboarding. Runs on the same guided-flow machinery as ONBOARDING, but is
   * about a child rather than the mother — so it must never touch her questionnaire
   * status, and it can legitimately run more than once per user.
   */
  BABY_ONBOARDING = "BABY_ONBOARDING",
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
  /** Her chatbot turn could not be answered; carries `replyTo` and `code`. */
  AI_ERROR = "ai_error",
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
  /** Logs Viva read from her message, waiting for Yes / No. Absent means no card. */
  pendingLogs?: IPendingLog[];
  /** The clientMessageId of the turn this answers. */
  replyTo?: string | null;
}

/**
 * A log Viva read out of her message ("today my bp is 118/80"). Nothing is saved
 * until she confirms. `needs_medicine`: the medicine is not on her list yet.
 */
export type PendingLogStatus = "pending" | "saved" | "dismissed" | "needs_medicine";

export interface IPendingLog {
  _id: string;
  logType: string;
  fields: Record<string, any>;
  mode?: "add" | "set" | null;
  medicineId?: string | null;
  medicineRef?: { presetKey?: string; name?: string } | null;
  status: PendingLogStatus;
  savedLogId?: string | null;
}

// ============================================
// Attachments (reports, scans, prescriptions)
// ============================================

export type AttachmentKind = "IMAGE" | "PDF";

/** A file picked for the next message, uploading in the background while she types. */
export interface IPendingAttachment {
  localId: string;
  /** Sent with the upload, so a retried upload is recognised by the server. */
  clientUploadId: string;
  kind: AttachmentKind;
  /** Local file URI from the picker. */
  uri: string;
  mimeType: string;
  name?: string | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  state: "uploading" | "uploaded" | "failed";
  /** 0-1 while uploading. */
  progress: number;
  serverId?: string;
  pageCount?: number | null;
  errorCode?: string;
}

/** A file shown in a sent bubble. */
export interface IMessageAttachment {
  id: string;
  kind: AttachmentKind;
  localUri?: string;
  name?: string | null;
  pageCount?: number | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface IUserMessage {
  type: "user";
  text: string;
  timestamp: number;
  /** clientMessageId of a chatbot turn: keys the reply and in-place updates. */
  id?: string;
  attachments?: IMessageAttachment[];
  /** Chatbot turns only. Absent on older messages, which are always sent. */
  status?: "sending" | "sent" | "failed";
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
  pendingLogs?: IPendingLog[];
  /** She answered an earlier card by typing yes/no: its items as they now stand. */
  updatedPendingLogs?: { messageId: string; pendingLogs: IPendingLog[] };
  /** The clientMessageId of the turn this answers (ai_message and ai_error). */
  replyTo?: string | null;
  /** ai_error: why the turn failed. */
  code?: string;
  /** Her AI allowance after a refund. */
  quota?: { used: number; limit: number | null; remaining: number | null } | null;
  /** Reply to a turn with files: what was decided about them. */
  attachment?: { verdict: string; reasonCode?: string | null } | null;
}

// ============================================
// State Types
// ============================================

export type InputMode =
  | "none"
  | "text"
  | "date"
  | "multiSelect"
  | "deliveryDate"
  /**
   * Free text constrained to a number. The flow engine has no numeric node type, so the
   * baby birth measurements arrive as QUESTION_FREE_TEXT and are recognised by node id.
   */
  | "number";

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
  /** Files picked for the next chatbot message. */
  pendingAttachments: IPendingAttachment[];
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
  | { type: "SET_BOOKMARKED_MESSAGES"; payload: string[] }
  | {
      type: "UPDATE_PENDING_LOGS";
      payload: { messageId: string; pendingLogs: IPendingLog[] };
    }
  | { type: "UPDATE_USER_MESSAGE"; payload: { id: string; patch: Partial<IUserMessage> } }
  | { type: "ADD_PENDING_ATTACHMENTS"; payload: IPendingAttachment[] }
  | {
      type: "UPDATE_PENDING_ATTACHMENT";
      payload: { localId: string; patch: Partial<IPendingAttachment> };
    }
  | { type: "REMOVE_PENDING_ATTACHMENT"; payload: string }
  | { type: "SET_PENDING_ATTACHMENTS"; payload: IPendingAttachment[] };

// ============================================
// Navigation Types
// ============================================

export type ChatRouteParams = {
  ChatWithVivaAI: {
    flowSlug?: string;
    /**
     * Per-child flows only. Omit when adding a new baby — the server resolves an
     * in-flight run or creates a draft child. Pass it to target an existing child.
     */
    childId?: string;
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
