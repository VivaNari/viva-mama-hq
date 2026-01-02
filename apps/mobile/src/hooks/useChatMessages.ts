// src/hooks/useChatMessages.ts
import { useReducer, useCallback } from 'react';

import { chatDB } from '../db/sqlite';
import {
	IChatMessage,
	IAiMessage,
	IUserMessage,
	FlowType,
} from '../types/chat.types';
import { chatReducer, INITIAL_CHAT_STATE } from '../reducers/chatReducer';
import { shouldSaveHistory } from '../utils/flowTypeResolver';
import { chatLogger } from '../utils/logger';

interface UseChatMessagesProps {
	userId: string | null;
	flowSlug: string | null;
	flowType: FlowType | null;
}

export const useChatMessages = ({
	userId,
	flowSlug,
	flowType,
}: UseChatMessagesProps) => {
	const [state, dispatch] = useReducer(chatReducer, INITIAL_CHAT_STATE);

	const loadHistory = useCallback(async () => {
		if (!userId || !flowSlug || !flowType) {
			chatLogger.debug('Cannot load history: missing params');
			return;
		}

		// Don't load history for chatbot - no SQLite interaction
		if (!shouldSaveHistory(flowType)) {
			chatLogger.debug('Skipping history load for chatbot');
			return;
		}

		try {
			const messages = await chatDB.getChatHistory(userId, flowSlug);
			dispatch({ type: 'SET_MESSAGES', payload: messages as IChatMessage[] });
			chatLogger.debug(`Loaded ${messages.length} messages from history`);
		} catch (error) {
			chatLogger.error('Failed to load history', error);
		}
	}, [userId, flowSlug, flowType]);

	const clearHistory = useCallback(async () => {
		if (!userId || !flowSlug) {
			chatLogger.debug('Cannot clear history: missing params');
			return;
		}

		try {
			await chatDB.clearChatHistory(userId, flowSlug);
			dispatch({ type: 'RESET' });
			chatLogger.debug('Chat history cleared');
		} catch (error) {
			chatLogger.error('Failed to clear history', error);
		}
	}, [userId, flowSlug]);

	const saveAiMessage = useCallback(
		async (message: IAiMessage): Promise<boolean> => {
			if (!userId || !flowSlug || !flowType) {
				return false;
			}

			// For CHATBOT: just add to state, no SQLite
			if (!shouldSaveHistory(flowType)) {
				dispatch({ type: 'ADD_MESSAGE', payload: message });
				dispatch({ type: 'SET_ANIMATING_MESSAGE_ID', payload: message.id });
				dispatch({ type: 'SET_LOADING', payload: false });
				return true;
			}

			// For ONBOARDING and CHECKIN: save to SQLite
			try {
				// Check for duplicate
				// const exists = await chatDB.messageExists(userId, flowSlug, message.id);
				// if (exists) {
				// 	chatLogger.debug('Duplicate message, skipping');
				// 	dispatch({ type: 'SET_LOADING', payload: false });
				// 	return false;
				// }

				await chatDB.saveAiMessage(userId, flowSlug, message);
				dispatch({ type: 'ADD_MESSAGE', payload: message });
				dispatch({ type: 'SET_ANIMATING_MESSAGE_ID', payload: message.id });
				dispatch({ type: 'SET_LOADING', payload: false });
				chatLogger.debug('AI message saved', message.id);
				return true;
			} catch (error) {
				chatLogger.error('Failed to save AI message', error);
				return false;
			}
		},
		[userId, flowSlug, flowType]
	);

	const saveUserMessage = useCallback(
		async (text: string, lastAiMessageId?: string): Promise<void> => {
			if (!userId || !flowSlug) {
				return;
			}

			const userMessage: IUserMessage = {
				type: 'user',
				text,
				timestamp: Date.now(),
			};

			if (lastAiMessageId) {
				dispatch({ type: 'CLEAR_OPTIONS_FOR_MESSAGE', payload: lastAiMessageId });
			}

			dispatch({ type: 'ADD_MESSAGE', payload: userMessage });

			// Only save to SQLite for flows that require history
			if (flowType && shouldSaveHistory(flowType)) {
				try {
					await chatDB.saveUserMessage(userId, flowSlug, userMessage);
					chatLogger.debug('User message saved');
				} catch (error) {
					chatLogger.error('Failed to save user message', error);
				}
			}
		},
		[userId, flowSlug, flowType]
	);

	const getLastAiMessage = useCallback(async (): Promise<IAiMessage | null> => {
		if (!userId || !flowSlug) {
			return null;
		}

		// For CHATBOT: get from state instead of SQLite
		if (flowType && !shouldSaveHistory(flowType)) {
			const aiMessages = state.messages.filter(m => m.type === 'ai') as IAiMessage[];
			return aiMessages.length > 0 ? aiMessages[aiMessages.length - 1] : null;
		}

		try {
			const message = await chatDB.getLastAiMessage(userId, flowSlug);
			return message as IAiMessage | null;
		} catch (error) {
			chatLogger.error('Failed to get last AI message', error);
			return null;
		}
	}, [userId, flowSlug, flowType, state.messages]);

	return {
		state,
		dispatch,
		loadHistory,
		clearHistory,
		saveAiMessage,
		saveUserMessage,
		getLastAiMessage,
	};
};