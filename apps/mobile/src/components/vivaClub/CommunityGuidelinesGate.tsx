import Lucide from '@react-native-vector-icons/lucide';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AnalyticsEvent, recordError, track } from '../../analytics';
import { acceptGuidelines } from '../../api/vivaClubModeration';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';

/** Published guidelines. Must exist before release, or this link 404s. */
export const COMMUNITY_GUIDELINES_URL = 'https://vivamama.in/community-guidelines/';

interface ICommunityGuidelinesGateProps {
    visible: boolean;
    onAccepted: () => void;
    onDismiss: () => void;
}

/**
 * Blocks the composer until the community guidelines are accepted.
 *
 * Play's UGC policy requires users to accept terms *before* creating content, which is
 * why this is a gate rather than a line in the signup flow: everyone who registered
 * before the guidelines existed has to pass through it too. Acceptance is recorded
 * server-side against a version, using the same consents array as the privacy policy
 * and terms, so a future revision can ask again.
 */
const CommunityGuidelinesGate = ({
    visible,
    onAccepted,
    onDismiss,
}: ICommunityGuidelinesGateProps) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [submitting, setSubmitting] = useState(false);

    const handleAccept = async () => {
        setSubmitting(true);
        try {
            await acceptGuidelines();
            track(AnalyticsEvent.COMMUNITY_GUIDELINES_ACCEPTED);
            onAccepted();
        } catch (error) {
            recordError(error, 'CommunityGuidelinesGate.accept');
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: t('vivaClub.actionFailed'),
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
            <Pressable style={styles.backdrop} onPress={submitting ? undefined : onDismiss}>
                <Pressable
                    style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}
                    onPress={() => {}}
                >
                    <View style={styles.iconCircle}>
                        <Lucide name="users" size={26} color={colors.darkPurple} />
                    </View>

                    <Text style={[styles.title, globalStyles.fontBold]}>
                        {t('vivaClub.guidelinesTitle')}
                    </Text>

                    <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
                        <Text style={[styles.intro, globalStyles.fontRegular]}>
                            {t('vivaClub.guidelinesIntro')}
                        </Text>
                        {['1', '2', '3', '4'].map((n) => (
                            <View key={n} style={styles.ruleRow}>
                                <Lucide name="check" size={16} color={colors.darkPurple} />
                                <Text style={[styles.ruleText, globalStyles.fontRegular]}>
                                    {t(`vivaClub.guidelinesRule${n}`)}
                                </Text>
                            </View>
                        ))}

                        <Text
                            onPress={() => Linking.openURL(COMMUNITY_GUIDELINES_URL)}
                            style={[styles.link, globalStyles.fontMedium]}
                        >
                            {t('vivaClub.guidelinesReadFull')}
                        </Text>
                    </ScrollView>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={submitting}
                        onPress={handleAccept}
                        style={[styles.accept, submitting && { opacity: 0.6 }]}
                    >
                        {submitting ? (
                            <ActivityIndicator color={colors.white} />
                        ) : (
                            <Text style={[styles.acceptText, globalStyles.fontSemiBold]}>
                                {t('vivaClub.guidelinesAccept')}
                            </Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.7}
                        disabled={submitting}
                        onPress={onDismiss}
                        style={styles.cancel}
                    >
                        <Text style={[styles.cancelText, globalStyles.fontSemiBold]}>
                            {t('common.cancel')}
                        </Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 20,
        maxHeight: '85%',
    },
    iconCircle: {
        alignSelf: 'center',
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: colors.lightPurple,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    title: { fontSize: 19, color: colors.text, textAlign: 'center', marginBottom: 12 },
    body: { marginBottom: 8 },
    intro: { fontSize: 14, color: colors.darkGray, lineHeight: 20, marginBottom: 14 },
    ruleRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
    ruleText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
    link: {
        fontSize: 13,
        color: colors.darkPurple,
        textDecorationLine: 'underline',
        marginTop: 6,
        marginBottom: 4,
    },
    accept: {
        backgroundColor: colors.darkPurple,
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 10,
    },
    acceptText: { fontSize: 16, color: colors.white },
    cancel: { paddingVertical: 12, alignItems: 'center' },
    cancelText: { fontSize: 15, color: colors.darkGray },
});

export default CommunityGuidelinesGate;
