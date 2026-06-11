import React from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    Text,
    StyleSheet,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles/globalStyles';
import { InputMode } from '../types/chat.types';

interface ChatInputBarProps {
    inputMode: InputMode;
    inputText: string;
    isLoading: boolean;
    selectedOptionsCount: number;
    onInputChange: (text: string) => void;
    onSend: () => void;
    onDatePickerOpen: () => void;
    onMultiSelectSubmit: () => void;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
    inputMode,
    inputText,
    isLoading,
    selectedOptionsCount,
    onInputChange,
    onSend,
    onDatePickerOpen,
    onMultiSelectSubmit,
}) => {
    // Multi-select submit bar
    if (inputMode === 'multiSelect' && selectedOptionsCount > 0) {
        return (
            <View style={styles.container}>
                <Text style={[styles.selectionText, globalStyles.fontMedium]}>
                    {selectedOptionsCount} selected, click to submit
                </Text>

                <TouchableOpacity
                    style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
                    onPress={onMultiSelectSubmit}
                    disabled={isLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Submit selection"
                >
                    <MaterialDesignIcons
                        name="send-outline"
                        size={20}
                        color={colors.white}
                        style={styles.sendIcon}
                    />
                </TouchableOpacity>
            </View>
        );
    }

    // Don't show input for other modes
    if (inputMode === 'none' || inputMode === 'multiSelect' || inputMode === 'deliveryDate') {
        return null;
    }

    const isDateMode = inputMode === 'date';
    const isSendDisabled = inputText.trim().length === 0 || isLoading;
    const placeholder = isDateMode ? 'Select a date' : 'Type your answer';

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.inputWrapper}
                activeOpacity={isDateMode ? 0.7 : 1}
                onPress={isDateMode ? onDatePickerOpen : undefined}
            >
                <TextInput
                    style={[styles.input, globalStyles.fontSemiBold]}
                    value={inputText}
                    onChangeText={onInputChange}
                    placeholder={placeholder}
                    placeholderTextColor={colors.gray}
                    editable={!isDateMode}
                    pointerEvents={isDateMode ? 'none' : 'auto'}
                    onSubmitEditing={onSend}
                    returnKeyType="send"
                    accessibilityLabel={placeholder}
                />
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.sendButton, isSendDisabled && styles.sendButtonDisabled, { backgroundColor: colors.darkPurple }]}
                onPress={onSend}
                disabled={isSendDisabled}
                accessibilityRole="button"
                accessibilityLabel="Send message"
            >
                <MaterialDesignIcons
                    name="send-outline"
                    size={20}
                    color={colors.white}
                    style={styles.sendIcon}
                />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: 8,
    },

    inputWrapper: {
        flex: 1,
    },

    input: {
        backgroundColor: colors.lightGray,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
        color: colors.black,
        minHeight: 44,
    },

    selectionText: {
        flex: 1,
        color: colors.black,
        fontSize: 14,
    },

    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.darkPurple,
        justifyContent: 'center',
        alignItems: 'center',
    },

    sendButtonDisabled: {
        backgroundColor: colors.gray,
    },

    sendIcon: {
        transform: [{ rotate: '-35deg' }],
    },
});