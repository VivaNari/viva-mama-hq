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
import { ReportReason } from '../../types/vivaClub.types';

/**
 * Reason order is deliberate: the things that actually harm someone come first, and
 * SPAM — by far the most common but least urgent — is last so it is not the default
 * thumb position. SELF_HARM sits with them because in this app it is a welfare signal;
 * the server sorts those to the top of the moderation queue.
 */
const REASONS: ReportReason[] = [
    'HARASSMENT',
    'HATE',
    'SEXUAL',
    'MISINFORMATION',
    'SELF_HARM',
    'SPAM',
    'OTHER',
];

interface IReportSheetProps {
    visible: boolean;
    submitting: boolean;
    /** What is being reported — only used for the title, so B5 can reuse this as-is. */
    subjectKey?: string;
    /**
     * Which reasons to offer. Defaults to the community set; Viva AI passes a narrower
     * one, because SPAM and HARASSMENT describe what people do to each other and a
     * report carrying one would reach the queue with nothing anyone could act on.
     */
    reasons?: ReportReason[];
    /**
     * Extra line shown above the reasons. Viva AI uses it to say that the reported
     * reply *and her own preceding message* are sent to the team — sending a health
     * disclosure to a human reviewer without saying so is not something to leave
     * implied.
     */
    noticeKey?: string;
    onSubmit: (reason: ReportReason, details: string) => void;
    onDismiss: () => void;
}

const ReportSheet = ({
    visible,
    submitting,
    subjectKey = 'vivaClub.reportSubjectContent',
    reasons = REASONS,
    noticeKey,
    onSubmit,
    onDismiss,
}: IReportSheetProps) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [reason, setReason] = useState<ReportReason | null>(null);
    const [details, setDetails] = useState('');

    // Reset per opening, or the previous report's reason is pre-selected on the next
    // one and a mis-tap submits it.
    useEffect(() => {
        if (visible) {
            setReason(null);
            setDetails('');
        }
    }, [visible]);

    const dismissIfIdle = () => {
        if (!submitting) onDismiss();
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={dismissIfIdle}>
            <Pressable style={styles.backdrop} onPress={dismissIfIdle}>
                <Pressable
                    style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}
                    onPress={() => {}}
                >
                    <View style={styles.handle} />

                    <Text style={[styles.title, globalStyles.fontBold]}>
                        {t('vivaClub.reportTitle', { subject: t(subjectKey) })}
                    </Text>
                    <Text style={[styles.subtitle, globalStyles.fontRegular]}>
                        {t('vivaClub.reportSubtitle')}
                    </Text>

                    {noticeKey ? (
                        <View style={styles.notice}>
                            <Lucide name="info" size={14} color={colors.darkPurple} />
                            <Text style={[styles.noticeText, globalStyles.fontRegular]}>
                                {t(noticeKey)}
                            </Text>
                        </View>
                    ) : null}

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        {reasons.map((r) => {
                            const active = reason === r;
                            return (
                                <TouchableOpacity
                                    key={r}
                                    activeOpacity={0.7}
                                    onPress={() => setReason(r)}
                                    style={[styles.reasonRow, active && styles.reasonRowActive]}
                                >
                                    <Text
                                        style={[
                                            styles.reasonText,
                                            globalStyles.fontMedium,
                                            active && { color: colors.darkPurple },
                                        ]}
                                    >
                                        {t(`vivaClub.reportReason.${r}`)}
                                    </Text>
                                    {active ? (
                                        <Lucide name="check" size={18} color={colors.darkPurple} />
                                    ) : null}
                                </TouchableOpacity>
                            );
                        })}

                        {reason === 'OTHER' ? (
                            <TextInput
                                value={details}
                                onChangeText={setDetails}
                                placeholder={t('vivaClub.reportDetailsPlaceholder')}
                                placeholderTextColor={colors.gray}
                                multiline
                                maxLength={500}
                                editable={!submitting}
                                style={[styles.details, globalStyles.fontRegular]}
                            />
                        ) : null}
                    </ScrollView>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={!reason || submitting}
                        onPress={() => reason && onSubmit(reason, details)}
                        style={[styles.submit, (!reason || submitting) && styles.submitDisabled]}
                    >
                        {submitting ? (
                            <ActivityIndicator color={colors.white} />
                        ) : (
                            <Text style={[styles.submitText, globalStyles.fontSemiBold]}>
                                {t('vivaClub.reportSubmit')}
                            </Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity activeOpacity={0.7} onPress={dismissIfIdle} style={styles.cancel}>
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
        paddingTop: 12,
        maxHeight: '85%',
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        alignSelf: 'center',
        marginBottom: 16,
    },
    title: { fontSize: 18, color: colors.text, marginBottom: 4 },
    notice: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
        backgroundColor: colors.lightPurple,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 14,
    },
    noticeText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 17 },
    subtitle: { fontSize: 13, color: colors.darkGray, marginBottom: 16, lineHeight: 19 },
    reasonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: colors.border,
        marginBottom: 8,
    },
    reasonRowActive: { borderColor: colors.darkPurple, backgroundColor: colors.lightPurple },
    reasonText: { fontSize: 14, color: colors.text },
    details: {
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: colors.text,
        minHeight: 80,
        textAlignVertical: 'top',
        marginTop: 4,
        marginBottom: 8,
    },
    submit: {
        backgroundColor: colors.darkPurple,
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 12,
    },
    submitDisabled: { opacity: 0.4 },
    submitText: { fontSize: 16, color: colors.white },
    cancel: { paddingVertical: 12, alignItems: 'center' },
    cancelText: { fontSize: 15, color: colors.darkGray },
});

export default ReportSheet;
