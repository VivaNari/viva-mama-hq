import Lucide from '@react-native-vector-icons/lucide';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PREFERRED_SLOT_LABEL_KEYS } from '../../constants/consultationSlots';
import { VIVAMAMA_SUPPORT_WHATSAPP } from '../../constants/support';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import {
    ConsultationTypeEnum,
    EConsultationStage,
    IUserConsultationHistory,
} from '../../types/consultation.types';
import { RequestCallbackStatusEnum } from '../../types/careManager.types';
import { AnalyticsEvent, toAnalyticsConsultationType, track } from '../../analytics';

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });

const initialsOf = (name: string) =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join('');

/**
 * One booking on the history screen. Which controls it offers follows the stage: a
 * call still ahead can be joined or rescheduled, a finished one can be rated, and one
 * that never happened says so rather than offering a dead Join button.
 */
const ConsultationHistoryCard = ({
    item,
    onRate,
}: {
    item: IUserConsultationHistory;
    onRate: (consultationId: string) => void;
}) => {
    const { t } = useTranslation();

    const consultator = item.consultator;
    const role =
        item.consultationType === ConsultationTypeEnum.CARE_MANAGER
            ? t('consultation.careManager')
            : consultator?.speciality || t('consultation.expert');

    const isUnhandled = item.requestStatus === RequestCallbackStatusEnum.UNHANDLED;
    const isCompleted = item.requestStatus === RequestCallbackStatusEnum.COMPLETED;
    const isPast = item.stage === EConsultationStage.PAST;

    const statusTone = isUnhandled
        ? { bg: colors.redBadgeBG, text: colors.redBadgeText, label: t('consultationHistory.status.unhandled') }
        : isCompleted
            ? { bg: colors.greenBadgeBG, text: colors.greenBadgeText, label: t('consultationHistory.status.completed') }
            : item.stage === EConsultationStage.ONGOING
                ? { bg: colors.yellowBadgeBG, text: colors.yellowBadgeText, label: t('consultationHistory.status.ongoing') }
                : { bg: colors.lightPurple, text: colors.darkPurple, label: t('consultationHistory.status.upcoming') };

    const openWhatsApp = () => {
        const message = t('consultation.banner.modifyMessage', {
            ref: item._id,
            name: consultator?.name ?? '',
            date: formatDate(item.startsAt),
        });
        Linking.openURL(
            `https://wa.me/${VIVAMAMA_SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`,
        );
    };

    return (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                {consultator?.photograph ? (
                    <Image source={{ uri: consultator.photograph }} style={styles.avatar} resizeMode="cover" />
                ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={[styles.avatarInitials, globalStyles.fontBold]}>
                            {initialsOf(consultator?.name ?? '?')}
                        </Text>
                    </View>
                )}

                <View style={styles.headerMeta}>
                    <Text style={[styles.name, globalStyles.fontBold]} numberOfLines={1}>
                        {consultator?.name ?? t('consultationHistory.unknownConsultant')}
                    </Text>
                    <Text style={[styles.role, globalStyles.fontSemiBold]} numberOfLines={1}>
                        {role}
                    </Text>
                </View>

                <View style={[styles.statusPill, { backgroundColor: statusTone.bg }]}>
                    <Text style={[styles.statusText, globalStyles.fontSemiBold, { color: statusTone.text }]}>
                        {statusTone.label}
                    </Text>
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.metaRow}>
                <Lucide name="calendar" size={15} color={colors.darkGray} />
                <Text style={[styles.metaText, globalStyles.fontRegular]}>
                    {formatDate(item.startsAt)}
                </Text>
            </View>

            {item.meeting_confirmed_at ? (
                <View style={styles.metaRow}>
                    <Lucide name="circle-check-big" size={15} color={colors.success} />
                    <Text style={[styles.confirmedText, globalStyles.fontSemiBold]}>
                        {t('consultation.banner.confirmedFor', {
                            date: formatDate(item.meeting_confirmed_at),
                            time: formatTime(item.meeting_confirmed_at),
                        })}
                    </Text>
                </View>
            ) : item.preferred_slot ? (
                <View style={styles.metaRow}>
                    <Lucide name="clock" size={15} color={colors.darkGray} />
                    <Text style={[styles.metaText, globalStyles.fontRegular]}>
                        {t('consultation.banner.preferredSlot', {
                            slot: t(PREFERRED_SLOT_LABEL_KEYS[item.preferred_slot]),
                        })}
                    </Text>
                </View>
            ) : null}

            {/* Only a booking still to happen is waiting on a time — saying so on a
                finished one would read as though something is still owed. */}
            {!isPast && !item.meeting_confirmed_at ? (
                <View style={styles.metaRow}>
                    <Lucide name="hourglass" size={15} color={colors.warning} />
                    <Text style={[styles.metaText, globalStyles.fontRegular]}>
                        {t('consultation.banner.awaitingConfirmation')}
                    </Text>
                </View>
            ) : null}

            {!isPast && item.canJoinNow && item.meeting_link ? (
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                        if (!item.meeting_link) return;
                        track(AnalyticsEvent.CONSULTATION_JOINED, {
                            consultation_type: toAnalyticsConsultationType(
                                item.consultationType,
                            ),
                        });
                        Linking.openURL(item.meeting_link);
                    }}
                    style={styles.joinButton}
                >
                    <Lucide name="video" size={17} color={colors.white} />
                    <Text style={[styles.joinButtonText, globalStyles.fontSemiBold]}>
                        {t('consultation.banner.joinNow')}
                    </Text>
                </TouchableOpacity>
            ) : null}

            {item.stage === EConsultationStage.UPCOMING && !item.canJoinNow && item.joinUnlocksAt ? (
                <Text style={[styles.helper, globalStyles.fontRegular]}>
                    {t('consultation.banner.joinOpensAt', { time: formatTime(item.joinUnlocksAt) })}
                </Text>
            ) : null}

            {item.stage === EConsultationStage.ONGOING ? (
                <Text style={[styles.helper, globalStyles.fontRegular]}>
                    {t('consultationHistory.ongoingNote')}
                </Text>
            ) : null}

            {isUnhandled ? (
                <Text style={[styles.helper, globalStyles.fontRegular]}>
                    {t('consultationHistory.unhandledNote')}
                </Text>
            ) : null}

            {isCompleted ? (
                item.rating ? (
                    <View style={styles.ratedRow}>
                        <Lucide name="star" size={15} color={colors.darkPurple} />
                        <Text style={[styles.ratedText, globalStyles.fontSemiBold]}>
                            {t('consultationHistory.yourRating', { rating: item.rating })}
                        </Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => onRate(item._id)}
                        style={styles.secondaryButton}
                    >
                        <Lucide name="star" size={16} color={colors.darkPurple} />
                        <Text style={[styles.secondaryButtonText, globalStyles.fontSemiBold]}>
                            {t('consultationHistory.rateCta')}
                        </Text>
                    </TouchableOpacity>
                )
            ) : null}

            {!isPast ? (
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={openWhatsApp}
                    style={styles.secondaryButton}
                >
                    <Lucide name="message-circle" size={16} color={colors.darkPurple} />
                    <Text style={[styles.secondaryButtonText, globalStyles.fontSemiBold]}>
                        {t('consultation.banner.modifyCta')}
                    </Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        gap: 8,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.border,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: colors.lightGray,
    },
    avatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.purple,
    },
    avatarInitials: {
        fontSize: 16,
        color: colors.white,
    },
    headerMeta: {
        flex: 1,
        gap: 2,
    },
    name: {
        fontSize: 15,
        color: colors.text,
    },
    role: {
        fontSize: 12,
        color: colors.purple,
    },
    statusPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 11,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    metaText: {
        flex: 1,
        fontSize: 13,
        color: colors.darkGray,
    },
    confirmedText: {
        flex: 1,
        fontSize: 13,
        color: colors.success,
    },
    helper: {
        fontSize: 12,
        color: colors.gray,
    },
    joinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 4,
        paddingVertical: 11,
        borderRadius: 10,
        backgroundColor: colors.darkPurple,
    },
    joinButtonText: {
        fontSize: 15,
        color: colors.white,
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 4,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.purple,
    },
    secondaryButtonText: {
        fontSize: 14,
        color: colors.darkPurple,
    },
    ratedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    ratedText: {
        fontSize: 13,
        color: colors.darkPurple,
    },
});

export default ConsultationHistoryCard;
