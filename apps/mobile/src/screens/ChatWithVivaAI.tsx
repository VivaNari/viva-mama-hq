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
} from 'react-native';
import EventSource from 'react-native-sse';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { chatDB, AiMessage, UserMessage, ChatMessage } from '../db/sqlite';
import { styles as chatStyles } from '../public/styles/chatWithVivaAiStyles';
import { IOption } from "../types/vivaAi.types";
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { globalStyles } from '../public/styles';
import { colors } from '../public/assets/colors';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';


const FLOW_SLUG = 'weekly-check-in-v1';
const API_BASE_URL = 'http://192.168.1.22:4000/api/v1';
const TYPING_SPEED_MS = 30;

const RenderTypingIndicator: React.FC = () => (
    <View style={[chatStyles.messageContainer, chatStyles.aiMessage]}>
        <Text style={[chatStyles.messageText, globalStyles.fontRegular]}>AI is thinking...</Text>
    </View>
);

export default function ChatWithVivaAi() {
    const { userToken, userId } = useAuth();

    const [inputText, setInputText] = useState('');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [animatingMessageId, setAnimatingMessageId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFlowComplete, setIsFlowComplete] = useState(false);

    const eventSourceRef = useRef<EventSource | null>(null);
    const scrollViewRef = useRef<ScrollView | null>(null);
    const appState = useRef<AppStateStatus>(AppState.currentState);

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
            // Note: Individual messages are already saved when received/sent
            // This is just a safety net for any edge cases
            console.log('💾 Chat state synced');
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
            setChatHistory(messages);
            console.log('📚 Loaded history from SQLite:', messages.length, 'messages');
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
        console.log("${API_BASE_URL}/chat-session/${FLOW_SLUG}?token=${userToken} is", `${API_BASE_URL}/chat-session/${FLOW_SLUG}?token=${userToken}`)

        if (chatHistory.length === 0) {
            setIsLoading(true);
        }

        es.addEventListener('open', () => {
            console.log('🔌 SSE Connected');
        });

        es.addEventListener('message', async (event) => {
            try {
                const data = JSON.parse(event.data!);

                if (data.type === 'end_flow') {
                    console.log('🏁 Flow completed');
                    setIsFlowComplete(true);
                    setIsLoading(false);
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

                const aiMessage: AiMessage = {
                    type: 'ai',
                    id: data.id,
                    flowInstanceId: data.flowInstanceId,
                    text: data.text,
                    educationalMessage: data.educationalMessage,
                    whyThisMatters: data.whyThisMatters,
                    options: data.options,
                    timestamp: Date.now(),
                };

                // Check if message already exists in database
                const exists = await chatDB.messageExists(userId!, FLOW_SLUG, aiMessage.id);

                if (exists) {
                    console.log('⚠️ Duplicate question from SSE');
                    setIsLoading(false);
                    return;
                }

                // Save to SQLite
                await chatDB.saveAiMessage(userId!, FLOW_SLUG, aiMessage);
                console.log('📡 New question via SSE:', data.id);

                // Update UI
                setChatHistory((prev) => [...prev, aiMessage]);
                setAnimatingMessageId(aiMessage.id);
                setIsLoading(false);
            } catch (error) {
                console.error('Parse error:', error);
            }
        });

        es.addEventListener('error', (e: any) => {
            console.error('❌ SSE error:', e);
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
        const userMessage: UserMessage = {
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
                    selectedKeys: [option.id],
                },
                {
                    headers: { Authorization: `Bearer ${userToken}` },
                }
            );
            console.log('✅ Answer sent');
        } catch (error: any) {
            console.error('❌ Send error:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to send answer',
                position: 'bottom'
            });
            setIsLoading(false);
        }
    };

    const handleRestart = async () => {
        if (!userId) return;

        Alert.alert(
            'Restart Chat',
            'This will delete all chat history. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Restart',
                    style: 'destructive',
                    onPress: async () => {
                        eventSourceRef.current?.close();
                        await chatDB.clearChatHistory(userId, FLOW_SLUG);
                        setChatHistory([]);
                        setAnimatingMessageId(null);
                        setIsLoading(false);
                        setIsFlowComplete(false);
                        setTimeout(connectToServer, 100);
                    },
                },
            ]
        );
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
                        />
                    );
                })}

                {isLoading && <RenderTypingIndicator />}
            </ScrollView>
            <View style={chatStyles.inputContainer}>
                <TextInput
                    style={[chatStyles.textInput, globalStyles.fontRegular]}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Type your message..."
                    placeholderTextColor={colors.black}
                    editable={!isLoading}
                />
                <TouchableOpacity
                    disabled={inputText.length === 0 || isLoading}
                    style={[chatStyles.sendButton, (inputText.length === 0 || isLoading) && { backgroundColor: 'grey' }]}
                >
                    <MaterialDesignIcons name='send-outline' size={20} color={colors.white} style={{ transform: [{ rotate: '-35deg' }] }} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

// StaticBubble Component
const StaticBubble = ({ message, isLast, isAnimating, isComplete, onSelect }: any) => {
    const showOptions =
        message.type === 'ai' &&
        isLast &&
        !isAnimating &&
        !isComplete &&
        message.options.length > 0;

    return (
        <View>
            <View style={[styles.bubble, message.type === 'ai' ? chatStyles.aiMessage : chatStyles.userMessage]}>
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
const AnimatedBubble = ({ message, onComplete, onSelect }: any) => {
    const [displayed, setDisplayed] = useState('');
    const [showOptions, setShowOptions] = useState(false);

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
            <View style={[styles.bubble, chatStyles.aiMessage]}>
                <Text style={chatStyles.messageText}>{displayed}</Text>
            </View>
            {showOptions && message.options.length > 0 && (
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

const styles = StyleSheet.create({
    bubble: { padding: 12, borderRadius: 20, maxWidth: '80%', marginBottom: 10 },
    loader: { alignSelf: 'flex-start', marginLeft: 15 },
});