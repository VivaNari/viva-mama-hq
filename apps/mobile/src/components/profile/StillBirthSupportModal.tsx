import Lucide from '@react-native-vector-icons/lucide';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';

interface IStillBirthSupportModalProps {
    visible: boolean;
    onConsultExpert: () => void;
    onChatWithViva: () => void;
    onDismiss: () => void;
}

/**
 * Shown once, after a mother records that she lost her baby.
 *
 * Built to match BookingConfirmedModal so the app speaks with one voice, with two
 * deliberate departures: the icon is a soft purple rather than the success green
 * (a green tick to acknowledge a bereavement would be grotesque), and it offers the
 * same two routes out as the onboarding still-birth node instead of a single
 * dismiss. The backdrop dismisses as well — she came here to edit her profile and
 * must not be cornered into choosing a destination.
 */
const StillBirthSupportModal = ({
    visible,
    onConsultExpert,
    onChatWithViva,
    onDismiss,
}: IStillBirthSupportModalProps) => {
    const { t } = useTranslation();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            // Android back button must dismiss too, or she is trapped.
            onRequestClose={onDismiss}
        >
            <Pressable style={styles.backdrop} onPress={onDismiss}>
                {/* Swallows taps so pressing the card itself never dismisses. */}
                <Pressable style={styles.card} onPress={() => {}}>
                    <View style={styles.iconCircle}>
                        <Lucide name="hand-heart" size={32} color={colors.darkPurple} />
                    </View>

                    <Text style={[styles.body, globalStyles.fontRegular]}>
                        {t('editProfile.stillBirthAck')}
                    </Text>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onConsultExpert}
                        style={styles.primaryButton}
                    >
                        <Text style={[styles.primaryButtonText, globalStyles.fontSemiBold]}>
                            {t('chat.consultExpert')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onChatWithViva}
                        style={styles.secondaryButton}
                    >
                        <Text style={[styles.secondaryButtonText, globalStyles.fontSemiBold]}>
                            {t('chat.chatWithViva')}
                        </Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
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
        backgroundColor: colors.lightPurple,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    body: {
        fontSize: 14,
        lineHeight: 21,
        color: colors.darkGray,
        textAlign: 'center',
        marginBottom: 22,
    },
    primaryButton: {
        width: '100%',
        backgroundColor: colors.darkPurple,
        borderRadius: 30,
        paddingVertical: 14,
        alignItems: 'center',
    },
    primaryButtonText: {
        fontSize: 16,
        color: colors.white,
    },
    secondaryButton: {
        width: '100%',
        backgroundColor: colors.white,
        borderWidth: 1.5,
        borderColor: colors.darkPurple,
        borderRadius: 30,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 10,
    },
    secondaryButtonText: {
        fontSize: 16,
        color: colors.darkPurple,
    },
});

export default StillBirthSupportModal;
