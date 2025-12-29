import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';

import { globalStyles } from '../../public/styles/globalStyles';
import {
    IChatMessage,
    IOption,
} from '../../types/chat.types';
import { TYPING_SPEED_MS } from '../../constants/chat';
import {
    isAiMessage,
    isTextInputMessage,
    isMultiSelectMessage,
    isDeliveryDateNode,
} from '../../utils/messageHelpers';
import { bubbleStyles } from './styles';

interface AnimatedBubbleProps {
    message: IChatMessage;
    onAnimationComplete: () => void;
    onOptionSelect: (option: IOption) => void;
    onMultiOptionToggle: (option: IOption, allOptions: IOption[]) => void;
    selectedMultiOptions: Set<string>;
    onDatePickerOpen: () => void;
    onNotPregnantSelect: () => void;
}

export const AnimatedBubble: React.FC<AnimatedBubbleProps> = ({
    message,
    onAnimationComplete,
    onOptionSelect,
    onMultiOptionToggle,
    selectedMultiOptions,
    onDatePickerOpen,
    onNotPregnantSelect,
}) => {
    const [displayedText, setDisplayedText] = useState('');
    const [showOptions, setShowOptions] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const isAi = isAiMessage(message);
    const isTextInput = isAi && isTextInputMessage(message);
    const isMultiSelect = isAi && isMultiSelectMessage(message);
    const isDeliveryDate = isAi && isDeliveryDateNode(message);

    useEffect(() => {
        if (!isAi) {
            setDisplayedText(message.text);
            onAnimationComplete();
            return;
        }

        let charIndex = 0;
        const fullText = message.text;

        intervalRef.current = setInterval(() => {
            charIndex += 1;
            setDisplayedText(fullText.substring(0, charIndex));

            if (charIndex >= fullText.length) {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                }
                setShowOptions(true);
                onAnimationComplete();
            }
        }, TYPING_SPEED_MS);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [message, isAi, onAnimationComplete]);

    const renderDeliveryDateOptions = () => (
        <View style={bubbleStyles.optionsContainer}>
            <TouchableOpacity
                style={[bubbleStyles.optionButton, bubbleStyles.specialOptionButton]}
                onPress={onDatePickerOpen}
                accessibilityRole="button"
                accessibilityLabel="Select delivery date"
            >
                <Text style={[bubbleStyles.optionButtonText, bubbleStyles.specialOptionText, globalStyles.fontRegular]}>
                    Select Delivery Date
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={bubbleStyles.optionButton}
                onPress={onNotPregnantSelect}
                accessibilityRole="button"
                accessibilityLabel="I'm not pregnant yet"
            >
                <Text style={[bubbleStyles.optionButtonText, globalStyles.fontRegular]}>
                    I'm Not Pregnant Yet
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderOptions = () => {
        if (!isAi || message.options.length === 0) return null;

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
                                    globalStyles.fontRegular,
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
        <View style={bubbleStyles.container}>
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
                    <Text
                        style={[
                            bubbleStyles.messageText,
                            globalStyles.fontRegular,
                            isAi ? bubbleStyles.aiText : bubbleStyles.userText,
                        ]}
                    >
                        {displayedText}
                    </Text>

                </View>
                {showOptions && isDeliveryDate && renderDeliveryDateOptions()}

                {showOptions && !isTextInput && !isDeliveryDate && renderOptions()}
            </View>
        </View>
    );
};