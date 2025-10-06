import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { vivaAIData } from '../data/vivaAIData';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { styles as chatStyles } from '../public/styles/chatWithVivaAiStyles';
import { IFollowUpSet, IMessage, IOption, IVivaAIData } from '../types/vivaAi.types';
import MessageWithLinks from '../components/MessageWithLinks';

const RenderTypingIndicator = () => {
    return (
        <View style={[chatStyles.messageContainer, chatStyles.aiMessage]}>
            <Text style={[chatStyles.messageText, globalStyles.fontRegular]}>AI is thinking...</Text>
        </View>
    );
};

const RenderMessage = ({ item, onOptionSelect, isLatestMessage }: { item: IMessage, onOptionSelect: (option: IOption) => void, isLatestMessage: boolean }) => {
    return (
        <View style={[chatStyles.messageContainer, item.sender === 'user' ? chatStyles.userMessage : chatStyles.aiMessage]}>
            {/* --- THIS IS THE CHANGE --- */}
            {/* Replace the old <Text> component with our new <MessageWithLinks> component */}
            <MessageWithLinks text={item.text} />

            {/* The rest of the component for rendering options remains the same */}
            {item.sender === 'ai' && item.options && item.options.length > 0 && (
                <View style={chatStyles.optionsInMessageContainer}>
                    {item.options.map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            style={chatStyles.optionButton}
                            disabled={!isLatestMessage}
                            onPress={() => onOptionSelect(option)}
                        >
                            <Text style={chatStyles.optionButtonText}>{option.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
};



const ChatWithVivaAI: React.FC = () => {
    const flatListRef = useRef<FlatList>(null);

    const [messages, setMessages] = useState<IMessage[]>([]);
    const [inputText, setInputText] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [currentFollowUpSet, setCurrentFollowUpSet] = useState<IFollowUpSet | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
    const [score, setScore] = useState<number>(0);
    const [isAnsweringFollowUps, setIsAnsweringFollowUps] = useState<boolean>(false);
    const [awaitingFollowUpConfirmation, setAwaitingFollowUpConfirmation] = useState<boolean>(false);

    // Effect to auto-scroll
    useEffect(() => {
        if (flatListRef.current) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages, loading]);


    const getAIResponse = async (userMessage: string): Promise<IVivaAIData | null> => {
        return new Promise(resolve => {
            const resp = vivaAIData.find(
                (item: IVivaAIData) => item.userQuery.toLowerCase() === userMessage.toLowerCase()
            );
            setTimeout(() => {
                resolve(resp || null);
            }, 1500);
        });
    };

    const beginFollowUpQuestions = (followUpSet: IFollowUpSet) => {
        setIsAnsweringFollowUps(true);
        setCurrentQuestionIndex(0);
        setScore(0);

        setTimeout(() => {
            const noteMessage: IMessage = { id: Date.now().toString() + 'note', text: followUpSet.note, sender: 'ai' };
            const firstQuestion: IMessage = {
                id: Date.now().toString() + 'q0',
                text: followUpSet.followUps[0].question,
                sender: 'ai',
                options: followUpSet.followUps[0].options,
            };
            setMessages(prev => [...prev, noteMessage, firstQuestion]);
        }, 500);
    };

    const handleSendMessage = async () => {
        if (inputText.trim() === '') return;

        const userMessageText = inputText.trim();
        const newUserMessage: IMessage = { id: Date.now().toString(), text: userMessageText, sender: 'user' };
        setMessages(prevMessages => [...prevMessages, newUserMessage]);
        setInputText('');

        if (awaitingFollowUpConfirmation && currentFollowUpSet) {
            const userConfirmation = userMessageText.toLowerCase();
            setAwaitingFollowUpConfirmation(false);

            if (userConfirmation === 'yes' || userConfirmation === 'y') {
                beginFollowUpQuestions(currentFollowUpSet);
            } else {
                const politeSignOff: IMessage = { id: Date.now().toString() + 'ai', text: "Okay, no problem. If you change your mind or have other questions, just let me know.", sender: 'ai' };
                setMessages(prev => [...prev, politeSignOff]);
                setCurrentFollowUpSet(null);
            }
            return;
        }

        setLoading(true);
        const aiResponseObject = await getAIResponse(userMessageText);

        if (aiResponseObject) {
            const newAIMessage: IMessage = { id: Date.now().toString() + 'ai', text: aiResponseObject.aiResponse, sender: 'ai' };
            setMessages(prevMessages => [...prevMessages, newAIMessage]);

            if (aiResponseObject.followUpSet) {
                setAwaitingFollowUpConfirmation(true);
                setCurrentFollowUpSet(aiResponseObject.followUpSet);
            }
        } else {
            const fallbackMessage: IMessage = { id: Date.now().toString() + 'ai', text: "Sorry! I can't help you with that!", sender: 'ai' };
            setMessages(prevMessages => [...prevMessages, fallbackMessage]);
        }
        setLoading(false);
    };

    const handleOptionSelect = (option: IOption) => {
        if (!currentFollowUpSet) return;

        setMessages(prev => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage.sender === 'ai' && lastMessage.options) {
                const updatedMessage = { ...lastMessage, options: [] };
                return [...prev.slice(0, -1), updatedMessage];
            }
            return prev;
        });

        const userAnswerMessage: IMessage = { id: option.id.toString() + Date.now(), text: option.label, sender: 'user' };
        setMessages(prev => [...prev, userAnswerMessage]);

        const newScore = score + option.value;
        setScore(newScore);

        const nextQuestionIndex = currentQuestionIndex + 1;
        if (nextQuestionIndex < currentFollowUpSet.followUps.length) {
            setCurrentQuestionIndex(nextQuestionIndex);
            const nextQuestionMessage: IMessage = {
                id: Date.now().toString() + 'q' + nextQuestionIndex,
                text: currentFollowUpSet.followUps[nextQuestionIndex].question,
                sender: 'ai',
                options: currentFollowUpSet.followUps[nextQuestionIndex].options,
            };
            setTimeout(() => setMessages(prev => [...prev, nextQuestionMessage]), 500);
        } else {
            const finalScoreMessage: IMessage = { id: Date.now().toString() + 'score', text: `Your total score is ${newScore}, which is above the cutoff for concern. \n\nA score of 3 or more suggests you may be going through symptoms of postpartum depression or emotional distress. This doesn't mean a diagnosis, but it does mean it's a good time to talk to someone who can help.\n\nYou're carrying a lot - emotionally and physically and you don't have to do it alone. There are safe, supportive options for you. \n\nWould you like me to schedule a consultation with one of our experts?`, sender: 'ai' };
            setTimeout(() => setMessages(prev => [...prev, finalScoreMessage]), 500);

            setIsAnsweringFollowUps(false);
            setCurrentFollowUpSet(null);
            setCurrentQuestionIndex(0);
        }
    };


    const InitialView = () => (
        <View style={chatStyles.initialViewContainer}>
            <Text style={chatStyles.initialHelpText}>How can I help?</Text>
            <View style={chatStyles.initialPromptsContainer}>
                {vivaAIData.map((item: IVivaAIData) => (
                    <TouchableOpacity
                        key={item.id.toString()}
                        style={chatStyles.promptButton}
                        onPress={() => { setInputText(item.userQuery); }}
                    >
                        <Text style={chatStyles.promptText}>{item.userQuery}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1 }} >
            <View style={globalStyles.chatContainer}>
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={({ item, index }) => (
                        <RenderMessage
                            item={item}
                            onOptionSelect={handleOptionSelect}
                            isLatestMessage={index === messages.length - 1}
                        />
                    )}
                    keyExtractor={item => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 10, justifyContent: messages.length === 0 ? 'center' : 'flex-start' }}
                    ListEmptyComponent={InitialView}
                    ListFooterComponent={() => (loading ? <RenderTypingIndicator /> : null)}
                />
            </View>

            <View style={[chatStyles.inputContainer]}>
                <TextInput
                    style={[chatStyles.textInput, globalStyles.fontRegular]}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Type your message..."
                    placeholderTextColor={colors.black}
                    editable={!isAnsweringFollowUps}
                />
                <TouchableOpacity
                    disabled={inputText.length === 0 || isAnsweringFollowUps}
                    style={[chatStyles.sendButton, (inputText.length === 0 || isAnsweringFollowUps) && { backgroundColor: 'grey' }]}
                    onPress={handleSendMessage}
                >
                    <MaterialDesignIcons name='send-outline' size={20} color={colors.white} style={{ transform: [{ rotate: '-35deg' }] }} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default ChatWithVivaAI;