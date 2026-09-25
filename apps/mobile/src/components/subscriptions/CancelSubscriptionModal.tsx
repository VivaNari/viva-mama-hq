import Lucide from '@react-native-vector-icons/lucide';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { BillingMode } from '../../types/entitlements.types';

interface ICancelSubscriptionModalProps {
    visible: boolean;
    submitting: boolean;
    /**
     * Formatted date access runs to. Null only if the server has no period end on
     * record, in which case the reassurance is given without a date rather than with
     * a wrong one.
     */
    accessUntil: string | null;
    /**
     * Which promise cancelling actually breaks. Under AUTOPAY it stops a real charge;
     * under MANUAL nothing was ever going to be charged again.
     */
    billingMode: BillingMode | null;
    onConfirm: () => void;
    onDismiss: () => void;
}

/**
 * Confirmation gate for cancelling a subscription.
 *
 * Follows DeleteAccountModal in structure — same backdrop, same busy handling, same
 * refusal to dismiss mid-flight — with two deliberate differences:
 *
 *  1. **No typed confirmation word.** Deletion earns one because it cannot be undone.
 *     This can: access runs to the end of the paid period and the plan can be bought
 *     again. Asking for the word on both is how people learn to type it without
 *     reading, which is exactly what makes it worthless on the row that needs it.
 *  2. **It leads with what she keeps, not what she loses.** The fear on this button is
 *     "have I just thrown away the rest of the month I paid for?" — answering that is
 *     the modal's main job, so the date is stated before the consequence.
 */
const CancelSubscriptionModal = ({
    visible,
    submitting,
    accessUntil,
    billingMode,
    onConfirm,
    onDismiss,
}: ICancelSubscriptionModalProps) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    const dismissIfIdle = () => {
        if (!submitting) {
            onDismiss();
        }
    };

    // Under MANUAL there is no mandate and no scheduled charge, so "this stops your
    // renewal" would be describing something that was never going to happen.
    const consequenceKey =
        billingMode === BillingMode.AUTOPAY
            ? 'mySubscription.cancelConsequenceAutopay'
            : 'mySubscription.cancelConsequenceManual';

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
                            <Lucide name="circle-alert" size={28} color={colors.darkPurple} />
                        </View>

                        <Text style={[styles.title, globalStyles.fontBold]}>
                            {t('mySubscription.cancelTitle')}
                        </Text>

                        <Text style={[styles.body, globalStyles.fontRegular]}>
                            {accessUntil
                                ? t('mySubscription.cancelKeepAccess', { date: accessUntil })
                                : t('mySubscription.cancelKeepAccessNoDate')}
                        </Text>

                        <View style={styles.listBlock}>
                            <Text style={[styles.listItem, globalStyles.fontRegular]}>
                                {t(consequenceKey)}
                            </Text>
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            disabled={submitting}
                            onPress={onConfirm}
                            style={[
                                styles.destructiveButton,
                                submitting && styles.destructiveButtonDisabled,
                            ]}
                        >
                            {submitting ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <Text
                                    style={[
                                        styles.destructiveButtonText,
                                        globalStyles.fontSemiBold,
                                    ]}
                                >
                                    {t('mySubscription.cancelConfirm')}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.7}
                            disabled={submitting}
                            onPress={onDismiss}
                            style={styles.cancelButton}
                        >
                            <Text style={[styles.cancelText, globalStyles.fontSemiBold]}>
                                {t('mySubscription.cancelKeepPlan')}
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
        backgroundColor: colors.lightPurple,
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
        marginBottom: 18,
    },
    listItem: {
        fontSize: 13,
        color: colors.darkGray,
        lineHeight: 19,
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

export default CancelSubscriptionModal;
