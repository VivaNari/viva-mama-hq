import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Text, TouchableOpacity, View } from 'react-native';

import { globalStyles } from '../../public/styles/globalStyles';
import {
    IChatMessage,
    IOption,
} from '../../types/chat.types';
import {
    isAiMessage,
    isChatbotMessage,
    isDeliveryDateNode,
    isMultiSelectMessage,
    isStillBirthNode,
    isTextInputMessage,
} from '../../utils/messageHelpers';
import { bubbleStyles } from './styles';
import { ConnectExpertButton } from './ConnectExpertButton';
import { MarkdownText } from './MarkdownText';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import { colors } from '../../public/assets/colors';

interface StaticBubbleProps {
    isFirst: boolean;
    message: IChatMessage;
    isLast: boolean;
    isAnimating: boolean;
    isFlowComplete: boolean;
    onOptionSelect: (option: IOption) => void;
    onMultiOptionToggle: (option: IOption, allOptions: IOption[]) => void;
    selectedMultiOptions: Set<string>;
    onDatePickerOpen: () => void;
    onLmpDatePickerOpen: () => void;
    onNotPregnantSelect: () => void;
    onConsultExpert: () => void;
    onChatWithViva: () => void;
    onBookmarkPress: (id: string) => void;
    isBookmarked?: boolean;
    /**
     * Flag this AI reply. Optional so the control is simply absent wherever a bubble is
     * rendered outside the chatbot — the guided flow reuses this component, and its
     * messages are scripted rather than generated.
     */
    onFlagPress?: (id: string) => void;
    onConnectExpert?: (expertId: string) => void;
}

export const StaticBubble: React.FC<StaticBubbleProps> = ({
    isFirst,
    message,
    isLast,
    isAnimating,
    isFlowComplete,
    onOptionSelect,
    onMultiOptionToggle,
    selectedMultiOptions,
    onDatePickerOpen,
    onLmpDatePickerOpen,
    // onNotPregnantSelect,
    onConsultExpert,
    onChatWithViva,
    onBookmarkPress,
    isBookmarked,
    onFlagPress,
    onConnectExpert,
}) => {
    const { t } = useTranslation();
    const isAi = isAiMessage(message);
    const isChatbot = isChatbotMessage(message);
    const isTextInput = isAi && isTextInputMessage(message);
    const isMultiSelect = isAi && isMultiSelectMessage(message);
    const isDeliveryDate = isAi && isDeliveryDateNode(message);
    const isStillBirth = isAi && isStillBirthNode(message);

    const showOptions =
        isAi &&
        isLast &&
        !isAnimating &&
        !isFlowComplete &&
        !isTextInput &&
        message.options.length > 0;

    const renderDeliveryDateOptions = () => (
        <View style={bubbleStyles.optionsContainer}>
            <TouchableOpacity
                style={[bubbleStyles.optionButton, bubbleStyles.specialOptionButton]}
                onPress={onDatePickerOpen}
                accessibilityRole="button"
                accessibilityLabel="Select delivery date"
            >
                <Text style={[bubbleStyles.optionButtonText, bubbleStyles.specialOptionText, globalStyles.fontSemiBold]}>
                    {t('chat.selectDeliveryDate')}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={bubbleStyles.optionButton}
                onPress={onLmpDatePickerOpen}
                accessibilityRole="button"
                accessibilityLabel="Enter last menstrual period date"
            >
                <Text style={[bubbleStyles.optionButtonText, globalStyles.fontSemiBold]}>
                    {t('chat.enterLmpDate')}
                </Text>
            </TouchableOpacity>

            {/* <TouchableOpacity
                style={bubbleStyles.optionButton}
                onPress={onNotPregnantSelect}
                accessibilityRole="button"
                accessibilityLabel="I'm not pregnant yet"
            >
                <Text style={[bubbleStyles.optionButtonText, globalStyles.fontSemiBold]}>
                    {t('chat.notPregnantYet')}
                </Text>
            </TouchableOpacity> */}
        </View>
    );

    const renderStillBirthOptions = () => (
        <View style={bubbleStyles.optionsContainer}>
            <TouchableOpacity
                style={[bubbleStyles.optionButton, bubbleStyles.specialOptionButton]}
                onPress={onConsultExpert}
                accessibilityRole="button"
                accessibilityLabel="Consult with an expert"
            >
                <Text style={[bubbleStyles.optionButtonText, bubbleStyles.specialOptionText, globalStyles.fontSemiBold]}>
                    {t('chat.consultExpert')}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={bubbleStyles.optionButton}
                onPress={onChatWithViva}
                accessibilityRole="button"
                accessibilityLabel="Chat with Viva AI"
            >
                <Text style={[bubbleStyles.optionButtonText, globalStyles.fontSemiBold]}>
                    {t('chat.chatWithViva')}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderOptions = () => {
        if (!isAi) return null;

        return (
            <View style={bubbleStyles.optionsContainer}>
                {message.options.map((option) => {
                    const isSelected = selectedMultiOptions.has(option.id);

                    return (
                        <TouchableOpacity
                            key={option.id}
                            style={[
                                bubbleStyles.optionButton,
                                isMultiSelect && isSelected && bubbleStyles.optionButtonSelected,
                            ]}
                            onPress={() =>
                                isMultiSelect
                                    ? onMultiOptionToggle(option, message.options)
                                    : onOptionSelect(option)
                            }
                            accessibilityRole="button"
                            accessibilityLabel={option.label}
                            accessibilityState={{ selected: isSelected }}
                        >
                            <Text
                                style={[
                                    bubbleStyles.optionButtonText,
                                    globalStyles.fontSemiBold,
                                    isMultiSelect && isSelected && bubbleStyles.optionButtonTextSelected,
                                ]}
                            >
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    return (
        <View style={[bubbleStyles.container, { justifyContent: isAi ? 'flex-start' : 'flex-end' }]}>
            {isAi ? <View
                style={{
                    alignItems: 'flex-start',
                    display: isAi ? "flex" : "none",
                    marginRight: 10
                }}
            >
                <Image
                    style={{ width: 30, height: 30, borderRadius: 20, marginBottom: 10, backgroundColor: "#E3E2F4" }}
                    source={isAi ? require("../../public/assets/images/avatar_mom.png") : require("../../public/assets/images/avatar_mom.png")}
                />
            </View> : <></>}
            <View style={{
                flexShrink: 1,
                maxWidth: '85%',
                alignSelf: isAi ? 'flex-start' : 'flex-end',
            }}>
                <View
                    style={[
                        bubbleStyles.bubble,
                        isAi ? bubbleStyles.aiBubble : bubbleStyles.userBubble,
                        { alignSelf: isAi ? 'flex-start' : 'flex-end' },
                    ]}
                    accessibilityRole="text"
                >
                    {isAi ? (
                        <MarkdownText
                            text={message.text}
                            baseStyle={[
                                bubbleStyles.messageText,
                                globalStyles.fontSemiBold,
                                bubbleStyles.aiText,
                            ]}
                        />
                    ) : (
                        <Text
                            style={[
                                bubbleStyles.messageText,
                                globalStyles.fontSemiBold,
                                bubbleStyles.userText,
                            ]}
                        >
                            {message.text}
                        </Text>
                    )}
                </View>
                {isChatbot && !isFirst && isAi ? <View
                    style={{
                        paddingVertical: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => onBookmarkPress(message.id)}
                        activeOpacity={0.2}
                    >
                        {
                            isBookmarked ? (
                                <MaterialDesignIcons
                                    name='bookmark'
                                    size={20}
                                    color={colors.darkPurple}
                                />
                            ) : (
                                <MaterialDesignIcons
                                    name='bookmark-outline'
                                    size={20}
                                    color={colors.darkPurple}
                                />
                            )
                        }
                    </TouchableOpacity>

                    {/* Play's AI-Generated Content policy requires flagging offensive
                        model output to be reachable without leaving the app. Sits beside
                        the bookmark because that is where a reader's thumb already goes
                        after reading a reply. */}
                    {onFlagPress ? (
                        <TouchableOpacity
                            onPress={() => onFlagPress(message.id)}
                            activeOpacity={0.2}
                            hitSlop={8}
                            accessibilityLabel={t('chat.reportAccessibility')}
                        >
                            <MaterialDesignIcons
                                name='flag-outline'
                                size={20}
                                color={colors.darkGray}
                            />
                        </TouchableOpacity>
                    ) : null}
                </View> : <></>}

                {isAi && (
                    <ConnectExpertButton
                        suggestedExperts={message.suggestedExperts}
                        onConnectExpert={onConnectExpert}
                    />
                )}

                {isDeliveryDate && isLast && !isAnimating && !isFlowComplete && renderDeliveryDateOptions()}

                {isStillBirth && isLast && !isAnimating && renderStillBirthOptions()}

                {showOptions && !isDeliveryDate && !isStillBirth && renderOptions()}
            </View>
        </View>
    );
};
