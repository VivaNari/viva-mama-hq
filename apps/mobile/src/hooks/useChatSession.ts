import { useCallback, useRef, useEffect } from 'react';
import EventSource from 'react-native-sse';
import Toast from 'react-native-toast-message';

import { CHAT_SESSION_URL } from '../constants/endpoints';
import {
	FlowType,
	IAiMessage,
	ISSEMessageData,
	MessageEventType,
	ChatAction,
} from '../types/chat.types';
import { SSE_RECONNECT_DELAY_MS, MAX_SSE_RETRIES } from '../constants/chat';
import { chatLogger } from '../utils/logger';

interface UseChatSessionProps {
	flowType: FlowType | null;
	flowSlug: string | null;
	userToken: string | null;
	dispatch: React.Dispatch<ChatAction>;
	onMessageReceived: (message: IAiMessage) => Promise<void>;
	onFlowComplete: (flowType: FlowType) => Promise<void>;
	hasExistingMessages: boolean;
}

interface UseChatSessionReturn {
	connect: () => void;
	disconnect: () => void;
	isConnected: boolean;
}

export const useChatSession = ({
	flowType,
	flowSlug,
	userToken,
	dispatch,
	onMessageReceived,
	onFlowComplete,
	hasExistingMessages,
}: UseChatSessionProps): UseChatSessionReturn => {
	const eventSourceRef = useRef<EventSource | null>(null);
	const retryCountRef = useRef(0);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const clearReconnectTimeout = useCallback(() => {
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
			reconnectTimeoutRef.current = null;
		}
	}, []);

	const disconnect = useCallback(() => {
		clearReconnectTimeout();

		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}

		dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });
		chatLogger.debug('SSE disconnected');
	}, [clearReconnectTimeout, dispatch]);

	const handleMessage = useCallback(
		async (data: ISSEMessageData) => {
			switch (data.type) {
				case MessageEventType.END_FLOW:
					// Display the end flow message if present
					if (data.text) {
						const endMessage: IAiMessage = {
							type: 'ai',
							id: data.id || `end-flow-${Date.now()}`,
							flowInstanceId: data.flowInstanceId || '',
							text: data.text,
							options: [],
							timestamp: Date.now(),
							uuid: data.uuid || '',
						};
						await onMessageReceived(endMessage);
					}

					dispatch({ type: 'SET_FLOW_COMPLETE', payload: true });
					if (data.flowType) {
						await onFlowComplete(data.flowType);
					}
					disconnect();
					break;

				case MessageEventType.ERROR:
					dispatch({
						type: 'SET_ERROR',
						payload: data.message || 'An error occurred',
					});
					Toast.show({
						type: 'error',
						text1: 'Error',
						text2: data.message || 'An error occurred',
						position: 'bottom',
					});
					break;

				case MessageEventType.AI_MESSAGE:
					if (!data.id || !data.flowInstanceId || !data.text) {
						chatLogger.warn('Received incomplete AI message', data);
						return;
					}

					const aiMessage: IAiMessage = {
						type: 'ai',
						id: data.id,
						flowInstanceId: data.flowInstanceId,
						text: data.text,
						educationalMessage: data.educationalMessage,
						whyThisMatters: data.whyThisMatters,
						options: data.options || [],
						nodeType: data.nodeType,
						timestamp: Date.now(),
						uuid: data.uuid || '',
					};

					await onMessageReceived(aiMessage);
					break;

				default:
					chatLogger.warn('Received unknown message type', data);
					Toast.show({
						type: 'error',
						text1: 'Unexpected Response',
						text2: 'Please refresh and try again',
						position: 'bottom',
					});
			}
		},
		[dispatch, disconnect, onFlowComplete, onMessageReceived]
	);

	const connect = useCallback(() => {
		if (!flowType || !flowSlug || !userToken) {
			chatLogger.warn('Cannot connect: missing required params');
			return;
		}

		// Disconnect existing connection
		disconnect();

		dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connecting' });

		if (!hasExistingMessages) {
			dispatch({ type: 'SET_LOADING', payload: true });
		}

		const url = CHAT_SESSION_URL(flowSlug, userToken, flowType);
		const eventSource = new EventSource(url);
		eventSourceRef.current = eventSource;

		eventSource.addEventListener('open', () => {
			chatLogger.debug('SSE connected');
			dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connected' });
			retryCountRef.current = 0;
		});

		eventSource.addEventListener('message', async (event) => {
			try {
				if (!event.data) {
					return;
				}

				const data: ISSEMessageData = JSON.parse(event.data);
				await handleMessage(data);
			} catch (error) {
				chatLogger.error('Failed to parse SSE message', error);
			}
		});

		eventSource.addEventListener('error', (error) => {
			chatLogger.error('SSE error', error);
			dispatch({ type: 'SET_LOADING', payload: false });
			dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'error' });

			if (retryCountRef.current >= MAX_SSE_RETRIES) {
				chatLogger.error('Max retries reached, giving up');
				Toast.show({
					type: 'error',
					text1: 'Connection Failed',
					text2: 'Please check your internet connection and try again',
					position: 'bottom',
				});
				retryCountRef.current = 0;
				return;
			}

			retryCountRef.current += 1;
			chatLogger.info(`Retrying connection (${retryCountRef.current}/${MAX_SSE_RETRIES})`);

			Toast.show({
				type: 'info',
				text1: 'Connection lost',
				text2: 'Retrying...',
				position: 'bottom',
				visibilityTime: 2000,
			});

			reconnectTimeoutRef.current = setTimeout(() => {
				connect();
			}, SSE_RECONNECT_DELAY_MS);
		});
	}, [flowType, flowSlug, userToken, hasExistingMessages, disconnect, dispatch, handleMessage]);

	useEffect(() => {
		return () => {
			disconnect();
		};
	}, [disconnect]);

	return {
		connect,
		disconnect,
		isConnected: eventSourceRef.current !== null,
	};
};