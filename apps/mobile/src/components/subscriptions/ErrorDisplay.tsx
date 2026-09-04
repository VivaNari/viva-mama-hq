import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
} from 'react-native';

import { globalStyles } from '../../public/styles';
import { colors } from '../../public/assets/colors';
import { SubscriptionError, SubscriptionErrorType } from '../../types/subscription.types';

interface ErrorDisplayProps {
    error: SubscriptionError | null;
    onRetry: () => void;
    onDismiss: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
    error,
    onRetry,
    onDismiss,
}) => {
    const { t } = useTranslation();
    if (!error) return null;

    const getErrorTitle = (type: SubscriptionErrorType): string => {
        switch (type) {
            case SubscriptionErrorType.NETWORK_ERROR:
                return t('subscription.errorTitles.connection');
            case SubscriptionErrorType.ORDER_CREATION_FAILED:
                return t('subscription.errorTitles.orderFailed');
            case SubscriptionErrorType.PAYMENT_FAILED:
                return t('subscription.errorTitles.paymentFailed');
            case SubscriptionErrorType.PAYMENT_CANCELLED:
                return t('subscription.errorTitles.paymentCancelled');
            case SubscriptionErrorType.VERIFICATION_FAILED:
                return t('subscription.errorTitles.verificationFailed');
            case SubscriptionErrorType.FREE_PLAN_FAILED:
                return t('subscription.errorTitles.activationFailed');
            default:
                return t('subscription.errorTitles.generic');
        }
    };

    const showContactSupport = error.type === SubscriptionErrorType.VERIFICATION_FAILED;

    return (
        <Modal
            visible={!!error}
            transparent
            animationType="fade"
            onRequestClose={onDismiss}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <Text style={[styles.title, globalStyles.fontBold]}>
                        {getErrorTitle(error.type)}
                    </Text>

                    <Text style={[styles.message, globalStyles.fontRegular]}>
                        {t(error.message)}
                    </Text>

                    {showContactSupport && (
                        <Text style={[styles.supportText, globalStyles.fontRegular]}>
                            {t('subscription.contactSupport')}
                        </Text>
                    )}

                    <View style={styles.buttonContainer}>
                        {error.retryable && (
                            <TouchableOpacity
                                style={[styles.button, styles.retryButton]}
                                onPress={onRetry}
                                accessibilityRole="button"
                                accessibilityLabel="Try again"
                            >
                                <Text style={[styles.retryButtonText, globalStyles.fontSemiBold]}>
                                    {t('subscription.tryAgain')}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.button,
                                styles.dismissButton,
                                !error.retryable && styles.fullWidthButton,
                            ]}
                            onPress={onDismiss}
                            accessibilityRole="button"
                            accessibilityLabel={error.retryable ? 'Cancel' : 'OK'}
                        >
                            <Text style={[styles.dismissButtonText, globalStyles.fontSemiBold]}>
                                {error.retryable ? t('common.cancel') : t('common.ok')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    container: {
        backgroundColor: colors.white,
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    title: {
        fontSize: 18,
        color: colors.black,
        textAlign: 'center',
        marginBottom: 12,
    },
    message: {
        fontSize: 14,
        color: colors.darkGray,
        textAlign: 'center',
        lineHeight: 20,
    },
    supportText: {
        fontSize: 12,
        color: colors.darkPurple,
        textAlign: 'center',
        marginTop: 12,
    },
    buttonContainer: {
        flexDirection: 'row',
        marginTop: 24,
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    retryButton: {
        backgroundColor: colors.darkPurple,
    },
    dismissButton: {
        backgroundColor: colors.lightGray,
    },
    fullWidthButton: {
        flex: 1,
    },
    retryButtonText: {
        color: colors.white,
        fontSize: 14,
    },
    dismissButtonText: {
        color: colors.darkGray,
        fontSize: 14,
    },
});