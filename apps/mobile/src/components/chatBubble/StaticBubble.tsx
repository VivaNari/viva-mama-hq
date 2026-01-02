import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';

import { globalStyles } from '../../public/styles/globalStyles';
import {
    IChatMessage,
    IOption,
} from '../../types/chat.types';
import {
    isAiMessage,
    isTextInputMessage,
    isMultiSelectMessage,
    isDeliveryDateNode,
} from '../../utils/messageHelpers';
import { bubbleStyles } from './styles';

interface StaticBubbleProps {
    message: IChatMessage;
    isLast: boolean;
    isAnimating: boolean;
    isFlowComplete: boolean;
    onOptionSelect: (option: IOption) => void;
    onMultiOptionToggle: (option: IOption, allOptions: IOption[]) => void;
    selectedMultiOptions: Set<string>;
    onDatePickerOpen: () => void;
    onNotPregnantSelect: () => void;
}

export const StaticBubble: React.FC<StaticBubbleProps> = ({
    message,
    isLast,
    isAnimating,
    isFlowComplete,
    onOptionSelect,
    onMultiOptionToggle,
    selectedMultiOptions,
    onDatePickerOpen,
    onNotPregnantSelect,
}) => {
    const isAi = isAiMessage(message);
    const isTextInput = isAi && isTextInputMessage(message);
    const isMultiSelect = isAi && isMultiSelectMessage(message);
    const isDeliveryDate = isAi && isDeliveryDateNode(message);

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
                    Select Delivery Date
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={bubbleStyles.optionButton}
                onPress={onNotPregnantSelect}
                accessibilityRole="button"
                accessibilityLabel="I'm not pregnant yet"
            >
                <Text style={[bubbleStyles.optionButtonText, globalStyles.fontSemiBold]}>
                    I'm Not Pregnant Yet
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
                    <Text
                        style={[
                            bubbleStyles.messageText,
                            globalStyles.fontSemiBold,
                            isAi ? bubbleStyles.aiText : bubbleStyles.userText,
                        ]}
                    >
                        {message.text}
                    </Text>
                </View>

                {isDeliveryDate && isLast && !isAnimating && !isFlowComplete && renderDeliveryDateOptions()}

                {showOptions && !isDeliveryDate && renderOptions()}
            </View>
        </View>
    );
};
