import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
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
    /**
     * Viva AI only: a mic that types what she says into the box (speech-to-text).
     * Absent for guided check-ins.
     */
    voice?: {
        isListening: boolean;
        onMicPress: () => void;
    };
    /** Open the keyboard as soon as the box appears. */
    autoFocus?: boolean;
    /**
     * Viva AI only: the buttons attached above the box. Told when to hide, because they
     * give way to what she has written in step with the mic.
     */
    renderTriggers?: (hidden: boolean) => React.ReactNode;
}

/** The mic, pulsing while it listens so she can see it is hearing her. */
const MicButton: React.FC<{ isListening: boolean; disabled: boolean; onPress: () => void }> = ({
    isListening,
    disabled,
    onPress,
}) => {
    const { t } = useTranslation();
    const pulse = useSharedValue(1);

    useEffect(() => {
        if (isListening) {
            pulse.value = withRepeat(withTiming(1.12, { duration: 600 }), -1, true);
        } else {
            cancelAnimation(pulse);
            pulse.value = withTiming(1, { duration: 150 });
        }
    }, [isListening, pulse]);

    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

    return (
        <Animated.View style={animatedStyle}>
            <TouchableOpacity
                style={[
                    styles.micButton,
                    isListening && styles.micButtonListening,
                    disabled && styles.attachButtonDisabled,
                ]}
                onPress={onPress}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={t(isListening ? 'chat.voice.stopMicA11y' : 'chat.voice.micA11y')}
                accessibilityState={{ disabled, busy: isListening }}
            >
                <MaterialDesignIcons
                    name={isListening ? 'stop' : 'microphone'}
                    size={22}
                    color={isListening ? colors.white : colors.darkPurple}
                />
            </TouchableOpacity>
        </Animated.View>
    );
};

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
    voice,
    autoFocus = false,
    renderTriggers,
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
    if (
        inputMode === 'none' ||
        inputMode === 'multiSelect' ||
        inputMode === 'deliveryDate' ||
        inputMode === 'weight' ||
        inputMode === 'height' ||
        inputMode === 'abhaCard'
    ) {
        return null;
    }

    const isDateMode = inputMode === 'date';
    const isNumberMode = inputMode === 'number';
    const hasError = isNumberMode && inputText.trim().length > 0 && !!validationError;
    const showAttach = !!attachments && inputMode === 'text';
    const showMic = !!voice && inputMode === 'text';
    const isListening = showMic && voice!.isListening;
    const hasText = inputText.trim().length > 0;
    // A message may be only files; it may not leave while one is still uploading.
    const isSendDisabled =
        isLoading ||
        (isNumberMode && !!validationError) ||
        (showAttach && attachments!.blocking) ||
        (!hasText && !(showAttach && attachments!.hasReady));
    // One button at a time, as in WhatsApp: the mic on an empty box, send once there is
    // something to send. A picked file counts, or a file with no words could never leave.
    const hasContent = hasText || (showAttach && (attachments!.hasReady || attachments!.blocking));
    // Dictation types into the box as she speaks, so the mic stays to let her stop it.
    const showMicButton = showMic && (isListening || !hasContent);
    // Without a mic (guided check-ins, numbers, dates) send is the only way to answer.
    const showSendButton = !showMic || hasContent;
    const triggers = inputMode === 'text' ? renderTriggers?.(hasContent) : null;
    const placeholder = isListening
        ? t('chat.voice.listening')
        : isDateMode
            ? t('chat.selectADate')
            : isNumberMode
                ? t('chat.enterNumber')
                : showAttach && (attachments!.hasReady || attachments!.blocking)
                    ? t('chat.attachments.addQuestion')
                    : t('chat.typeAnswer');

    return (
        <View style={!!triggers && styles.barWithTriggers}>
            {/* Only once she has typed something: an empty field is not yet a mistake. */}
            {hasError && (
                <Text style={[styles.errorText, globalStyles.fontRegular]}>
                    {validationError}
                </Text>
            )}

            {triggers}

            <View style={[styles.container, !!triggers && styles.containerWithTriggers]}>
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
                        multiline
                        numberOfLines={5}
                        value={inputText}
                        autoFocus={autoFocus}
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

                {showMicButton && (
                    <MicButton
                        isListening={isListening}
                        // She may stop a recording at any time, even while Viva is replying.
                        disabled={isLoading && !isListening}
                        onPress={voice!.onMicPress}
                    />
                )}

                {showSendButton && (
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
                )}
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

    barWithTriggers: {
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },

    // The bar's own top border moves above the buttons, so they sit on the box unbroken.
    containerWithTriggers: {
        borderTopWidth: 0,
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

    micButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.lightPurple,
    },

    micButtonListening: {
        backgroundColor: colors.redBadgeText,
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