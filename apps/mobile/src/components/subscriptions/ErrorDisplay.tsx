import React from 'react';
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
    if (!error) return null;

    const getErrorTitle = (type: SubscriptionErrorType): string => {
        switch (type) {
            case SubscriptionErrorType.NETWORK_ERROR:
                return 'Connection Error';
            case SubscriptionErrorType.ORDER_CREATION_FAILED:
                return 'Order Failed';
            case SubscriptionErrorType.PAYMENT_FAILED:
                return 'Payment Failed';
            case SubscriptionErrorType.PAYMENT_CANCELLED:
                return 'Payment Cancelled';
            case SubscriptionErrorType.VERIFICATION_FAILED:
                return 'Verification Failed';
            case SubscriptionErrorType.FREE_PLAN_FAILED:
                return 'Activation Failed';
            default:
                return 'Error';
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
                        {error.message}
                    </Text>

                    {showContactSupport && (
                        <Text style={[styles.supportText, globalStyles.fontRegular]}>
                            Please contact support with your payment details.
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
                                    Try Again
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
                                {error.retryable ? 'Cancel' : 'OK'}
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