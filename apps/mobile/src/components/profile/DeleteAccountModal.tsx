import Lucide from '@react-native-vector-icons/lucide';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';

interface IDeleteAccountModalProps {
    visible: boolean;
    deleting: boolean;
    onConfirm: () => void;
    onDismiss: () => void;
}

/**
 * Confirmation gate for permanent account deletion.
 *
 * Three deliberate departures from the other modals in this app:
 *
 *  1. **It lists what is erased and what is kept.** Play's User Data policy expects the
 *     user to understand the scope before they commit, and "kept" is not a footnote —
 *     payment records are retained for tax law and she is entitled to know that.
 *  2. **It requires typing the confirmation word**, not just a second tap. This is the
 *     only irreversible action in the product; a mis-tap must not be able to reach it.
 *  3. **The backdrop does not dismiss while deleting.** Everywhere else a stray tap
 *     outside should close the sheet, but here it would leave a half-finished teardown
 *     with no feedback.
 */
const DeleteAccountModal = ({
    visible,
    deleting,
    onConfirm,
    onDismiss,
}: IDeleteAccountModalProps) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [typed, setTyped] = useState('');

    // The expected word is localized: asking a Hindi speaker to type an English word
    // to prove intent tests their keyboard, not their intent.
    const confirmWord = t('deleteAccount.confirmWord');
    const canConfirm = typed.trim().toUpperCase() === confirmWord.toUpperCase() && !deleting;

    // Reset between openings, or reopening the sheet would find the box still filled
    // in and the destructive button already live.
    useEffect(() => {
        if (visible) {
            setTyped('');
        }
    }, [visible]);

    const dismissIfIdle = () => {
        if (!deleting) {
            onDismiss();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={dismissIfIdle}
        >
            <Pressable style={styles.backdrop} onPress={dismissIfIdle}>
                <Pressable
                    style={[styles.card, { marginBottom: insets.bottom }]}
                    onPress={() => {}}
                >
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.iconCircle}>
                            <Lucide name="trash-2" size={28} color={colors.error} />
                        </View>

                        <Text style={[styles.title, globalStyles.fontBold]}>
                            {t('deleteAccount.title')}
                        </Text>
                        <Text style={[styles.body, globalStyles.fontRegular]}>
                            {t('deleteAccount.body')}
                        </Text>

                        <View style={styles.listBlock}>
                            <Text style={[styles.listHeading, globalStyles.fontSemiBold]}>
                                {t('deleteAccount.erasedHeading')}
                            </Text>
                            <Text style={[styles.listItem, globalStyles.fontRegular]}>
                                {t('deleteAccount.erasedItems')}
                            </Text>
                        </View>

                        <View style={styles.listBlock}>
                            <Text style={[styles.listHeading, globalStyles.fontSemiBold]}>
                                {t('deleteAccount.keptHeading')}
                            </Text>
                            <Text style={[styles.listItem, globalStyles.fontRegular]}>
                                {t('deleteAccount.keptItems')}
                            </Text>
                        </View>

                        <Text style={[styles.prompt, globalStyles.fontRegular]}>
                            {t('deleteAccount.typePrompt', { word: confirmWord })}
                        </Text>
                        <TextInput
                            value={typed}
                            onChangeText={setTyped}
                            editable={!deleting}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            placeholder={confirmWord}
                            placeholderTextColor={colors.gray}
                            style={[styles.input, globalStyles.fontSemiBold]}
                        />

                        <TouchableOpacity
                            activeOpacity={0.8}
                            disabled={!canConfirm}
                            onPress={onConfirm}
                            style={[
                                styles.destructiveButton,
                                !canConfirm && styles.destructiveButtonDisabled,
                            ]}
                        >
                            {deleting ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <Text
                                    style={[
                                        styles.destructiveButtonText,
                                        globalStyles.fontSemiBold,
                                    ]}
                                >
                                    {t('deleteAccount.confirmButton')}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.7}
                            disabled={deleting}
                            onPress={onDismiss}
                            style={styles.cancelButton}
                        >
                            <Text style={[styles.cancelText, globalStyles.fontSemiBold]}>
                                {t('common.cancel')}
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    card: {
        backgroundColor: colors.white,
        borderRadius: 20,
        padding: 24,
        maxHeight: '85%',
    },
    iconCircle: {
        alignSelf: 'center',
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FDECEC',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    title: {
        fontSize: 20,
        color: colors.text,
        textAlign: 'center',
        marginBottom: 8,
    },
    body: {
        fontSize: 14,
        color: colors.darkGray,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 16,
    },
    listBlock: {
        backgroundColor: colors.pageBG,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
    },
    listHeading: {
        fontSize: 13,
        color: colors.text,
        marginBottom: 4,
    },
    listItem: {
        fontSize: 13,
        color: colors.darkGray,
        lineHeight: 19,
    },
    prompt: {
        fontSize: 13,
        color: colors.darkGray,
        marginTop: 8,
        marginBottom: 8,
    },
    input: {
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: colors.text,
        marginBottom: 18,
    },
    destructiveButton: {
        backgroundColor: colors.error,
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    destructiveButtonDisabled: {
        opacity: 0.4,
    },
    destructiveButtonText: {
        fontSize: 16,
        color: colors.white,
    },
    cancelButton: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 15,
        color: colors.darkGray,
    },
});

export default DeleteAccountModal;
