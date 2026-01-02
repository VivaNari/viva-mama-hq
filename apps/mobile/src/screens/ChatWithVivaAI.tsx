// src/screens/ChatWithVivaAI.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ScrollView,
    RefreshControl,
    BackHandler,
    AppState,
    AppStateStatus,
    StyleSheet,
    View,
    Text,
    KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

import { useAuth } from '../context/AuthContext';
import { chatDB } from '../db/sqlite';
import { colors } from '../public/assets/colors';
import CustomDatePicker from '../components/CustomDatePicker';

import {
    FlowType,
    IAiMessage,
    IOption,
    ChatScreenRouteProp,
} from '../types/chat.types';
import { useChatMessages } from '../hooks/useChatMessages';
import { useChatSession } from '../hooks/useChatSession';
import { useChatActions } from '../hooks/useChatActions';
import { ChatInputBar } from '../components/ChatInputBar';
import { ChatBubble } from '../components/chatBubble';
import { TypingIndicator } from '../components/TypingIndicator';
import {
    resolveFlowConfig,
    getCompletionMessage,
    getCompletionRedirect,
    shouldClearHistoryOnComplete,
    shouldSaveHistory,
} from '../utils/flowTypeResolver';
import { determineInputMode, isAiMessage } from '../utils/messageHelpers';
import { chatLogger } from '../utils/logger';
import { globalStyles } from '../public/styles';

const ChatWithVivaAI: React.FC = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<ChatScreenRouteProp>();
    const { userToken, userId, isFullyOnboarded, completeQuestionnaire } = useAuth();

    const flowConfig = useMemo(() => {
        return resolveFlowConfig(route.params?.flowSlug, isFullyOnboarded());
    }, [route.params?.flowSlug, isFullyOnboarded]);

    const { flowType, flowSlug } = flowConfig;

    const {
        state,
        dispatch,
        loadHistory,
        clearHistory,
        saveAiMessage,
        saveUserMessage,
        getLastAiMessage,
    } = useChatMessages({
        userId,
        flowSlug,
        flowType,
    });

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const scrollViewRef = useRef<ScrollView>(null);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const lastMessage = state.messages[state.messages.length - 1];

    const inputMode = useMemo(() => {
        return determineInputMode(
            lastMessage,
            state.isLoading,
            !!state.animatingMessageId
        );
    }, [lastMessage, state.isLoading, state.animatingMessageId]);

    const lastAiMessageOptions = useMemo(() => {
        if (!lastMessage || !isAiMessage(lastMessage)) {
            return [];
        }
        return lastMessage.options;
    }, [lastMessage]);

    const handleFlowComplete = useCallback(
        async (completedFlowType: FlowType) => {
            const { title, message } = getCompletionMessage(completedFlowType);
            console.log('Flow completed:', completedFlowType);
            Toast.show({
                type: 'success',
                text1: title,
                text2: message,
                position: 'top',
                visibilityTime: 2500,
            });

            if (completedFlowType === FlowType.ONBOARDING) {
                await completeQuestionnaire();
            }

            // Clear history for CHECKIN flow on completion
            if (shouldClearHistoryOnComplete(completedFlowType)) {
                chatLogger.debug('Clearing history for completed check-in flow');
                await clearHistory();
            }

            const redirect = getCompletionRedirect(completedFlowType);
            if (redirect) {
                navigationTimeoutRef.current = setTimeout(() => {
                    navigation.reset({
                        index: 0,
                        routes: [{ name: redirect.screen }],
                    });
                }, redirect.delay);
            }
        },
        [completeQuestionnaire, navigation, clearHistory]
    );

    const handleMessageReceived = useCallback(
        async (message: IAiMessage) => {
            await saveAiMessage(message);
        },
        [saveAiMessage]
    );

    const { connect, disconnect } = useChatSession({
        flowType,
        flowSlug,
        userToken,
        dispatch,
        onMessageReceived: handleMessageReceived,
        onFlowComplete: handleFlowComplete,
        hasExistingMessages: state.messages.length > 0,
    });

    const {
        handleOptionSelect,
        handleMultiSelectSubmit,
        handleTextSubmit,
        handleDateSelect,
        handleNotPregnantSelect,
    } = useChatActions({
        state,
        userId,
        flowType,
        dispatch,
        getLastAiMessage,
        saveUserMessage,
    });

    const handleAnimationComplete = useCallback(() => {
        dispatch({ type: 'SET_ANIMATING_MESSAGE_ID', payload: null });
    }, [dispatch]);

    const handleInputChange = useCallback(
        (text: string) => {
            dispatch({ type: 'SET_INPUT_TEXT', payload: text });
        },
        [dispatch]
    );

    const handleSend = useCallback(() => {
        handleTextSubmit(state.inputText);
    }, [handleTextSubmit, state.inputText]);

    const handleDatePickerOpen = useCallback(() => {
        setShowDatePicker(true);
    }, []);

    const handleDateSelected = useCallback(
        (date: Date) => {
            setSelectedDate(date);
            setShowDatePicker(false);
            handleDateSelect(date);
        },
        [handleDateSelect]
    );

    const handleMultiOptionToggle = useCallback(
        (option: IOption, allOptions: IOption[]) => {
            dispatch({
                type: 'TOGGLE_MULTI_OPTION',
                payload: { optionId: option.id, allOptions },
            });
        },
        [dispatch]
    );

    const handleMultiSubmit = useCallback(() => {
        handleMultiSelectSubmit(state.selectedMultiOptions, lastAiMessageOptions);
    }, [handleMultiSelectSubmit, state.selectedMultiOptions, lastAiMessageOptions]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            disconnect();

            // Only reload history for flows that save history
            if (flowType && shouldSaveHistory(flowType)) {
                await loadHistory();
            }

            connect();
            Toast.show({
                type: 'success',
                text1: 'Refreshed',
                text2: 'Chat reloaded successfully',
                position: 'bottom',
            });
        } catch (error) {
            chatLogger.error('Refresh failed', error);
            Toast.show({
                type: 'error',
                text1: 'Refresh Failed',
                text2: 'Please try again',
                position: 'bottom',
            });
        } finally {
            setRefreshing(false);
        }
    }, [disconnect, loadHistory, connect, flowType]);

    useEffect(() => {
        const initializeChat = async () => {
            try {
                await chatDB.init();

                // Only load history for flows that save history (ONBOARDING, CHECKIN)
                // CHATBOT starts fresh every time
                if (flowType && shouldSaveHistory(flowType)) {
                    await loadHistory();
                } else {
                    chatLogger.debug('Skipping history load for chatbot flow');
                }

                connect();
            } catch (error) {
                chatLogger.error('Failed to initialize chat', error);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Failed to initialize chat',
                    position: 'bottom',
                });
            }
        };

        initializeChat();

        return () => {
            disconnect();
            if (navigationTimeoutRef.current) {
                clearTimeout(navigationTimeoutRef.current);
            }
        };
    }, [flowType, flowSlug]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const handleAppStateChange = async (nextAppState: AppStateStatus) => {
            if (
                appStateRef.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                // Only reload history for flows that save history
                if (flowType && shouldSaveHistory(flowType)) {
                    chatLogger.debug('App came to foreground, reloading history');
                    await loadHistory();
                }
            }
            appStateRef.current = nextAppState;
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, [loadHistory, flowType]);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (navigation.canGoBack()) {
                    navigation.goBack();
                } else if (isFullyOnboarded()) {
                    navigation.navigate('DashboardTabNavigator');
                } else {
                    BackHandler.exitApp();
                }
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

            return () => subscription.remove();
        }, [navigation, isFullyOnboarded])
    );

    useEffect(() => {
        if (scrollViewRef.current) {
            scrollViewRef.current.scrollToEnd({ animated: true });
        }
    }, [state.messages, state.selectedMultiOptions.size]);

    useEffect(() => {
        if (
            lastMessage &&
            isAiMessage(lastMessage) &&
            lastMessage.nodeType === 'QUESTION_MULTI'
        ) {
            dispatch({ type: 'CLEAR_MULTI_OPTIONS' });
        }
    }, [lastMessage, dispatch]);

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
        >
            <SafeAreaView style={styles.container}>
                <View style={styles.vivaIntroContainer}>
                    <Text style={[styles.vivaIntroText, globalStyles.fontBold]}>Viva, your personal assistant</Text>
                </View>
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    onContentSizeChange={() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    {state.messages.map((msg, index) => {
                        const isLast = index === state.messages.length - 1;
                        const shouldAnimate =
                            isAiMessage(msg) && msg.id === state.animatingMessageId;

                        return (
                            <ChatBubble
                                key={`${msg.type}-${msg.timestamp}-${index}`}
                                message={msg}
                                isLast={isLast}
                                isAnimating={!!state.animatingMessageId}
                                isFlowComplete={state.isFlowComplete}
                                shouldAnimate={shouldAnimate}
                                onOptionSelect={handleOptionSelect}
                                onMultiOptionToggle={handleMultiOptionToggle}
                                selectedMultiOptions={state.selectedMultiOptions}
                                onDatePickerOpen={handleDatePickerOpen}
                                onNotPregnantSelect={handleNotPregnantSelect}
                                onAnimationComplete={handleAnimationComplete}
                            />
                        );
                    })}

                    {state.isLoading && <TypingIndicator />}
                </ScrollView>

                <ChatInputBar
                    inputMode={inputMode}
                    inputText={state.inputText}
                    isLoading={state.isLoading}
                    selectedOptionsCount={state.selectedMultiOptions.size}
                    onInputChange={handleInputChange}
                    onSend={handleSend}
                    onDatePickerOpen={handleDatePickerOpen}
                    onMultiSelectSubmit={handleMultiSubmit}
                />

                <CustomDatePicker
                    show={showDatePicker}
                    setShow={setShowDatePicker}
                    selectedDate={selectedDate}
                    onSelect={handleDateSelected}
                />
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.white,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingVertical: 12,
    },
    vivaIntroContainer: {
        marginTop: 30,
        marginBottom: 10,
        backgroundColor: "#E3E2F4",
        padding: 10,
        marginHorizontal: 40,
        borderRadius: 10,
        alignItems: "center",
        borderColor: "#6F6AC4",
        borderWidth: 1
    },
    vivaIntroText: {
        color: "#6F6AC4",
        fontWeight: "600",
        fontSize: 15,
        lineHeight: 20
    }
});

export default ChatWithVivaAI;