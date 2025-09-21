import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { styles } from '../public/styles/chatWithVivaAiStyles';
import { IMessage, IVivaAIData } from '../types/vivaAi.types';
import { vivaAIData } from '../data/vivaAIData';
import { SafeAreaView } from 'react-native-safe-area-context';

const RenderTypingIndicator = () => {
    return (
        <View style={[styles.messageContainer, styles.aiMessage]}>
            <Text style={[styles.messageText, globalStyles.fontRegular]}>AI is thinking...</Text>
        </View>
    );
};

const RenderMessage = ({ item }: { item: IMessage }) => (
    <View style={[styles.messageContainer, item.sender === 'user' ? styles.userMessage : styles.aiMessage]}>
        <Text style={[styles.messageText, globalStyles.fontRegular]}>{item.text}</Text>
    </View>
);

const ChatWithVivaAI: React.FC = () => {
    const flatListRef = useRef<FlatList>(null);
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [inputText, setInputText] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);


    useEffect(() => {
        if (flatListRef.current) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages, loading]);

    const handleSendMessage = async () => {
        if (inputText.trim() === '') return;

        const newUserMessage: IMessage = {
            id: Date.now().toString(),
            text: inputText,
            sender: 'user'
        };
        setMessages(prevMessages => [...prevMessages, newUserMessage]);
        setInputText('');
        setLoading(true);

        const aiResponse = await getAIResponse(inputText);
        const newAIMessage: IMessage = {
            id: Date.now().toString() + 'ai',
            text: aiResponse,
            sender: 'ai'
        };
        setMessages(prevMessages => [...prevMessages, newAIMessage]);
        setLoading(false);
    };

    const getAIResponse = async (userMessage: string): Promise<string> => {
        return new Promise(resolve => {
            const resp = vivaAIData.find((item: IVivaAIData) =>
                item.userQuery.toLowerCase() == userMessage.toLowerCase()
            )
            setTimeout(() => {
                resolve(resp?.aiResponse || "Sorry! I can't help you with that!");
            }, 2000);
        });
    };

    return (
        <SafeAreaView
            style={{
                flex: 1
            }}
        >
            <View
                style={globalStyles.chatContainer}
            >
                {
                    messages.length ? (
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            renderItem={RenderMessage}
                            keyExtractor={item => item.id}
                            showsVerticalScrollIndicator={false}
                            ListFooterComponent={() => (
                                loading ? <RenderTypingIndicator /> : null
                            )}
                        />
                    ) : (
                        <View
                            style={{
                                flex: 1,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Text
                                style={[{
                                    fontSize: 24
                                }, globalStyles.fontRegular]}
                            >
                                How can I help?
                            </Text>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    gap: 10,
                                    padding: 30,
                                    justifyContent: 'center',
                                    flexWrap: 'wrap',
                                }}
                            >
                                {
                                    vivaAIData.map((item: IVivaAIData, index: number) => (
                                        <TouchableOpacity
                                            key={item.id.toString()}
                                            style={{
                                                borderWidth: 1,
                                                borderColor: colors.purple,
                                                paddingVertical: 4,
                                                paddingHorizontal: 10,
                                                borderRadius: 20
                                            }}
                                            onPress={() => {
                                                setInputText(item.userQuery);
                                            }}
                                        >
                                            <Text
                                                style={[{
                                                    fontSize: 14,
                                                }, globalStyles.fontRegular]}
                                            >
                                                {item.userQuery}
                                            </Text>
                                        </TouchableOpacity>
                                    ))
                                }
                            </View>
                        </View>
                    )
                }
            </View>

            <View style={[styles.inputContainer]}>
                <TextInput
                    style={[styles.textInput, globalStyles.fontRegular]}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Type your message..."
                    placeholderTextColor={colors.black}
                />
                <TouchableOpacity
                    disabled={inputText.length == 0}
                    style={styles.sendButton}
                    onPress={handleSendMessage}
                >
                    <MaterialDesignIcons
                        name='send-outline'
                        size={20}
                        color={colors.white}
                        style={{
                            transform: [{ rotate: '-35deg' }]
                        }}
                    />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default ChatWithVivaAI;
