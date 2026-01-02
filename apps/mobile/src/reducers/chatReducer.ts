import { ChatState, ChatAction, IAiMessage } from '../types/chat.types';
import { INITIAL_CHAT_STATE } from '../constants/chat';
import { toggleMultiOption } from '../utils/messageHelpers';

export const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
	switch (action.type) {
		case 'SET_MESSAGES':
			return {
				...state,
				messages: action.payload,
			};

		case 'ADD_MESSAGE':
			return {
				...state,
				messages: [...state.messages, action.payload],
			};

		case 'CLEAR_OPTIONS_FOR_MESSAGE': {
			const updatedMessages = state.messages.map(msg => {
				if (msg.type === 'ai' && msg.id === action.payload) {
					return { ...msg, options: [] } as IAiMessage;
				}
				return msg;
			});
			return {
				...state,
				messages: updatedMessages,
			};
		}

		case 'SET_LOADING':
			return {
				...state,
				isLoading: action.payload,
			};

		case 'SET_FLOW_COMPLETE':
			return {
				...state,
				isFlowComplete: action.payload,
				isLoading: false,
			};

		case 'SET_ANIMATING_MESSAGE_ID':
			return {
				...state,
				animatingMessageId: action.payload,
			};

		case 'SET_INPUT_TEXT':
			return {
				...state,
				inputText: action.payload,
			};

		case 'TOGGLE_MULTI_OPTION': {
			const { optionId, allOptions } = action.payload;
			const option = allOptions.find(o => o.id === optionId);
			if (!option) return state;

			const newSelected = toggleMultiOption(
				state.selectedMultiOptions,
				option,
				allOptions
			);
			return {
				...state,
				selectedMultiOptions: newSelected,
			};
		}

		case 'CLEAR_MULTI_OPTIONS':
			return {
				...state,
				selectedMultiOptions: new Set(),
			};

		case 'SET_CONNECTION_STATUS':
			return {
				...state,
				connectionStatus: action.payload,
			};

		case 'SET_ERROR':
			return {
				...state,
				errorMessage: action.payload,
				isLoading: false,
			};

		case 'RESET_ERROR':
			return {
				...state,
				errorMessage: null
			};

		case 'RESET':
			return INITIAL_CHAT_STATE;

		default:
			return state;
	}
};

export { INITIAL_CHAT_STATE };