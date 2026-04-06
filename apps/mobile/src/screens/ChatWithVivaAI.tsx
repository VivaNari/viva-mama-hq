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
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import CustomDatePicker from '../components/CustomDatePicker';
import { useAuth } from '../context/AuthContext';
import { chatDB } from '../db/sqlite';
import { colors } from '../public/assets/colors';
import ChatDropdownMenu from '../components/ChatDropdownMenu';
import ModelSelector, { MODELS } from '../components/ModelSelector';

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
import { addAIMessageBookmark } from '../api/addAIMessageBookmark';
import { removeAIMessageBookmark } from '../api/removeAIMessageBookmark';
import Lucide from '@react-native-vector-icons/lucide';

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
    const isChatbotFlow = flowType === FlowType.CHATBOT;

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

    // console.log("state issss =>>> ", state)

    useEffect(() => {
        (async function () {
            if (flowType && shouldSaveHistory(flowType)) {
                await loadHistory();
            }
        })()
    }, [flowType, loadHistory])

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [modelSelectorVisible, setModelSelectorVisible] = useState(false);
    const [selectedModel, setSelectedModel] = useState(MODELS[0].id); // Default to Llama 3.3

    const handleMenuOptionSelect = (option: 'Bookmarks' | 'About') => {
        switch (option) {
            case 'Bookmarks':
                navigation.navigate('BookmarkedMessages');
                break;
            case 'About':
                setMenuVisible(false);
                break;
        }
    };

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

    const stripThinkTags = (text: string): string => {
        if (!text) {
            return text;
        }

        const withoutThink = text.replace(/<think>[\s\S]*?<\/think>/i, '').trim();

        if (!withoutThink) {
            return text;
        }

        return withoutThink;
    };

    const handleMessageReceived = useCallback(
        async (message: IAiMessage) => {
            let processedMessage = message;

            if (isChatbotFlow) {
                processedMessage = {
                    ...message,
                    text: stripThinkTags(message.text),
                };
            }

            await saveAiMessage(processedMessage);
        },
        [saveAiMessage, isChatbotFlow]
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
        selectedModel: isChatbotFlow ? selectedModel : undefined,
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
            const fetchBookmarks = async () => {
                if (!userId) return;
                try {
                    const bookmarkedMessages = await chatDB.getBookmarkedMessages(userId);
                    dispatch({ type: 'SET_BOOKMARKED_MESSAGES', payload: bookmarkedMessages });
                } catch (error) {
                    console.error('Failed to fetch bookmarks on focus', error);
                }
            };

            console.log("fetchBookmarks() is calling");
            fetchBookmarks();

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
        }, [navigation, isFullyOnboarded, userId, dispatch])
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

    const handleBookmarkPress = useCallback(async (messageId: string) => {
        const getBookmarkedMessages = await chatDB.getBookmarkedMessages(userId as string);

        try {
            if (getBookmarkedMessages.includes(messageId)) {
                await removeAIMessageBookmark(messageId);
                await chatDB.deleteBookmark(messageId);
                console.log("Bookmarked messages after deleting: ", await chatDB.getBookmarkedMessages(userId as string))
                dispatch({ type: 'TOGGLE_BOOKMARK', payload: messageId });

                Toast.show({
                    type: 'success',
                    text1: 'Bookmark Removed',
                    position: 'bottom',
                });
            } else {
                await addAIMessageBookmark(messageId);
                await chatDB.saveBookmark(messageId, userId as string);
                console.log("Bookmarked messages after adding: ", await chatDB.getBookmarkedMessages(userId as string))
                dispatch({ type: 'TOGGLE_BOOKMARK', payload: messageId });

                Toast.show({
                    type: 'success',
                    text1: 'Bookmark Added',
                    position: 'bottom',
                });
            }
        } catch (error) {
            chatLogger.error('Bookmark action failed', error);
            Toast.show({
                type: 'error',
                text1: 'Action Failed',
                text2: 'Please try again',
                position: 'bottom',
            });
        } finally {

        }
    }, [dispatch, userId]);

    return (
        <SafeAreaView style={[styles.container]}>
            <KeyboardAvoidingView
                behavior={isKeyboardVisible ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                enabled={true}
            >
                <View style={{ flex: 1 }}>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: 10,
                            marginBottom: 10,
                            marginTop: 20,
                            gap: 10
                        }}
                    >
                        {/* Navigate Back */}
                        <View>
                            <TouchableOpacity onPress={() => {
                                navigation.canGoBack() ?
                                    navigation.goBack() :
                                    BackHandler.exitApp();
                            }}>
                                <Lucide
                                    name='chevron-left'
                                    size={20}
                                    style={{
                                        padding: 5
                                    }}
                                    color={colors.black}
                                />
                            </TouchableOpacity>
                        </View>
                        <View style={[styles.vivaIntroContainer, { flexShrink: 1, flex: 1 }]}>
                            <Text style={[styles.vivaIntroText, globalStyles.fontBold]}>Viva, your personal assistant</Text>
                            {isChatbotFlow && (
                                <TouchableOpacity
                                    style={styles.modelPill}
                                    onPress={() => setModelSelectorVisible(true)}
                                >
                                    <Text style={styles.modelPillText}>
                                        {MODELS.find(m => m.id === selectedModel)?.label || selectedModel}
                                    </Text>
                                    <Lucide name="chevron-down" size={12} color={colors.darkPurple} />
                                </TouchableOpacity>
                            )}
                        </View>
                        {/* Navigate Back */}
                        {
                            isChatbotFlow && (
                                <View>
                                    <TouchableOpacity onPress={() => setMenuVisible(true)}>
                                        <Lucide
                                            name='ellipsis'
                                            size={20}
                                            style={{
                                                padding: 5
                                            }}
                                            color={colors.black}
                                        />
                                    </TouchableOpacity>
                                </View>
                            )
                        }
                    </View>
                    <ChatDropdownMenu
                        visible={menuVisible}
                        onClose={() => setMenuVisible(false)}
                        onOptionSelect={handleMenuOptionSelect}
                    />
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
                                    isFirst={index === 0}
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
                                    onBookmarkPress={handleBookmarkPress}
                                    isBookmarked={
                                        isAiMessage(msg)
                                            ? state.bookMarkedMessages.includes(msg.id)
                                            : false
                                    }
                                />
                            );
                        })}

                        {state.isLoading && <TypingIndicator />}
                        {state.errorMessage && <TouchableOpacity onPress={handleErrorRetry}><Text>Retry</Text></TouchableOpacity>}
                    </ScrollView>
                </View>

                <View style={{ backgroundColor: colors.white }}>
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
                <ModelSelector
                    visible={modelSelectorVisible}
                    onClose={() => setModelSelectorVisible(false)}
                    onSelect={setSelectedModel}
                    selectedModelId={selectedModel}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
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
        backgroundColor: colors.lightPurple,
        padding: 10,
        borderRadius: 10,
        alignItems: "center",
        borderColor: colors.darkPurple,
        borderWidth: 1
    },
    vivaIntroText: {
        color: colors.darkPurple,
        textAlign: 'center',
        fontSize: 15,
        lineHeight: 20
    },
    modelPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(75, 30, 170, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginTop: 4,
        gap: 4,
    },
    modelPillText: {
        fontSize: 11,
        color: colors.darkPurple,
        fontWeight: '600',
        ...globalStyles.fontSemiBold
    }
});

export default ChatWithVivaAI;