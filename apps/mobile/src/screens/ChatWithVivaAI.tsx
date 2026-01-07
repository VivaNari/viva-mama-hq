import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AppState,
    AppStateStatus,
    BackHandler,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import CustomDatePicker from '../components/CustomDatePicker';
import { useAuth } from '../context/AuthContext';
import { chatDB } from '../db/sqlite';
import { colors } from '../public/assets/colors';

import { ChatBubble } from '../components/chatBubble';
import { ChatInputBar } from '../components/ChatInputBar';
import { TypingIndicator } from '../components/TypingIndicator';
import { useChatActions } from '../hooks/useChatActions';
import { useChatMessages } from '../hooks/useChatMessages';
import { useChatSession } from '../hooks/useChatSession';
import { useGuidedFlow } from '../hooks/useGuidedFlow';
import {
    ChatScreenRouteProp,
    FlowType,
    IAiMessage,
    IOption,
} from '../types/chat.types';
import {
    getCompletionMessage,
    getCompletionRedirect,
    resolveFlowConfig,
    shouldClearHistoryOnComplete,
    shouldSaveHistory,
} from '../utils/flowTypeResolver';
import { determineInputMode, isAiMessage } from '../utils/messageHelpers';
import { chatLogger } from '../utils/logger';
import { globalStyles } from '../public/styles';
import { syncUserData } from '../utils/syncUserData';

const ChatWithVivaAI: React.FC = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<ChatScreenRouteProp>();
    const { userToken, userId, isFullyOnboarded, completeQuestionnaire } = useAuth();

    const flowConfig = useMemo(() => {
        return resolveFlowConfig(route.params?.flowSlug, isFullyOnboarded());
    }, [route.params?.flowSlug, isFullyOnboarded]);

    const { flowType, flowSlug } = flowConfig;

    // Determine if this is a guided flow (request-response) or chatbot (SSE)
    const isGuidedFlow = flowType === FlowType.ONBOARDING || flowType === FlowType.CHECKIN;

    const {
        state,
        dispatch,
        loadHistory,
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
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

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
                await chatDB.clearChatHistoryV2();
            }

            const redirect = getCompletionRedirect(completedFlowType);
            if (userToken) {
                await syncUserData(userToken);
            }
            if (redirect) {
                navigationTimeoutRef.current = setTimeout(() => {
                    navigation.reset({
                        index: 0,
                        routes: [{ name: redirect.screen }],
                    });
                }, redirect.delay);
            }
        },
        [completeQuestionnaire, navigation, userToken]
    );

    const handleMessageReceived = useCallback(
        async (message: IAiMessage) => {
            await saveAiMessage(message);
        },
        [saveAiMessage]
    );

    // ============================================
    // Guided Flow Hook (for Onboarding + Checkin)
    // ============================================
    const { initialize: initializeGuidedFlow, submitAnswer: submitGuidedAnswer } = useGuidedFlow({
        flowType: isGuidedFlow ? flowType : null,
        flowSlug: isGuidedFlow ? flowSlug : null,
        dispatch,
        onMessageReceived: handleMessageReceived,
        onFlowComplete: handleFlowComplete,
    });

    // ============================================
    // SSE Session Hook (for Chatbot only)
    // ============================================
    const { connect, disconnect } = useChatSession({
        flowType: !isGuidedFlow ? flowType : null,
        flowSlug: !isGuidedFlow ? flowSlug : null,
        userToken,
        dispatch,
        onMessageReceived: handleMessageReceived,
        onFlowComplete: handleFlowComplete,
        hasExistingMessages: state.messages.length > 0,
    });

    // ============================================
    // Chat Actions (works with both patterns)
    // ============================================
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
        submitGuidedAnswer: isGuidedFlow ? submitGuidedAnswer : undefined,
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
        setSelectedDate(null);
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

    const handleErrorRetry = useCallback(() => {
        dispatch({ type: 'SET_LOADING', payload: false })
        //retry /answer api call
    }, [dispatch]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            if (isGuidedFlow) {
                // For guided flows, re-initialize
                if (flowType && shouldSaveHistory(flowType)) {
                    await loadHistory();
                }
                await initializeGuidedFlow();
            } else {
                // For chatbot, reconnect SSE
                disconnect();
                connect();
            }

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
    }, [isGuidedFlow, flowType, loadHistory, initializeGuidedFlow, disconnect, connect]);

    // ============================================
    // Initialization
    // ============================================
    useEffect(() => {
        const initializeChat = async () => {
            try {
                await chatDB.init();

                // Load history for flows that save it
                if (flowType === FlowType.CHECKIN && shouldSaveHistory(flowType)) {
                    await loadHistory();
                }

                if (isGuidedFlow) {
                    // Use request-response API for guided flows
                    await initializeGuidedFlow();
                } else {
                    // Use SSE for chatbot
                    connect();
                }
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
            if (!isGuidedFlow) {
                disconnect();
            }
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

    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
            setKeyboardVisible(true);
        });
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardVisible(false);
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <KeyboardAvoidingView
                behavior="padding"
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                enabled={true}
            >
                <View style={{ flex: 1 }}>
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
                                tintColor={colors.darkPurple}
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
                        {state.errorMessage && <TouchableOpacity onPress={handleErrorRetry}><Text>Retry</Text></TouchableOpacity>}
                    </ScrollView>
                </View>

                <View style={{ paddingBottom: isKeyboardVisible ? 0 : insets.bottom, backgroundColor: colors.white }}>
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
                </View>

                <CustomDatePicker
                    show={showDatePicker}
                    setShow={setShowDatePicker}
                    selectedDate={selectedDate}
                    onSelect={handleDateSelected}
                />
            </KeyboardAvoidingView>
        </View>
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
        backgroundColor: colors.lightPurple,
        padding: 10,
        marginHorizontal: 40,
        borderRadius: 10,
        alignItems: "center",
        borderColor: colors.darkPurple,
        borderWidth: 1
    },
    vivaIntroText: {
        color: colors.darkPurple,
        fontWeight: "600",
        fontSize: 15,
        lineHeight: 20
    }
});

export default ChatWithVivaAI;