import { RouteProp } from '@react-navigation/native';

export enum FlowType {
	ONBOARDING = 'ONBOARDING',
	CHECKIN = 'CHECK_IN',
	CHATBOT = 'CHATBOT',
}

export enum NodeType {
	QUESTION_SINGLE = 'QUESTION_SINGLE',
	QUESTION_MULTI = 'QUESTION_MULTI',
	QUESTION_FREE_TEXT = 'QUESTION_FREE_TEXT',
	QUESTION_DATE = 'QUESTION_DATE',
	INFO = 'INFO',
}

export enum MessageEventType {
	AI_MESSAGE = 'ai_message',
	USER_MESSAGE = 'user_message',
	END_FLOW = 'end_flow',
	ERROR = 'error',
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

export interface IAiMessage {
	type: 'ai';
	id: string;
	flowInstanceId: string;
	text: string;
	educationalMessage?: string;
	whyThisMatters?: string;
	options: IOption[];
	nodeType?: NodeType;
	timestamp: number;
	uuid: string;
}

export interface IUserMessage {
	type: 'user';
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
}

// ============================================
// State Types
// ============================================

export type InputMode = 'none' | 'text' | 'date' | 'multiSelect' | 'deliveryDate';

export interface ChatState {
	messages: IChatMessage[];
	isLoading: boolean;
	isFlowComplete: boolean;
	animatingMessageId: string | null;
	inputText: string;
	selectedMultiOptions: Set<string>;
	connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
	errorMessage: string | null;
}

export type ChatAction =
	| { type: 'SET_MESSAGES'; payload: IChatMessage[] }
	| { type: 'ADD_MESSAGE'; payload: IChatMessage }
	| { type: 'CLEAR_OPTIONS_FOR_MESSAGE'; payload: string }
	| { type: 'SET_LOADING'; payload: boolean }
	| { type: 'SET_FLOW_COMPLETE'; payload: boolean }
	| { type: 'SET_ANIMATING_MESSAGE_ID'; payload: string | null }
	| { type: 'SET_INPUT_TEXT'; payload: string }
	| { type: 'TOGGLE_MULTI_OPTION'; payload: { optionId: string; allOptions: IOption[] } }
	| { type: 'CLEAR_MULTI_OPTIONS' }
	| { type: 'SET_CONNECTION_STATUS'; payload: ChatState['connectionStatus'] }
	| { type: 'SET_ERROR'; payload: string | null }
	| { type: 'RESET' };

// ============================================
// Navigation Types
// ============================================

export type ChatRouteParams = {
	ChatWithVivaAI: {
		flowSlug?: string;
	};
};

export type ChatScreenRouteProp = RouteProp<ChatRouteParams, 'ChatWithVivaAI'>;

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
	message: IChatMessage;
	isLast: boolean;
	isAnimating: boolean;
	isFlowComplete: boolean;
	onOptionSelect: (option: IOption) => void;
	onMultiOptionToggle: (option: IOption, allOptions: IOption[]) => void;
	selectedMultiOptions: Set<string>;
	onDatePickerOpen: () => void;
	onNotPregnantSelect: () => void;
	onAnimationComplete?: () => void;
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