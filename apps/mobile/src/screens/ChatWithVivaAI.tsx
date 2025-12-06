import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    AppState,
    AppStateStatus,
    BackHandler,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EventSource from 'react-native-sse';
import Toast from 'react-native-toast-message';
import CustomDatePicker from '../components/CustomDatePicker';
import { useAuth } from '../context/AuthContext';
import { chatDB } from '../db/sqlite';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { styles as chatStyles } from '../public/styles/chatWithVivaAiStyles';
import { IDBAiMessage, IDBChatMessage, IDBUserMessage, IOption } from "../types/vivaAi.types";
import { CHAT_FLOW_ANSWER, CHAT_SESSION_URL } from '../constants/endpoints';
import apiClientInterceptor from '../api/apiClientInterceptor';

const TYPING_SPEED_MS = 30;

const RenderTypingIndicator: React.FC = () => (
    <View style={[chatStyles.messageContainer, chatStyles.aiMessage]}>
        <Text style={[chatStyles.messageText, globalStyles.fontRegular]}>AI is thinking...</Text>
    </View>
);

export default function ChatWithVivaAi({ route }: { route: { params: { flowSlug?: string } } }) {
    const [show, setShow] = useState<boolean>(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedMultiOptions, setSelectedMultiOptions] = useState<Set<string>>(new Set());

    const { userToken, userId, isFullyOnboarded, completeQuestionnaire } = useAuth();

    let FLOW_SLUG = isFullyOnboarded() ? route.params?.flowSlug as string : 'onboarding-flow-v2';

    const navigation = useNavigation();
    const [inputText, setInputText] = useState('');
    const [chatHistory, setChatHistory] = useState<IDBChatMessage[]>([]);
    const [animatingMessageId, setAnimatingMessageId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFlowComplete, setIsFlowComplete] = useState(false);

    const eventSourceRef = useRef<EventSource | null>(null);
    const scrollViewRef = useRef<ScrollView | null>(null);
    const appState = useRef<AppStateStatus>(AppState.currentState);

    useEffect(() => {
        const backAction = () => {
            navigation.canGoBack() ?
                navigation.goBack() :
                isFullyOnboarded() ?
                    navigation.navigate("DashboardTabNavigator" as never) : BackHandler.exitApp();
            return true;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction,
        );

        return () => backHandler.remove();
    }, [isFullyOnboarded, navigation]);

    // determine if message is text input
    const isTextInputMessage = (message: IDBChatMessage): boolean => {
        if (!message) return false;
        return (
            message.type === 'ai' &&
            message.nodeType === 'QUESTION_FREE_TEXT'
        );
    };

    // determine if the message to be take from date input
    const isDateInputMessage = (message: IDBChatMessage): boolean => {
        if (!message) return false;
        return (
            message.type === 'ai' &&
            message.nodeType === 'QUESTION_DATE'
        );
    };

    // determine if message is multi-select
    const isMultiSelectMessage = (message: IDBChatMessage): boolean => {
        if (!message) return false;
        return (
            message.type === 'ai' &&
            message.nodeType === 'QUESTION_MULTI'
        );
    };

    // Determine when we should show which type of input
    const lastMessage = chatHistory[chatHistory.length - 1];
    const shouldShowTextInput =
        isTextInputMessage(lastMessage) &&
        !isLoading &&
        !isFlowComplete &&
        !animatingMessageId;

    const shouldShowDateInput =
        isDateInputMessage(lastMessage) &&
        lastMessage.type == "ai" &&
        lastMessage?.id !== "delivery_date" &&
        !shouldShowTextInput &&
        !isLoading &&
        !isFlowComplete &&
        !animatingMessageId;

    const shouldShowMultiSubmit =
        isMultiSelectMessage(lastMessage) &&
        !isLoading &&
        !isFlowComplete &&
        !animatingMessageId;

    // Handle date answer input
    const handleDateSelected = async (date: Date) => {
        if (!userId || isLoading || animatingMessageId || isFlowComplete) {
            return;
        }

        const lastAi = await chatDB.getLastAiMessage(userId, FLOW_SLUG);
        if (!lastAi || !isDateInputMessage(lastAi)) {
            console.error('No valid date input message to respond to');
            return;
        }

        const formatted = date.toISOString().split("T")[0];

        // Create and save user message
        const userMessage: IDBUserMessage = {
            type: 'user',
            text: formatted,
            timestamp: Date.now(),
        };

        await chatDB.saveUserMessage(userId, FLOW_SLUG, userMessage);

        // Update chat history
        setChatHistory((prev) =>
            prev.map((msg) =>
                msg.type === 'ai' && msg.id === lastAi.id ? { ...msg, options: [] } : msg
            ).concat(userMessage)
        );

        setIsLoading(true);

        try {
            await apiClientInterceptor().post(CHAT_FLOW_ANSWER, {
                userId: userId,
                flowInstanceId: lastAi.flowInstanceId,
                nodeId: lastAi.id,
                freeText: formatted,
            });

            console.log('Date answer sent successfully:', formatted);
        } catch (error: any) {
            console.error('Send error:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.response?.data?.message || 'Failed to send answer',
                position: 'bottom'
            });
            setIsLoading(false);
        }
    };

    const handleNotPregnantSelected = async () => {
        if (!userId || isLoading || animatingMessageId || isFlowComplete) {
            return;
        }

        const lastAi = await chatDB.getLastAiMessage(userId, FLOW_SLUG);
        if (!lastAi) {
            console.error('No AI message found to respond to');
            return;
        }

        const userMessage: IDBUserMessage = {
            type: 'user',
            text: "I'm not pregnant yet",
            timestamp: Date.now(),
        };

        await chatDB.saveUserMessage(userId, FLOW_SLUG, userMessage);

        setChatHistory((prev) =>
            prev.map((msg) =>
                msg.type === 'ai' && msg.id === lastAi.id ? { ...msg, options: [] } : msg
            ).concat(userMessage)
        );

        setIsLoading(true);

        try {
            await apiClientInterceptor().post(CHAT_FLOW_ANSWER, {
                userId: userId,
                flowInstanceId: lastAi.flowInstanceId,
                nodeId: lastAi.id,
                freeText: "not_pragnent",
            });

            console.log('Not pregnant answer sent successfully');
        } catch (error: any) {
            console.error('Send error:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.response?.data?.message || 'Failed to send answer',
                position: 'bottom'
            });
            setIsLoading(false);
        }
    };

    useEffect(() => {
        initializeChat();

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            eventSourceRef.current?.close();
            eventSourceRef.current = null;
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        if (chatHistory.length > 0 && userId) {
            saveChatToDatabase();
        }
    }, [chatHistory]);

    // Clear multi-select state when a new question appears
    useEffect(() => {
        if (lastMessage && lastMessage.type === 'ai' && isMultiSelectMessage(lastMessage)) {
            setSelectedMultiOptions(new Set());
        }
    }, [lastMessage && lastMessage.type === 'ai' ? lastMessage.uuid : null]);

    const saveChatToDatabase = async () => {
        try {
            console.log('Chat state synced');
        } catch (error) {
            console.error('Failed to save to database:', error);
        }
    };

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
            console.log('App came to foreground, reloading history from SQLite...');
            await loadHistory();
        }
        appState.current = nextAppState;
    };

    const initializeChat = async () => {
        try {
            await chatDB.init();
            await loadHistory();
            connectToServer();
        } catch (error) {
            console.error('Failed to initialize chat:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to initialize chat database',
                position: 'bottom'
            });
        }
    };

    const loadHistory = async () => {
        if (!userId) {
            console.log('No userId available');
            return;
        }

        try {
            const messages = await chatDB.getChatHistory(userId, FLOW_SLUG);
            // chatDB.clearChatHistory(userId, FLOW_SLUG); // this is for testing
            setChatHistory(messages);
            console.log('Loaded history from SQLite:', messages.length, 'messages');
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    };

    const connectToServer = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }
        const es = new EventSource(CHAT_SESSION_URL(FLOW_SLUG, userToken as string));
        eventSourceRef.current = es;

        if (chatHistory.length === 0) {
            setIsLoading(true);
        }

        es.addEventListener('open', () => {
            console.log('SSE Connected');
        });

        es.addEventListener('message', async (event) => {
            try {
                const data = JSON.parse(event.data!);

                if (data.type === 'end_flow') {
                    console.log(' == Flow completed == ');
                    setIsFlowComplete(true);
                    setIsLoading(false);

                    if (data.flowType == "ONBOARDING") {
                        // complete the onboarding Questionnaire process
                        await completeQuestionnaire();

                        Toast.show({
                            type: 'success',
                            text1: 'Complete',
                            text2: 'Your onboarding questionnaire is completed! You will be redirected soon',
                            position: 'top',
                            visibilityTime: 2500
                        });
                        // redirect the user to the subscriptions page
                        setTimeout(() => {
                            navigation.reset({
                                index: 0,
                                routes: [{ name: "Services" as never }],
                            });
                        }, 7000);
                    } else {
                        Toast.show({
                            type: 'success',
                            text1: 'Complete',
                            text2: 'Chat Flow Completed!',
                            position: 'bottom'
                        });
                    }

                    es.close();
                    return;
                }

                if (data.type === 'error') {
                    Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: data.message || 'An error occurred',
                        position: 'bottom'
                    });
                    setIsLoading(false);
                    return;
                }

                const aiMessage: IDBAiMessage = {
                    type: 'ai',
                    id: data.id,
                    flowInstanceId: data.flowInstanceId,
                    text: data.text,
                    educationalMessage: data.educationalMessage,
                    whyThisMatters: data.whyThisMatters,
                    options: data.options || [],
                    nodeType: data.nodeType,
                    timestamp: Date.now(),
                    uuid: data.uuid,
                };

                const exists = await chatDB.messageExists(userId as string, FLOW_SLUG, aiMessage.uuid);

                if (exists) {
                    console.log('Duplicate question from SSE');
                    setIsLoading(false);
                    return;
                }

                await chatDB.saveAiMessage(userId!, FLOW_SLUG, aiMessage);
                console.log('New question via SSE:', data.id);

                setChatHistory((prev) => [...prev, aiMessage]);
                setAnimatingMessageId(aiMessage.uuid);
                setIsLoading(false);
            } catch (error) {
                console.error('Parse error:', error);
            }
        });

        es.addEventListener('error', (e: any) => {
            console.error('SSE error:', e);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Connection lost. Retrying...',
                position: 'bottom'
            });
            setIsLoading(false);
            setTimeout(connectToServer, 5000);
        });
    };

    const handleSendAnswer = async (option: IOption) => {
        if (isLoading || animatingMessageId || isFlowComplete || !userId) {
            return;
        }

        const lastAi = await chatDB.getLastAiMessage(userId, FLOW_SLUG);
        if (!lastAi) {
            console.error('No AI message found to respond to');
            return;
        }

        const userMessage: IDBUserMessage = {
            type: 'user',
            text: option.label,
            timestamp: Date.now(),
        };

        await chatDB.saveUserMessage(userId, FLOW_SLUG, userMessage);

        setChatHistory((prev) =>
            prev.map((msg) =>
                msg.type === 'ai' && msg.id === lastAi.id ? { ...msg, options: [] } : msg
            ).concat(userMessage)
        );

        setIsLoading(true);

        try {
            await apiClientInterceptor().post(CHAT_FLOW_ANSWER, {
                flowInstanceId: lastAi.flowInstanceId,
                nodeId: lastAi.id,
                selectedKeys: [option.score],
            });
            console.log('Answer sent');
        } catch (error: any) {
            console.error('Send error:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to send answer',
                position: 'bottom'
            });
            setIsLoading(false);
        }
    };

    // Handle multi-select option toggle
    const handleMultiOptionToggle = (option: IOption, allOptions: IOption[]) => {
        setSelectedMultiOptions(prev => {
            const newSet = new Set(prev);
            const isNoneOption =
                option.value === 'none' ||
                option.value === 'history_none' ||
                option.value === 'meds_none';

            // Find if there's a "none" option in current selections
            const noneOption = allOptions.find(opt =>
                opt.value === 'none' ||
                opt.value === 'history_none' ||
                opt.value === 'meds_none'
            );

            if (isNoneOption) {
                if (newSet.has(option.id)) {
                    newSet.delete(option.id); // unselect none option if tapped again
                } else {
                    newSet.clear(); // deslect all other options
                    newSet.add(option.id);
                }
            } else {
                // If clicking any other option, remove "None" if it's selected
                if (noneOption && newSet.has(noneOption.id)) {
                    newSet.delete(noneOption.id);
                }

                // Toggle the current option
                if (newSet.has(option.id)) {
                    newSet.delete(option.id);
                } else {
                    newSet.add(option.id);
                }
            }

            return newSet;
        });
    };

    // Handle multi-select submit
    const handleSubmitMultiSelect = async () => {
        if (selectedMultiOptions.size === 0 || !userId) {
            Toast.show({
                type: 'info',
                text1: 'Please select at least one option',
                position: 'bottom'
            });
            return;
        }

        if (isLoading || animatingMessageId || isFlowComplete) {
            return;
        }

        const lastAi = await chatDB.getLastAiMessage(userId, FLOW_SLUG);
        if (!lastAi) {
            console.error('No AI message found to respond to');
            return;
        }

        // Get selected options details
        const selectedOptions = lastAi.options.filter(opt =>
            selectedMultiOptions.has(opt.id)
        );

        const selectedLabels = selectedOptions.map(opt => opt.label).join(', ');
        const selectedScores = selectedOptions.map(opt => opt.score);

        const userMessage: IDBUserMessage = {
            type: 'user',
            text: selectedLabels,
            timestamp: Date.now(),
        };

        await chatDB.saveUserMessage(userId, FLOW_SLUG, userMessage);

        setChatHistory((prev) =>
            prev.map((msg) =>
                msg.type === 'ai' && msg.id === lastAi.id ? { ...msg, options: [] } : msg
            ).concat(userMessage)
        );

        setSelectedMultiOptions(new Set());
        setIsLoading(true);

        try {
            await apiClientInterceptor().post(CHAT_FLOW_ANSWER, {
                flowInstanceId: lastAi.flowInstanceId,
                nodeId: lastAi.id,
                selectedKeys: selectedScores,
            });
            console.log('Multi-select answer sent:', selectedScores);
        } catch (error: any) {
            console.error('Send error:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to send answer',
                position: 'bottom'
            });
            setIsLoading(false);
        }
    };

    // Handle text input answers
    const handleSendTextAnswer = async () => {
        if (!inputText.trim() || !userId) {
            return;
        }

        if (isLoading || animatingMessageId || isFlowComplete) {
            return;
        }

        const lastAi = await chatDB.getLastAiMessage(userId, FLOW_SLUG);
        if (!lastAi) {
            console.error('No AI message found to respond to');
            return;
        }

        if (!isTextInputMessage(lastAi) && !isDateInputMessage(lastAi)) {
            console.error('Last message is not a text input or date input question');
            return;
        }

        const userMessage: IDBUserMessage = {
            type: 'user',
            text: inputText.trim(),
            timestamp: Date.now(),
        };

        await chatDB.saveUserMessage(userId, FLOW_SLUG, userMessage);

        setChatHistory((prev) =>
            prev.map((msg) =>
                msg.type === 'ai' && msg.id === lastAi.id ? { ...msg, options: [] } : msg
            ).concat(userMessage)
        );

        const textToSend = inputText.trim();
        setInputText('');
        setIsLoading(true);

        try {
            const response = await apiClientInterceptor().post(CHAT_FLOW_ANSWER, {
                userId: userId,
                flowInstanceId: lastAi.flowInstanceId,
                nodeId: lastAi.id,
                freeText: textToSend,
            });

            console.log('Text answer sent successfully:', textToSend);
            console.log('Response:', response.data);

        } catch (error: any) {
            console.error('Send error:', error);

            if (error.response) {
                console.error('Error status:', error.response.status);
                console.error('Error data:', error.response.data);
            } else if (error.request) {
                console.error('No response received:', error.request);
            } else {
                console.error('Error message:', error.message);
            }

            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.response?.data?.message || 'Failed to send answer',
                position: 'bottom'
            });
            setIsLoading(false);
        }
    };
    useEffect(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
    }, [selectedMultiOptions.size]);

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <ScrollView
                ref={scrollViewRef}
                style={globalStyles.chatContainer}
                onContentSizeChange={() =>
                    scrollViewRef.current?.scrollToEnd({ animated: true })
                }
            >
                {chatHistory.map((msg, i) => {
                    const isLast = i === chatHistory.length - 1;
                    const shouldAnimate = msg.type === 'ai' && msg.uuid === animatingMessageId;

                    if (shouldAnimate) {
                        return (
                            <AnimatedBubble
                                key={msg.uuid}
                                message={msg}
                                onComplete={() => setAnimatingMessageId(null)}
                                onSelect={handleSendAnswer}
                                onMultiToggle={handleMultiOptionToggle}
                                selectedMultiOptions={selectedMultiOptions}
                                isTextInputHelper={isTextInputMessage}
                                isMultiSelectHelper={isMultiSelectMessage}
                                setShow={setShow}
                                handleNotPregnantSelected={handleNotPregnantSelected}
                            />
                        );
                    }

                    return (
                        <StaticBubble
                            key={i}
                            message={msg}
                            isLast={isLast}
                            isAnimating={!!animatingMessageId}
                            isComplete={isFlowComplete}
                            onSelect={handleSendAnswer}
                            onMultiToggle={handleMultiOptionToggle}
                            selectedMultiOptions={selectedMultiOptions}
                            isTextInputHelper={isTextInputMessage}
                            isMultiSelectHelper={isMultiSelectMessage}
                            setShow={setShow}
                            handleNotPregnantSelected={handleNotPregnantSelected}
                        />
                    );
                })}

                {isLoading && <RenderTypingIndicator />}
            </ScrollView>

            {(shouldShowTextInput || shouldShowDateInput) && (
                <View style={chatStyles.inputContainer}>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={1}
                        onPress={() => {
                            if (shouldShowDateInput) {
                                setShow(true);
                            }
                        }}
                    >
                        <TextInput
                            style={[chatStyles.textInput, globalStyles.fontRegular]}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder={
                                shouldShowDateInput
                                    ? "Select a date"
                                    : "Type your answer"
                            }
                            placeholderTextColor={colors.black}
                            editable={!shouldShowDateInput}
                            pointerEvents={shouldShowDateInput ? "none" : "auto"}
                            onSubmitEditing={handleSendTextAnswer}
                            returnKeyType="send"
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        disabled={inputText.trim().length === 0 || isLoading}
                        style={[
                            chatStyles.sendButton,
                            (inputText.trim().length === 0 || isLoading) && {
                                backgroundColor: 'grey'
                            }
                        ]}
                        onPress={handleSendTextAnswer}
                    >
                        <MaterialDesignIcons
                            name="send-outline"
                            size={20}
                            color={colors.white}
                            style={{ transform: [{ rotate: '-35deg' }] }}
                        />
                    </TouchableOpacity>
                </View>
            )}

            {/* Show the location input button */}
            {
                // shouldShowLocationInput && (
                //     <View style={chatStyles.inputContainer}>
                //         <GetUserLocation />

                //         <TouchableOpacity
                //             disabled={inputText.trim().length === 0 || isLoading}
                //             style={[
                //                 chatStyles.sendButton,
                //                 (inputText.trim().length === 0 || isLoading) && {
                //                     backgroundColor: 'grey'
                //                 }
                //             ]}
                //             onPress={handleSendTextAnswer}
                //         >
                //             <MaterialDesignIcons
                //                 name="send-outline"
                //                 size={20}
                //                 color={colors.white}
                //                 style={{ transform: [{ rotate: '-35deg' }] }}
                //             />
                //         </TouchableOpacity>
                //     </View>
                // )
            }

            {shouldShowMultiSubmit && selectedMultiOptions.size > 0 && (
                <View style={[chatStyles.inputContainer, { alignItems: 'center' }]}>
                    <Text style={[{ ...globalStyles.fontMedium, color: colors.black, flex: 1 }]}>
                        {selectedMultiOptions.size} selected, click the button to submit.
                    </Text>

                    <TouchableOpacity
                        disabled={selectedMultiOptions.size === 0 || isLoading}
                        style={[
                            chatStyles.sendButton,
                            (selectedMultiOptions.size === 0 || isLoading) && {
                                backgroundColor: 'grey'
                            }
                        ]}
                        onPress={handleSubmitMultiSelect}
                    >
                        <MaterialDesignIcons
                            name="send-outline"
                            size={20}
                            color={colors.white}
                            style={{ transform: [{ rotate: '-35deg' }] }}
                        />
                    </TouchableOpacity>
                </View>
            )}

            <CustomDatePicker
                show={show}
                setShow={setShow}
                selectedDate={selectedDate}
                onSelect={handleDateSelected}
            />
        </SafeAreaView>
    );
}

// StaticBubble Component
const StaticBubble = ({
    message,
    isLast,
    isAnimating,
    isComplete,
    onSelect,
    onMultiToggle,
    selectedMultiOptions,
    isTextInputHelper,
    isMultiSelectHelper,
    setShow,
    handleNotPregnantSelected,
}: any) => {
    const isTextInput = isTextInputHelper(message);
    const isMultiSelect = isMultiSelectHelper(message);

    const showOptions =
        message.type === 'ai' &&
        isLast &&
        !isAnimating &&
        !isComplete &&
        !isTextInput &&
        message.options.length > 0;

    return (
        <View>
            <View style={[chatStyles.bubble, message.type === 'ai' ? chatStyles.aiMessage : chatStyles.userMessage]}>
                <Text style={chatStyles.messageText}>{message.text}</Text>
            </View>

            {/* for delivery_date node: show two option cards */}
            {message.id === "delivery_date" && isLast && !isAnimating && !isComplete && (
                <View style={chatStyles.optionsInMessageContainer}>
                    <TouchableOpacity
                        style={chatStyles.optionButton}
                        onPress={() => setShow(true)}
                    >
                        <Text style={chatStyles.optionButtonText}>Select Delivery Date</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={chatStyles.optionButton}
                        onPress={handleNotPregnantSelected}
                    >
                        <Text style={chatStyles.optionButtonText}>I'm Not Pregnant Yet</Text>
                    </TouchableOpacity>
                </View>
            )}

            {showOptions && message.id !== "delivery_date" && (
                <View style={chatStyles.optionsInMessageContainer}>
                    {message.options.map((opt: IOption) => {
                        const isSelected = selectedMultiOptions.has(opt.id);
                        return (
                            <TouchableOpacity
                                key={opt.id}
                                style={[
                                    chatStyles.optionButton,
                                    isMultiSelect && isSelected && {
                                        backgroundColor: colors.secondary,
                                        borderColor: colors.secondary,
                                    }
                                ]}
                                onPress={() => isMultiSelect ? onMultiToggle(opt, message.options) : onSelect(opt)}
                            >
                                <Text style={[
                                    chatStyles.optionButtonText,
                                    isMultiSelect && isSelected && { color: colors.white }
                                ]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        </View>
    );
};

// AnimatedBubble Component
const AnimatedBubble = ({
    message,
    onComplete,
    onSelect,
    onMultiToggle,
    selectedMultiOptions,
    isTextInputHelper,
    isMultiSelectHelper,
    setShow,
    setInputText,
    handleSendTextAnswer,
}: any) => {
    const [displayed, setDisplayed] = useState('');
    const [showOptions, setShowOptions] = useState(false);
    const isTextInput = isTextInputHelper(message);
    const isMultiSelect = isMultiSelectHelper(message);

    useEffect(() => {
        let i = 0;
        const interval = setInterval(() => {
            i++;
            setDisplayed(message.text.substring(0, i));
            if (i >= message.text.length) {
                clearInterval(interval);
                setShowOptions(true);
                onComplete();
            }
        }, TYPING_SPEED_MS);
        return () => clearInterval(interval);
    }, []);

    return (
        <View>
            <View style={[chatStyles.bubble, chatStyles.aiMessage]}>
                <Text style={chatStyles.messageText}>{displayed}</Text>
            </View>

            {/* For delivery_date node, after typing finishes show the two option cards */}
            {showOptions && message.id === "delivery_date" && (
                <View style={chatStyles.optionsInMessageContainer}>
                    <TouchableOpacity
                        style={chatStyles.optionButton}
                        onPress={() => setShow(true)}
                    >
                        <Text style={chatStyles.optionButtonText}>Select Delivery Date</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={chatStyles.optionButton}
                        onPress={() => {
                            setInputText("not_pragnent");
                            handleSendTextAnswer();
                        }}
                    >
                        <Text style={chatStyles.optionButtonText}>I'm Not Pregnant</Text>
                    </TouchableOpacity>
                </View>
            )}

            {showOptions && !isTextInput && message.options.length > 0 && message.id !== "delivery_date" && (
                <View style={chatStyles.optionsInMessageContainer}>
                    {message.options.map((opt: IOption) => {
                        const isSelected = selectedMultiOptions.has(opt.id);
                        return (
                            <TouchableOpacity
                                key={opt.id}
                                style={[
                                    chatStyles.optionButton,
                                    isMultiSelect && isSelected && {
                                        backgroundColor: colors.secondary,
                                        borderColor: colors.secondary,
                                    }
                                ]}
                                onPress={() => isMultiSelect ? onMultiToggle(opt, message.options) : onSelect(opt)}
                            >
                                <Text style={[
                                    chatStyles.optionButtonText,
                                    isMultiSelect && isSelected && { color: colors.white }
                                ]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        </View>
    );
};
