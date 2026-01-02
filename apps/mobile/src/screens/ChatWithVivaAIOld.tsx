import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import { phqdata } from '../data/phqData';
import { vivaAIData } from '../data/vivaAIData';
import MessageWithLinks from '../components/MessageWithLinks';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { styles as chatStyles } from '../public/styles/chatWithVivaAiStyles';
import { useNavigation } from '@react-navigation/native';
import { useCounterContext } from '../context/CounterContext';

interface IOption {
    id: string | number;
    label: string;
    value: string | number;
    isSelected?: boolean;
}

interface IMessage {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    options?: IOption[];
}

interface IFollowUp {
    question: string;
    options: IOption[];
}

interface IFollowUpSet {
    note: string;
    followUps: IFollowUp[];
}

interface IVivaAIData {
    id: number;
    userQuery: string;
    aiResponse: string;
    followUpSet?: IFollowUpSet;
}


const RenderTypingIndicator: React.FC = () => (
    <View style={[chatStyles.messageContainer, chatStyles.aiMessage]}>
        <Text style={[chatStyles.messageText, globalStyles.fontRegular]}>AI is thinking...</Text>
    </View>
);

interface RenderMessageProps {
    item: IMessage;
    onOptionSelect: (option: IOption) => void;
    onOnboardingOptionSelect: (option: IOption) => void;
    isLatestMessage: boolean;
}

const RenderMessage: React.FC<RenderMessageProps> = ({ item, onOnboardingOptionSelect, onOptionSelect, isLatestMessage }) => (
    <View style={[chatStyles.messageContainer, item.sender === 'user' ? chatStyles.userMessage : chatStyles.aiMessage]}>
        <MessageWithLinks text={item.text} />
        {item.sender === 'ai' && item.options && item.options.length > 0 && (
            <View style={chatStyles.optionsInMessageContainer}>
                {item.options.map((option) => (
                    <TouchableOpacity
                        key={option.id}
                        style={[chatStyles.optionButton, option.isSelected && { backgroundColor: colors.darkPurple }]}
                        disabled={!isLatestMessage}
                        onPress={() => {
                            if (item.id.toString().startsWith('onboarding')) {
                                onOnboardingOptionSelect(option);
                            } else {
                                onOptionSelect(option);
                            }
                        }}
                    >
                        <Text style={[chatStyles.optionButtonText, option.isSelected && { color: colors.white }]}>{option.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        )}
    </View>
);


const ChatWithVivaAI: React.FC = () => {
    const { isOnboarded, completeOnboarding } = useAuth();
    const flatListRef = useRef<FlatList<IMessage>>(null);
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [subStepIndex, setSubStepIndex] = useState(0);
    const [answers, setAnswers] = useState<{ question: string; answer: any }[]>([]);
    const [multiChoiceAnswers, setMultiChoiceAnswers] = useState<IOption[]>([]);
    const [currentFollowUpSet, setCurrentFollowUpSet] = useState<IFollowUpSet | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [isAnsweringFollowUps, setIsAnsweringFollowUps] = useState(false);
    const [awaitingFollowUpConfirmation, setAwaitingFollowUpConfirmation] = useState(false);

    const navigation = useNavigation()
    const { reset } = useCounterContext();

    useEffect(() => {
        reset();
    }, [])

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

    useEffect(() => {
        if (flatListRef.current) {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages, loading]);

    useEffect(() => {
        if (!isOnboarded) {
            const welcomeMessage: IMessage = { id: 'onboarding_welcome', sender: 'ai', text: "Welcome to Viva Mama. I'm here to help you through your postpartum journey. Let's start with a few questions to set up your profile." };
            setMessages([welcomeMessage]);
            askNextOnboardingQuestion(0, 0);
        }
    }, [isOnboarded]);

    useEffect(() => {
        const currentStepData = phqdata[stepIndex];
        if (!isOnboarded && currentStepData) {
            const questionData = currentStepData.phq[subStepIndex];
            if (questionData?.isMultichoice) {
                setMessages(prev => prev.map((msg, index) => {
                    if (index === prev.length - 1 && msg.sender === 'ai' && msg.options) {
                        return { ...msg, options: msg.options.map(opt => ({ ...opt, isSelected: multiChoiceAnswers.some(a => a.id === opt.id) })) };
                    }
                    return msg;
                }));
            }
        }
    }, [multiChoiceAnswers, stepIndex, subStepIndex, isOnboarded]);


    const askNextOnboardingQuestion = (currentStep: number, currentSubStep: number, savedAnswers: { question: string; answer: any }[] = answers) => {
        if (currentStep >= phqdata.length) {
            setTimeout(() => {
                setMessages(prev => [...prev, { id: 'onboarding_complete', sender: 'ai', text: "Thank you for sharing all of that. You've completed the setup! I'm now ready to help. How are you feeling today?" }]);
                console.log('Onboarding Data Collected:', answers);
                completeOnboarding();
                setLoading(false);
            }, 1200);
            return;
        }

        const questionData = phqdata[currentStep].phq[currentSubStep];
        if (!questionData) {
            console.error("Onboarding question not found.");
            completeOnboarding();
            return;
        }

        const askTheQuestion = () => {
            const questionMessage: IMessage = {
                id: `onboarding_s${currentStep}_q${currentSubStep}`,
                sender: 'ai',
                text: questionData.question,
                options: questionData.answerType === 'select' ? questionData.options.map((opt, i) => ({ ...opt, id: i.toString() })) : [],
            };
            if (questionData.isMultichoice) questionMessage.options?.push({ id: 'done', label: 'Done', value: 'done' });
            setMessages(prev => [...prev, questionMessage]);
            setLoading(false);
        };

        // If there's a conversational intro, say it first and then ask the question.
        if (questionData.preQuestionText) {
            setMessages(prev => [...prev, { id: `onboarding_pre_${currentStep}`, sender: 'ai', text: questionData.preQuestionText! }]);
            setTimeout(askTheQuestion, 1200);
        } else {
            askTheQuestion();
        }
    };

    const advanceToNextQuestion = (currentAnswer: any) => {
        setLoading(true);
        const currentQuestionData = phqdata[stepIndex].phq[subStepIndex]; // Get data for the question just answered
        const newAnswers = [...answers, { question: currentQuestionData.question, answer: currentAnswer }];
        setAnswers(newAnswers);

        // This inner function contains the logic to move to the next step
        const proceed = () => {
            let nextStep = stepIndex, nextSubStep = subStepIndex + 1;
            if (nextSubStep >= phqdata[stepIndex].phq.length) {
                nextStep++;
                nextSubStep = 0;
            }
            setStepIndex(nextStep);
            setSubStepIndex(nextSubStep);
            askNextOnboardingQuestion(nextStep, nextSubStep);
        };

        if (currentQuestionData.postAnswerText) {
            setMessages(prev => [...prev, { id: `onboarding_post_${stepIndex}`, sender: 'ai', text: currentQuestionData.postAnswerText! }]);
            setTimeout(proceed, 1200);
        } else {
            proceed();
        }
    };

    const handleOnboardingTextMessage = (text: string) => {
        const questionData = phqdata[stepIndex]?.phq[subStepIndex];
        if (!questionData || questionData.answerType === 'select') {
            Toast.show({ type: 'info', text1: 'Please select an option below.' });
            setLoading(false);
            return;
        }
        advanceToNextQuestion(text);
    };

    const handleOnboardingOptionSelect = (option: IOption) => {
        const questionData = phqdata[stepIndex]?.phq[subStepIndex];
        if (!questionData) return;
        const isMultiChoiceDone = option.id === 'done';

        const cleanupOptions = () => setMessages(prev => prev.map((msg, i) => i === prev.length - 1 ? { ...msg, options: [] } : msg));

        if (!questionData.isMultichoice) {
            cleanupOptions();
            setMessages(prev => [...prev, { id: Date.now().toString(), text: option.label, sender: 'user' }]);
            advanceToNextQuestion(option.label);
        } else {
            if (isMultiChoiceDone) {
                cleanupOptions();
                const selectionText = multiChoiceAnswers.length > 0 ? multiChoiceAnswers.map(a => a.label).join(', ') : 'None';
                setMessages(prev => [...prev, { id: Date.now().toString(), text: selectionText, sender: 'user' }]);
                advanceToNextQuestion(multiChoiceAnswers.map(a => a.label));
                setMultiChoiceAnswers([]);
            } else {
                setMultiChoiceAnswers(prev => {
                    const isSelected = prev.find(item => item.id === option.id);
                    return isSelected ? prev.filter(item => item.id !== option.id) : [...prev, option];
                });
            }
        }
    };

    const getAIResponse = async (userMessage: string): Promise<IVivaAIData | null> => {
        return new Promise(resolve => {
            const resp = vivaAIData.find(item => item.userQuery.toLowerCase() === userMessage.toLowerCase());
            setTimeout(() => resolve(resp || null), 1000);
        });
    };

    const beginFollowUpQuestions = (followUpSet: IFollowUpSet) => {
        setIsAnsweringFollowUps(true);
        setCurrentQuestionIndex(0);
        setScore(0);
        setTimeout(() => {
            const firstQuestion = followUpSet.followUps[0];
            setMessages(prev => [
                ...prev,
                { id: Date.now().toString() + 'note', text: followUpSet.note, sender: 'ai' },
                { id: Date.now().toString() + 'q0', text: firstQuestion.question, sender: 'ai', options: firstQuestion.options },
            ]);
        }, 500);
    };

    const handleRegularChat = async (userMessageText: string) => {
        if (awaitingFollowUpConfirmation && currentFollowUpSet) {
            const userConf = userMessageText.toLowerCase();
            setAwaitingFollowUpConfirmation(false);
            if (userConf === 'yes' || userConf === 'y') {
                beginFollowUpQuestions(currentFollowUpSet);
            } else {
                setMessages(prev => [...prev, { id: Date.now().toString(), text: "Okay, no problem.", sender: 'ai' }]);
                setCurrentFollowUpSet(null);
            }
            setLoading(false);
            return;
        }

        const aiResponse = await getAIResponse(userMessageText);
        if (aiResponse) {
            setMessages(prev => [...prev, { id: Date.now().toString(), text: aiResponse.aiResponse, sender: 'ai' }]);
            if (aiResponse.followUpSet) {
                setAwaitingFollowUpConfirmation(true);
                setCurrentFollowUpSet(aiResponse.followUpSet);
            }
        } else {
            setMessages(prev => [...prev, { id: Date.now().toString(), text: "Sorry, I can't help with that.", sender: 'ai' }]);
        }
        setLoading(false);
    };

    const handleOptionSelect = (option: IOption) => {
        if (!currentFollowUpSet) return;
        setMessages(prev => prev.map((msg, i) => i === prev.length - 1 ? { ...msg, options: [] } : msg));
        setMessages(prev => [...prev, { id: option.id.toString() + Date.now(), text: option.label, sender: 'user' }]);

        const newScore = score + (option.value as number);
        setScore(newScore);

        const nextIdx = currentQuestionIndex + 1;
        if (nextIdx < currentFollowUpSet.followUps.length) {
            setCurrentQuestionIndex(nextIdx);
            const nextQ = currentFollowUpSet.followUps[nextIdx];
            setTimeout(() => setMessages(prev => [...prev, { id: Date.now().toString() + 'q' + nextIdx, text: nextQ.question, sender: 'ai', options: nextQ.options }]), 500);
        } else {
            const scoreMsg: IMessage = { id: Date.now().toString() + 'score', text: `Your total score is ${newScore}. A score of 3 or more suggests it's a good time to talk to a professional. Would you like me to schedule a consultation?`, sender: 'ai' };
            setTimeout(() => setMessages(prev => [...prev, scoreMsg]), 500);
            setIsAnsweringFollowUps(false);
            setCurrentFollowUpSet(null);
        }
    };


    const handleSendMessage = async () => {
        const userMessageText = inputText.trim();
        if (userMessageText === '') return;
        setMessages(prev => [...prev, { id: Date.now().toString(), text: userMessageText, sender: 'user' }]);
        setInputText('');
        setLoading(true);

        if (!isOnboarded) {
            handleOnboardingTextMessage(userMessageText);
        } else {
            handleRegularChat(userMessageText);
        }
    };


    const InitialView: React.FC = () => (
        <View style={chatStyles.initialViewContainer}>
            <Text style={chatStyles.initialHelpText}>How can I help?</Text>
            <View style={chatStyles.initialPromptsContainer}>
                {vivaAIData.map((item) => (
                    <TouchableOpacity key={item.id.toString()} style={chatStyles.promptButton} onPress={() => setInputText(item.userQuery)}>
                        <Text style={chatStyles.promptText}>{item.userQuery}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <View style={globalStyles.chatContainer}>
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={({ item, index }) => (
                        <RenderMessage
                            item={item}
                            onOptionSelect={handleOptionSelect}
                            onOnboardingOptionSelect={handleOnboardingOptionSelect}
                            isLatestMessage={index === messages.length - 1}
                        />
                    )}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 10, justifyContent: messages.length === 0 ? 'center' : 'flex-start' }}
                    ListEmptyComponent={isOnboarded ? <InitialView /> : null}
                    ListFooterComponent={loading ? <RenderTypingIndicator /> : null}
                />
            </View>
            <View style={chatStyles.inputContainer}>
                <TextInput
                    style={[chatStyles.textInput, globalStyles.fontRegular]}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Type your message..."
                    placeholderTextColor={colors.black}
                    editable={!isAnsweringFollowUps && !loading}
                />
                <TouchableOpacity
                    disabled={inputText.length === 0 || isAnsweringFollowUps || loading}
                    style={[chatStyles.sendButton, (inputText.length === 0 || isAnsweringFollowUps || loading) && { backgroundColor: 'grey' }]}
                    onPress={handleSendMessage}
                >
                    <MaterialDesignIcons name='send-outline' size={20} color={colors.white} style={{ transform: [{ rotate: '-35deg' }] }} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default ChatWithVivaAI;