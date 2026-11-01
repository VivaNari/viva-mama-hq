import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    View,
    TextInput,
    TouchableOpacity,
    Text,
    StyleSheet,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import Lucide from '@react-native-vector-icons/lucide';
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
    /**
     * Validation message for the current numeric answer, or null when it is acceptable.
     * Shown inline and used to block send — the server silently discards out-of-range
     * measurements, so without this the answer would just vanish.
     */
    validationError?: string | null;
    /**
     * Viva AI only: a paperclip to attach reports, scans or prescriptions. Absent for
     * guided check-ins, which share this bar but take no files.
     */
    attachments?: {
        onAttachPress: () => void;
        /** At least one picked file has finished uploading. */
        hasReady: boolean;
        /** A picked file is still uploading (or failed): sending waits for it. */
        blocking: boolean;
        /** No more files can be added to this message. */
        full: boolean;
    };
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
    validationError = null,
    attachments,
}) => {
    const { t } = useTranslation();
    // Multi-select submit bar
    if (inputMode === 'multiSelect' && selectedOptionsCount > 0) {
        return (
            <View style={styles.container}>
                <Text style={[styles.selectionText, globalStyles.fontMedium]}>
                    {t('chat.selectedToSubmit', { count: selectedOptionsCount })}
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
    const isNumberMode = inputMode === 'number';
    const hasError = isNumberMode && inputText.trim().length > 0 && !!validationError;
    const showAttach = !!attachments && inputMode === 'text';
    const hasText = inputText.trim().length > 0;
    // A message may be only files; it may not leave while one is still uploading.
    const isSendDisabled =
        isLoading ||
        (isNumberMode && !!validationError) ||
        (showAttach && attachments!.blocking) ||
        (!hasText && !(showAttach && attachments!.hasReady));
    const placeholder = isDateMode
        ? t('chat.selectADate')
        : isNumberMode
            ? t('chat.enterNumber')
            : showAttach && (attachments!.hasReady || attachments!.blocking)
                ? t('chat.attachments.addQuestion')
                : t('chat.typeAnswer');

    return (
        <View>
            {/* Only once she has typed something: an empty field is not yet a mistake. */}
            {hasError && (
                <Text style={[styles.errorText, globalStyles.fontRegular]}>
                    {validationError}
                </Text>
            )}

            <View style={styles.container}>
                {showAttach && (
                    <TouchableOpacity
                        style={[styles.attachButton, (isLoading || attachments!.full) && styles.attachButtonDisabled]}
                        onPress={attachments!.onAttachPress}
                        disabled={isLoading || attachments!.full}
                        accessibilityRole="button"
                        accessibilityLabel={t('chat.attachments.a11y.attach')}
                        accessibilityState={{ disabled: isLoading || attachments!.full }}
                    >
                        <Lucide name="paperclip" size={22} color={colors.darkPurple} />
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={styles.inputWrapper}
                    activeOpacity={isDateMode ? 0.7 : 1}
                    onPress={isDateMode ? onDatePickerOpen : undefined}
                >
                    <TextInput
                        style={[
                            styles.input,
                            globalStyles.fontSemiBold,
                            hasError && styles.inputError,
                        ]}
                        value={inputText}
                        onChangeText={onInputChange}
                        placeholder={placeholder}
                        placeholderTextColor={colors.gray}
                        editable={!isDateMode}
                        pointerEvents={isDateMode ? 'none' : 'auto'}
                        onSubmitEditing={onSend}
                        returnKeyType="send"
                        // decimal-pad, not numeric: the measurements are decimals (34.8 cm)
                        // and numeric offers punctuation that would fail parseFloat.
                        keyboardType={isNumberMode ? 'decimal-pad' : 'default'}
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

    inputError: {
        borderWidth: 1,
        borderColor: colors.redBadgeText,
    },

    errorText: {
        color: colors.redBadgeText,
        fontSize: 12,
        paddingHorizontal: 16,
        paddingTop: 6,
        backgroundColor: colors.white,
    },

    selectionText: {
        flex: 1,
        color: colors.black,
        fontSize: 14,
    },

    attachButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.lightPurple,
    },

    attachButtonDisabled: {
        opacity: 0.4,
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