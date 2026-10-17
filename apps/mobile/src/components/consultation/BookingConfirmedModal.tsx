import Lucide from '@react-native-vector-icons/lucide';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';

interface IBookingConfirmedModalProps {
    visible: boolean;
    onDismiss: () => void;
}

/**
 * Shown after a consultation is booked.
 *
 * A modal rather than a toast on purpose: the message is the only place the patient is
 * told their exact time is still to come and will arrive over WhatsApp. A toast that
 * slides away after three seconds is missable, and a patient who misses this waits by
 * the app at 9 AM for a call that was never scheduled for then.
 */
const BookingConfirmedModal = ({ visible, onDismiss }: IBookingConfirmedModalProps) => {
    const { t } = useTranslation();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            // Android back button must dismiss too, or the patient is trapped.
            onRequestClose={onDismiss}
        >
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <View style={styles.iconCircle}>
                        <Lucide name="circle-check-big" size={32} color={colors.white} />
                    </View>

                    <Text style={[styles.title, globalStyles.fontBold]}>
                        {t('consultation.booking.confirmedTitle')}
                    </Text>

                    <Text style={[styles.body, globalStyles.fontRegular]}>
                        {t('consultation.booking.confirmedBody')}
                    </Text>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onDismiss}
                        style={styles.button}
                    >
                        <Text style={[styles.buttonText, globalStyles.fontSemiBold]}>
                            {t('consultation.booking.gotIt')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    card: {
        width: '100%',
        backgroundColor: colors.white,
        borderRadius: 20,
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 20,
        alignItems: 'center',
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.success,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        color: colors.text,
        textAlign: 'center',
        marginBottom: 10,
    },
    body: {
        fontSize: 14,
        lineHeight: 21,
        color: colors.darkGray,
        textAlign: 'center',
        marginBottom: 22,
    },
    button: {
        width: '100%',
        backgroundColor: colors.darkPurple,
        borderRadius: 30,
        paddingVertical: 14,
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 16,
        color: colors.white,
    },
});

export default BookingConfirmedModal;
