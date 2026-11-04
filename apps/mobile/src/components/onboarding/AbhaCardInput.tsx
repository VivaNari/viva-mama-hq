import Lucide from '@react-native-vector-icons/lucide';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import {
    acceptHealthRecordsConsent,
    createHealthRecord,
    getHealthRecordsConfig,
    submitHealthRecord,
    uploadHealthRecordFile,
} from '../../api/healthRecords.api';
import {
    ABHA_NUMBER_LENGTH,
    ABHA_RECORD_PREFIX,
    SKIP_ANSWER,
    maskAbhaNumber,
    normalizeAbhaNumber,
} from '../../constants/chat';
import { TPickedFile, useFilePicker } from '../../hooks/useFilePicker';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { newUuid } from '../../utils/attachments';
import { toRecordsLang } from '../../utils/healthRecords';
import { recordError } from '../../analytics';
import AttachmentConsentSheet from '../chatAttachments/AttachmentConsentSheet';

interface Props {
    disabled?: boolean;
    /** Called once the card is saved. `value` is the answer to send, when there is one. */
    onSubmit: (display: string, value: string) => void;
    /** Onboarding only: lets her type the number or skip, so she can never get stuck. */
    allowAlternatives?: boolean;
}

type TSource = 'camera' | 'gallery';

/**
 * Add a photo of her ABHA card, from the camera or gallery. The photo is filed in her
 * health records, where the server never sends it to the AI and spends no upload quota.
 */
const AbhaCardInput: React.FC<Props> = ({ disabled = false, onSubmit, allowAlternatives = true }) => {
    const { t, i18n } = useTranslation();
    const [uploading, setUploading] = useState(false);
    const [typing, setTyping] = useState(false);
    const [typed, setTyped] = useState('');
    const [consentVersion, setConsentVersion] = useState<string | null>(null);
    const [pendingSource, setPendingSource] = useState<TSource | null>(null);
    const [consentSubmitting, setConsentSubmitting] = useState(false);

    const onFiles = useCallback(
        async (files: TPickedFile[]) => {
            const [file] = files;
            if (!file) return;
            setUploading(true);
            try {
                const record = await createHealthRecord({
                    clientUploadId: newUuid(),
                    category: 'abha_card',
                    subject: { type: 'MOTHER' },
                });
                await uploadHealthRecordFile(
                    record.id,
                    { uri: file.uri, name: file.name, type: file.mimeType },
                    newUuid(),
                    () => undefined,
                    new AbortController().signal,
                );
                await submitHealthRecord(record.id, toRecordsLang(i18n.language));
                onSubmit(t('chat.abha.cardAdded'), `${ABHA_RECORD_PREFIX}${record.id}`);
            } catch (error) {
                recordError(error, 'AbhaCardInput.upload');
                Toast.show({
                    type: 'error',
                    text1: t('common.error'),
                    text2: t('chat.abha.uploadFailed'),
                    position: 'bottom',
                });
            } finally {
                setUploading(false);
            }
        },
        [i18n.language, onSubmit, t],
    );

    const photoRoom = useCallback(() => 1, []);
    const pickFrom = useFilePicker({ onFiles, photoRoom });

    const start = async (source: TSource) => {
        setUploading(true);
        try {
            const config = await getHealthRecordsConfig();
            if (!config.enabled) {
                Toast.show({
                    type: 'error',
                    text1: t('common.error'),
                    text2: t('chat.abha.uploadUnavailable'),
                    position: 'bottom',
                });
                return;
            }
            if (!config.consentAccepted) {
                setConsentVersion(config.consentVersion);
                setPendingSource(source);
                return;
            }
            pickFrom(source);
        } catch (error) {
            recordError(error, 'AbhaCardInput.config');
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: t('chat.abha.uploadFailed'),
                position: 'bottom',
            });
        } finally {
            setUploading(false);
        }
    };

    const acceptConsent = async () => {
        if (!consentVersion || !pendingSource) return;
        setConsentSubmitting(true);
        try {
            await acceptHealthRecordsConsent(consentVersion);
            const source = pendingSource;
            setPendingSource(null);
            pickFrom(source);
        } catch (error) {
            recordError(error, 'AbhaCardInput.consent');
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: t('chat.abha.uploadFailed'),
                position: 'bottom',
            });
        } finally {
            setConsentSubmitting(false);
        }
    };

    const digits = normalizeAbhaNumber(typed);
    const typedError = typed.trim().length > 0 && !digits;
    const busy = disabled || uploading;

    return (
        <View style={styles.wrapper}>
            {typing ? (
                <>
                    {typedError ? (
                        <Text style={[styles.error, globalStyles.fontRegular]}>
                            {t('chat.abha.invalidNumber')}
                        </Text>
                    ) : null}
                    <View style={styles.row}>
                        <TextInput
                            style={[styles.input, globalStyles.fontSemiBold]}
                            value={typed}
                            onChangeText={setTyped}
                            keyboardType="number-pad"
                            maxLength={ABHA_NUMBER_LENGTH + 3}
                            placeholder={t('chat.abha.numberPlaceholder')}
                            placeholderTextColor={colors.gray}
                            accessibilityLabel={t('chat.abha.numberPlaceholder')}
                        />
                        <TouchableOpacity
                            style={[styles.button, (!digits || busy) && styles.disabled]}
                            disabled={!digits || busy}
                            onPress={() => digits && onSubmit(maskAbhaNumber(digits), digits)}
                            accessibilityRole="button"
                        >
                            <Text style={[styles.buttonText, globalStyles.fontSemiBold]}>
                                {t('chat.send')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </>
            ) : (
                <View style={styles.row}>
                    <TouchableOpacity
                        style={[styles.button, styles.grow, busy && styles.disabled]}
                        disabled={busy}
                        onPress={() => start('camera')}
                        accessibilityRole="button"
                    >
                        <Lucide name="camera" size={16} color={colors.white} />
                        <Text style={[styles.buttonText, globalStyles.fontSemiBold]}>
                            {t('chat.attachments.takePhoto')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.grow, busy && styles.disabled]}
                        disabled={busy}
                        onPress={() => start('gallery')}
                        accessibilityRole="button"
                    >
                        <Lucide name="image" size={16} color={colors.white} />
                        <Text style={[styles.buttonText, globalStyles.fontSemiBold]}>
                            {t('chat.attachments.chooseFromGallery')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {uploading ? <ActivityIndicator color={colors.darkPurple} style={styles.spinner} /> : null}

            {allowAlternatives ? (
                <View style={styles.links}>
                    <TouchableOpacity
                        disabled={busy}
                        onPress={() => setTyping(value => !value)}
                        accessibilityRole="button"
                    >
                        <Text style={[styles.link, globalStyles.fontSemiBold]}>
                            {t(typing ? 'chat.abha.uploadInstead' : 'chat.abha.typeInstead')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        disabled={busy}
                        onPress={() => onSubmit(t('chat.skip'), SKIP_ANSWER)}
                        accessibilityRole="button"
                    >
                        <Text style={[styles.link, globalStyles.fontSemiBold]}>{t('chat.skip')}</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            <AttachmentConsentSheet
                visible={pendingSource !== null}
                retentionDays={0}
                submitting={consentSubmitting}
                onAccept={acceptConsent}
                onDecline={() => setPendingSource(null)}
                i18nPrefix="chat.abha.consent"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: { paddingHorizontal: 12, paddingTop: 8, gap: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    grow: { flex: 1 },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 44,
        paddingHorizontal: 12,
        borderRadius: 22,
        backgroundColor: colors.darkPurple,
    },
    buttonText: { color: colors.white, fontSize: 13, textAlign: 'center', flexShrink: 1 },
    disabled: { opacity: 0.45 },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        fontSize: 15,
        color: colors.text,
        backgroundColor: colors.white,
    },
    error: { color: colors.error, fontSize: 12, paddingHorizontal: 4 },
    spinner: { marginTop: 2 },
    links: { flexDirection: 'row', justifyContent: 'center', gap: 24, paddingVertical: 4 },
    link: { color: colors.darkPurple, fontSize: 13 },
});

export default AbhaCardInput;
