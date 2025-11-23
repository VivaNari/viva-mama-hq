import React, { useState, useEffect, useRef } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Alert,
    AppState,
    AppStateStatus,
    TextInput,
    BackHandler,
} from 'react-native';
import EventSource from 'react-native-sse';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { chatDB } from '../db/sqlite';
import { styles as chatStyles } from '../public/styles/chatWithVivaAiStyles';
import { IOption, IDBAiMessage, IDBUserMessage, IDBChatMessage } from "../types/vivaAi.types";
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { globalStyles } from '../public/styles';
import { colors } from '../public/assets/colors';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import { useNavigation } from '@react-navigation/native';

const API_BASE_URL = 'http://192.168.1.22:4000/api/v1';
const TYPING_SPEED_MS = 30;

const RenderTypingIndicator: React.FC = () => (
    <View style={[chatStyles.messageContainer, chatStyles.aiMessage]}>
        <Text style={[chatStyles.messageText, globalStyles.fontRegular]}>AI is thinking...</Text>
    </View>
);

export default function ChatWithVivaAi({ route }: { route: { params: { flowSlug?: string } } }) {

    const { userToken, userId, isOnboarded, completeOnboarding } = useAuth();
    let FLOW_SLUG = '';
    if (isOnboarded) {
        FLOW_SLUG = route.params?.flowSlug as string;
    } else {
        FLOW_SLUG = 'onboarding-flow-v1';
    }
    console.log("FLOW_SLUG as params =>", FLOW_SLUG)
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
                isOnboarded ?
                    navigation.navigate("DashboardTabNavigator" as never) : BackHandler.exitApp();
            return true;
        };

        // Subscribe to the hardware back press event
        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction,
        );

        // Unsubscribe when the component unmounts
        return () => backHandler.remove();
    }, [isOnboarded]);

    // determine if message is text input
    const isTextInputMessage = (message: IDBChatMessage): boolean => {
        if (!message) return false;
        return (
            message.type === 'ai' &&
            message.nodeType === 'QUESTION_SINGLE' &&
            message.options.length === 0
        );
    };

    // Determine if we should show text input
    const lastMessage = chatHistory[chatHistory.length - 1];
    const shouldShowTextInput =
        isTextInputMessage(lastMessage) &&
        !isLoading &&
        !isFlowComplete &&
        !animatingMessageId;

    useEffect(() => {
        initializeChat();

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            eventSourceRef.current?.close();
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        if (chatHistory.length > 0 && userId) {
            saveChatToDatabase();
        }
    }, [chatHistory]);

    const saveChatToDatabase = async () => {
        try {
            console.log('Chat state synced');
        } catch (error) {
            console.error('Failed to save to database:', error);
        }
    };

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
            console.log('📱 App came to foreground, reloading history from SQLite...');
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

        const es = new EventSource(`${API_BASE_URL}/chat-session/${FLOW_SLUG}?token=${userToken}`);
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
                    console.log('🏁 Flow completed');
                    setIsFlowComplete(true);
                    setIsLoading(false);

                    if (data.flowType == "ONBOARDING") {
                        completeOnboarding();
                    }
                    es.close();
                    Alert.alert('Complete', 'Chat session finished!');
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
                };

                // Check if message already exists in database
                const exists = await chatDB.messageExists(userId!, FLOW_SLUG, aiMessage.id);

                if (exists) {
                    console.log('Duplicate question from SSE');
                    setIsLoading(false);
                    return;
                }

                // Save to SQLite
                await chatDB.saveAiMessage(userId!, FLOW_SLUG, aiMessage);
                console.log('New question via SSE:', data.id);

                // Update UI
                setChatHistory((prev) => [...prev, aiMessage]);
                setAnimatingMessageId(aiMessage.id);
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

        // Get last AI message
        const lastAi = await chatDB.getLastAiMessage(userId, FLOW_SLUG);
        if (!lastAi) {
            console.error('No AI message found to respond to');
            return;
        }

        // Create user message
        const userMessage: IDBUserMessage = {
            type: 'user',
            text: option.label,
            timestamp: Date.now(),
        };

        // Save to SQLite
        await chatDB.saveUserMessage(userId, FLOW_SLUG, userMessage);

        // Update UI - remove options from last AI message
        setChatHistory((prev) =>
            prev.map((msg) =>
                msg.type === 'ai' && msg.id === lastAi.id ? { ...msg, options: [] } : msg
            ).concat(userMessage)
        );

        setIsLoading(true);

        try {
            await axios.post(
                `${API_BASE_URL}/chat-flow/answer`,
                {
                    flowInstanceId: lastAi.flowInstanceId,
                    nodeId: lastAi.id,
                    selectedKeys: [option.score],
                },
                {
                    headers: { Authorization: `Bearer ${userToken}` },
                }
            );
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

        // Validate that this is actually a text input question
        if (!isTextInputMessage(lastAi)) {
            console.error('Last message is not a text input question');
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
            const response = await axios.post(
                `${API_BASE_URL}/chat-flow/answer`,
                {
                    userId: userId,
                    flowInstanceId: lastAi.flowInstanceId,
                    nodeId: lastAi.id,
                    freeText: textToSend,
                },
                {
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            console.log('Text answer sent successfully:', textToSend);
            console.log('Response:', response.data);

        } catch (error: any) {
            console.error('Send error:', error);

            // Log detailed error info
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
                    const shouldAnimate = msg.type === 'ai' && msg.id === animatingMessageId;

                    if (shouldAnimate) {
                        return (
                            <AnimatedBubble
                                key={msg.id}
                                message={msg}
                                onComplete={() => setAnimatingMessageId(null)}
                                onSelect={handleSendAnswer}
                                isTextInputHelper={isTextInputMessage}
                            />
                        );
                    }

                    return (
                        <StaticBubble
                            key={msg.type === 'ai' ? msg.id : `user-${i}`}
                            message={msg}
                            isLast={isLast}
                            isAnimating={!!animatingMessageId}
                            isComplete={isFlowComplete}
                            onSelect={handleSendAnswer}
                            isTextInputHelper={isTextInputMessage}
                        />
                    );
                })}

                {isLoading && <RenderTypingIndicator />}
            </ScrollView>

            {shouldShowTextInput && (
                <View style={chatStyles.inputContainer}>
                    <TextInput
                        style={[chatStyles.textInput, globalStyles.fontRegular]}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type your answer..."
                        placeholderTextColor={colors.black}
                        editable={!isLoading}
                        onSubmitEditing={handleSendTextAnswer}
                        returnKeyType="send"
                    />
                    <TouchableOpacity
                        disabled={inputText.trim().length === 0 || isLoading}
                        style={[
                            chatStyles.sendButton,
                            (inputText.trim().length === 0 || isLoading) && { backgroundColor: 'grey' }
                        ]}
                        onPress={handleSendTextAnswer}
                    >
                        <MaterialDesignIcons
                            name='send-outline'
                            size={20}
                            color={colors.white}
                            style={{ transform: [{ rotate: '-35deg' }] }}
                        />
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

// StaticBubble Component
const StaticBubble = ({ message, isLast, isAnimating, isComplete, onSelect, isTextInputHelper }: any) => {
    const isTextInput = isTextInputHelper(message);

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
            {showOptions && (
                <View style={chatStyles.optionsInMessageContainer}>
                    {message.options.map((opt: IOption) => (
                        <TouchableOpacity
                            key={opt.id}
                            style={chatStyles.optionButton}
                            onPress={() => onSelect(opt)}
                        >
                            <Text style={chatStyles.optionButtonText}>{opt.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
};

// AnimatedBubble Component
const AnimatedBubble = ({ message, onComplete, onSelect, isTextInputHelper }: any) => {
    const [displayed, setDisplayed] = useState('');
    const [showOptions, setShowOptions] = useState(false);
    const isTextInput = isTextInputHelper(message);

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
            {showOptions && !isTextInput && message.options.length > 0 && (
                <View style={chatStyles.optionsInMessageContainer}>
                    {message.options.map((opt: IOption) => (
                        <TouchableOpacity
                            key={opt.id}
                            style={chatStyles.optionButton}
                            onPress={() => onSelect(opt)}
                        >
                            <Text style={chatStyles.optionButtonText}>{opt.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
};