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
import { MODELS } from '../components/ModelSelector';

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
import { useCapability } from '../context/SubscriptionContext';
import { Capability } from '../types/entitlements.types';
import { determineInputMode, isAiMessage, isDobNode, getMaxDateOfBirth } from '../utils/messageHelpers';
import { MIN_AGE_YEARS } from '../constants/chat';
import { chatLogger } from '../utils/logger';
import { globalStyles } from '../public/styles';
import { syncUserData } from '../utils/syncUserData';
import { addAIMessageBookmark } from '../api/addAIMessageBookmark';
import { removeAIMessageBookmark } from '../api/removeAIMessageBookmark';
import { reportAIMessage } from '../api/reportAIMessage';
import ReportSheet from '../components/vivaClub/ReportSheet';
import { AI_REPORT_REASONS } from '../constants/moderation';
import { ReportReason } from '../types/vivaClub.types';
import { AnalyticsEvent, recordError, track } from '../analytics';
import Lucide from '@react-native-vector-icons/lucide';
import { useTranslation } from 'react-i18next';
import { useScreenEdges } from '../hooks/useScreenEdges';

const ChatWithVivaAI: React.FC = () => {
    const { t } = useTranslation();
    // Headerless in both registrations (the screen draws its own), so the top is always
    // ours; the bottom is only ours in the stack, where there is no tab bar.
    const edges = useScreenEdges(false);
    const navigation = useNavigation<any>();
    const route = useRoute<ChatScreenRouteProp>();
    const { userToken, userId, isFullyOnboarded, completeQuestionnaire, completeOnboarding, setPendingRedirect } = useAuth();

    // Which stack this screen was mounted in, captured once. Read live it would flip
    // the moment completeQuestionnaire() runs below, and the completion redirect would
    // then target a route belonging to the *other* stack.
    const wasFullyOnboardedRef = useRef(isFullyOnboarded());

    const flowConfig = useMemo(() => {
        return resolveFlowConfig(route.params?.flowSlug, isFullyOnboarded());
    }, [route.params?.flowSlug, isFullyOnboarded]);

    const { flowType, flowSlug } = flowConfig;

    // Determine if this is a guided flow (request-response) or chatbot (SSE)
    const isGuidedFlow = flowType === FlowType.ONBOARDING || flowType === FlowType.CHECKIN;
    const isChatbotFlow = flowType === FlowType.CHATBOT;

    // Limit and usage both come from the server; nothing here assumes "3".
    const aiQuota = useCapability(Capability.AI_CHAT);

    // Entering the chat, and — separately — entering it with no allowance left.
    // The blocked case is the interesting one: it is the moment a free user hits
    // the ceiling, and pairs with paywall_shown to size the upgrade opportunity.
    useEffect(() => {
        track(AnalyticsEvent.CHAT_OPENED, {
            flow_slug: flowSlug ?? undefined,
            flow_type: flowType ?? undefined,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (isChatbotFlow && !aiQuota.allowed) {
            track(AnalyticsEvent.CHAT_QUOTA_BLOCKED);
        }
    }, [isChatbotFlow, aiQuota.allowed]);

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

    // console.log("state issss =>>> ", state)

    useEffect(() => {
        (async function () {
            if (flowType && shouldSaveHistory(flowType)) {
                await loadHistory();
            }
        })()
    }, [flowType, loadHistory])

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isLmpDatePicker, setIsLmpDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const selectedModel = MODELS[0].id;

    const handleMenuOptionSelect = (option: 'Bookmarks' | 'About') => {
        switch (option) {
            case 'Bookmarks':
                navigation.navigate('BookmarkedMessages');
                break;
            case 'About':
                setMenuVisible(false);
                navigation.navigate('AboutVivaAI' as never);
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

    // For the date-of-birth question, cap the picker so the user must be at
    // least MIN_AGE_YEARS old; undefined for any other date question.
    const datePickerMaximumDate = useMemo(() => {
        // The Last Menstrual Period date can never be in the future.
        if (isLmpDatePicker) {
            return new Date();
        }
        return lastMessage && isDobNode(lastMessage)
            ? getMaxDateOfBirth()
            : undefined;
    }, [lastMessage, isLmpDatePicker]);

    const handleFlowComplete = useCallback(
        async (completedFlowType: FlowType) => {
            const { title, message } = getCompletionMessage(completedFlowType);
            console.log('Flow completed:', completedFlowType);
            track(AnalyticsEvent.CHAT_FLOW_COMPLETED, {
                flow_type: completedFlowType,
            });
            Toast.show({
                type: 'success',
                text1: t(title),
                text2: t(message),
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

            const redirect = getCompletionRedirect(
                completedFlowType,
                wasFullyOnboardedRef.current,
            );
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
        [completeQuestionnaire, navigation, userToken, t]
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
    /**
     * Discard chat history left over from a previous flow instance.
     *
     * Only COMPLETING a check-in cleared history, so one abandoned halfway through week 3
     * was still on screen in week 4 — old questions with live option buttons, which post
     * a stale nodeId against the new instance and come back rejected.
     */
    const handleFlowInstanceResolved = useCallback(async (flowInstanceId: string) => {
        if (!userId || !flowSlug || !flowType || !shouldSaveHistory(flowType)) return;

        const isStale = await chatDB.hasHistoryFromOtherFlowInstance(
            userId,
            flowSlug,
            flowInstanceId,
        );

        if (isStale) {
            await clearHistory();
        }
    }, [userId, flowSlug, flowType, clearHistory]);

    const { initialize: initializeGuidedFlow, submitAnswer: submitGuidedAnswer } = useGuidedFlow({
        flowType: isGuidedFlow ? flowType : null,
        flowSlug: isGuidedFlow ? flowSlug : null,
        dispatch,
        onMessageReceived: handleMessageReceived,
        onFlowComplete: handleFlowComplete,
        onFlowInstanceResolved: handleFlowInstanceResolved,
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
        handleLmpDateSelect,
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
        setIsLmpDatePicker(false);
        setSelectedDate(null);
        setShowDatePicker(true);
    }, []);

    const handleLmpDatePickerOpen = useCallback(() => {
        setIsLmpDatePicker(true);
        setSelectedDate(null);
        setShowDatePicker(true);
    }, []);

    const handleDateSelected = useCallback(
        (date: Date) => {
            // Last Menstrual Period: backend derives the expected delivery date.
            if (isLmpDatePicker) {
                setSelectedDate(date);
                setShowDatePicker(false);
                handleLmpDateSelect(date);
                return;
            }

            // Guard the date-of-birth question against under-age dates, in case the
            // native picker's maximumDate is bypassed on any platform.
            if (lastMessage && isDobNode(lastMessage) && date > getMaxDateOfBirth()) {
                setShowDatePicker(false);
                Toast.show({
                    type: 'error',
                    text1: t('chat.invalidDob'),
                    text2: t('chat.minAge', { years: MIN_AGE_YEARS }),
                    position: 'bottom',
                });
                return;
            }
            setSelectedDate(date);
            setShowDatePicker(false);
            handleDateSelect(date);
        },
        [handleDateSelect, handleLmpDateSelect, isLmpDatePicker, lastMessage, t]
    );

    // Stillbirth support buttons: the backend has already auto-enrolled the user
    // in the free plan and marked onboarding complete, so we record where to land
    // and flip the local onboarding flags. RootNavigator then resets to AppStack,
    // which consumes the pending redirect.
    const handleConsultExpert = useCallback(async () => {
        setPendingRedirect('experts');
        await completeOnboarding();
    }, [setPendingRedirect, completeOnboarding]);

    const handleChatWithViva = useCallback(async () => {
        setPendingRedirect('aiChat');
        await completeOnboarding();
    }, [setPendingRedirect, completeOnboarding]);

    // Straight to the expert the AI just recommended. The server has already checked
    // this expert is one she's allowed to see, so no gating is needed here — and
    // ExpertDetails owns booking, credits and payment from this point on.
    const handleConnectExpert = useCallback(
        (expertId: string) => {
            navigation.navigate('ExpertDetails', { expertId });
        },
        [navigation]
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

    // Was a stub that only cleared the loading flag, so the retry affordance below did
    // nothing even when it rendered. Guided flows are resume-or-create on the server, so
    // re-initialising picks up exactly where she left off.
    const handleErrorRetry = useCallback(async () => {
        dispatch({ type: 'RESET_ERROR' });
        if (isGuidedFlow) {
            await initializeGuidedFlow();
        }
    }, [dispatch, isGuidedFlow, initializeGuidedFlow]);

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
                text1: t('chat.refreshed'),
                text2: t('chat.chatReloaded'),
                position: 'bottom',
            });
        } catch (error) {
            chatLogger.error('Refresh failed', error);
            Toast.show({
                type: 'error',
                text1: t('chat.refreshFailed'),
                text2: t('common.pleaseTryAgain'),
                position: 'bottom',
            });
        } finally {
            setRefreshing(false);
        }
    }, [isGuidedFlow, flowType, loadHistory, initializeGuidedFlow, disconnect, connect, t]);

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
                    text1: t('common.error'),
                    text2: t('chat.failedInit'),
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

            // Returning false in the last branch hands the press back to the platform
            // instead of calling exitApp(). Same outcome — the activity finishes — but
            // it is the only form that survives predictive back (targetSdk 36), where
            // the OS drives the close animation before JS is consulted and an explicit
            // exitApp() kills the process mid-animation.
            const onBackPress = () => {
                if (navigation.canGoBack()) {
                    navigation.goBack();
                    return true;
                }
                if (isFullyOnboarded()) {
                    navigation.navigate('DashboardTabNavigator');
                    return true;
                }
                return false;
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
                track(AnalyticsEvent.CHAT_BOOKMARK_REMOVED);

                Toast.show({
                    type: 'success',
                    text1: t('chat.bookmarkRemoved'),
                    position: 'bottom',
                });
            } else {
                await addAIMessageBookmark(messageId);
                await chatDB.saveBookmark(messageId, userId as string);
                console.log("Bookmarked messages after adding: ", await chatDB.getBookmarkedMessages(userId as string))
                dispatch({ type: 'TOGGLE_BOOKMARK', payload: messageId });
                track(AnalyticsEvent.CHAT_BOOKMARK_ADDED);

                Toast.show({
                    type: 'success',
                    text1: t('chat.bookmarkAdded'),
                    position: 'bottom',
                });
            }
        } catch (error) {
            chatLogger.error('Bookmark action failed', error);
            recordError(error, 'ChatWithVivaAI.handleBookmarkPress');
            Toast.show({
                type: 'error',
                text1: t('chat.actionFailed'),
                text2: t('common.pleaseTryAgain'),
                position: 'bottom',
            });
        } finally {

        }
    }, [dispatch, userId, t]);

    /**
     * Flagging a Viva AI reply.
     *
     * The sheet is opened against a specific message id rather than a boolean, so the
     * id cannot drift if new replies stream in while it is open.
     */
    const [flaggingMessageId, setFlaggingMessageId] = useState<string | null>(null);
    const [flagSubmitting, setFlagSubmitting] = useState(false);

    const handleFlagPress = useCallback((messageId: string) => {
        setFlaggingMessageId(messageId);
    }, []);

    const submitFlag = useCallback(async (reason: ReportReason, details: string) => {
        if (!flaggingMessageId) return;
        setFlagSubmitting(true);
        try {
            await reportAIMessage({ messageId: flaggingMessageId, reason, details });
            // The reason, never the text. A flagged reply and the question behind it are
            // exactly the health disclosure that must not leave the device this way.
            track(AnalyticsEvent.AI_MESSAGE_REPORTED, { reason });
            setFlaggingMessageId(null);
            Toast.show({
                type: 'success',
                text1: t('chat.reportThanks'),
                text2: t('chat.reportThanksBody'),
                position: 'bottom',
            });
        } catch (error) {
            chatLogger.error('Report AI message failed', error);
            recordError(error, 'ChatWithVivaAI.submitFlag');
            Toast.show({
                type: 'error',
                text1: t('chat.actionFailed'),
                text2: t('common.pleaseTryAgain'),
                position: 'bottom',
            });
        } finally {
            setFlagSubmitting(false);
        }
    }, [flaggingMessageId, t]);

    return (
        <SafeAreaView style={[styles.container]} edges={edges}>
            <ReportSheet
                visible={!!flaggingMessageId}
                submitting={flagSubmitting}
                subjectKey="chat.reportSubject"
                reasons={AI_REPORT_REASONS}
                // She is told her own message goes too, before she sends it.
                noticeKey="chat.reportNotice"
                onSubmit={submitFlag}
                onDismiss={() => setFlaggingMessageId(null)}
            />
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
                                // Keeps exitApp() as the terminal branch: this is an
                                // explicit tap, not the system gesture, so predictive
                                // back never intercepts it — and during onboarding this
                                // screen is the stack root with nothing to go back to,
                                // which would otherwise leave a dead chevron.
                                if (navigation.canGoBack()) {
                                    navigation.goBack();
                                } else if (isFullyOnboarded()) {
                                    navigation.navigate('DashboardTabNavigator');
                                } else {
                                    BackHandler.exitApp();
                                }
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
                            <Text style={[styles.vivaIntroText, globalStyles.fontBold]}>{t('chat.vivaIntro')}</Text>
                            {/* {isChatbotFlow && (
                                <TouchableOpacity
                                    style={styles.modelPill}
                                    onPress={() => setModelSelectorVisible(true)}
                                >
                                    <Text style={styles.modelPillText}>
                                        {MODELS.find(m => m.id === selectedModel)?.label || selectedModel}
                                    </Text>
                                    <Lucide name="chevron-down" size={12} color={colors.darkPurple} />
                                </TouchableOpacity>
                            )} */}
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
                                    onLmpDatePickerOpen={handleLmpDatePickerOpen}
                                    onNotPregnantSelect={handleNotPregnantSelect}
                                    onConsultExpert={handleConsultExpert}
                                    onChatWithViva={handleChatWithViva}
                                    onAnimationComplete={handleAnimationComplete}
                                    onConnectExpert={handleConnectExpert}
                                    onBookmarkPress={handleBookmarkPress}
                                    onFlagPress={handleFlagPress}
                                    isBookmarked={
                                        isAiMessage(msg)
                                            ? state.bookMarkedMessages.includes(msg.id)
                                            : false
                                    }
                                />
                            );
                        })}

                        {state.isLoading && <TypingIndicator />}
                        {/* The message itself was never rendered — only a bare "Retry" on
                            an otherwise blank screen, and only when errorMessage was set,
                            which the guided-flow hook never did. */}
                        {state.errorMessage ? (
                            <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingVertical: 32 }}>
                                <Text style={[globalStyles.fontRegular, {
                                    fontSize: 14,
                                    color: colors.darkGray,
                                    textAlign: 'center',
                                    marginBottom: 14,
                                }]}>
                                    {state.errorMessage}
                                </Text>
                                <TouchableOpacity
                                    onPress={handleErrorRetry}
                                    style={{
                                        paddingVertical: 10,
                                        paddingHorizontal: 26,
                                        borderRadius: 20,
                                        borderWidth: 1.5,
                                        borderColor: colors.purple,
                                    }}
                                >
                                    <Text style={[globalStyles.fontSemiBold, { color: colors.darkPurple, fontSize: 14 }]}>
                                        {t('common.retry')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}
                    </ScrollView>
                </View>

                <View style={{ backgroundColor: colors.white }}>
                    {/* Shown before she is blocked, next to the input — not as an error
                        after tapping send. Scoped to the chatbot: the onboarding and
                        check-in flows run through this same screen and are not metered
                        against the AI allowance. */}
                    {isChatbotFlow && !aiQuota.unlimited && aiQuota.limit != null ? (
                        <Text
                            style={[globalStyles.fontRegular, {
                                fontSize: 11,
                                textAlign: 'center',
                                paddingTop: 6,
                                color: aiQuota.allowed ? colors.gray : colors.warning,
                            }]}
                        >
                            {aiQuota.allowed
                                ? t('subscription.questionsLeft', {
                                    remaining: aiQuota.remaining ?? 0,
                                    limit: aiQuota.limit,
                                })
                                : t('subscription.questionsNoneLeft')}
                        </Text>
                    ) : null}

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
                    <Text style={[globalStyles.fontRegular, { fontSize: 10, color: colors.gray, textAlign: 'center', paddingBottom: 10, paddingTop: 5, paddingHorizontal: 10 }]}>
                        {t('chat.disclaimer')}
                    </Text>
                </View>

                <CustomDatePicker
                    show={showDatePicker}
                    setShow={setShowDatePicker}
                    selectedDate={selectedDate}
                    onSelect={handleDateSelected}
                    maximumDate={datePickerMaximumDate}
                />
                {/* <ModelSelector
                    visible={modelSelectorVisible}
                    onClose={() => setModelSelectorVisible(false)}
                    onSelect={setSelectedModel}
                    selectedModelId={selectedModel}
                /> */}
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