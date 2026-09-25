import Lucide from '@react-native-vector-icons/lucide'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import { PREFERRED_SLOT_LABEL_KEYS } from '../constants/consultationSlots'
import { VIVAMAMA_SUPPORT_WHATSAPP } from '../constants/support'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'
import { ConsultationTypeEnum, IUserActiveConsultations } from '../types/consultation.types'
import { convertDateToIST } from '../utils/convertDateToIST'
import { AnalyticsEvent, toAnalyticsConsultationType, track } from '../analytics'

/** How often the join window is re-evaluated while the dashboard sits open. */
const UNLOCK_TICK_MS = 30_000;

/** Mirrors JOIN_WINDOW_GRACE_MINUTES on the server. */
const JOIN_GRACE_MS = 45 * 60_000;

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

const ActiveConsultation = ({ item }: { item: IUserActiveConsultations }) => {
    const { t } = useTranslation();

    // `canJoinNow` from the server is only true for the instant the response was built.
    // Someone sitting on the dashboard at 10:24 would otherwise never see the button turn
    // on, so the window is re-derived on a timer against the local clock.
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), UNLOCK_TICK_MS);
        return () => clearInterval(timer);
    }, []);

    // Visibility is decided by the server, which keeps a confirmed booking listed through
    // its call window. The old client-side check hid the banner from midnight on the
    // consultation day — taking the Join button with it, exactly when it was needed.
    if (!item.preferred_consultation_date) {
        return null;
    }

    const consultator = item.consultatorId;


    const openWhatsApp = () => {
        const message = t('consultation.banner.modifyMessage', {
            ref: item._id,
            name: consultator?.name ?? '',
            date: convertDateToIST(item.preferred_consultation_date),
        });
        Linking.openURL(
            `https://wa.me/${VIVAMAMA_SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`,
        );
    };

    // Calculate dates against the local clock to re-derive canJoin on our timer.
    // Confirmations can also happen in place, so verify there is a room link at all.
    const hasTime = !!item.meeting_confirmed_at;
    const joinUnlocksAt = hasTime ? new Date(item.meeting_confirmed_at!).getTime() - 5 * 60_000 : null;
    const closesAt = hasTime ? new Date(item.meeting_confirmed_at!).getTime() + JOIN_GRACE_MS : null;
    const canJoin =
        hasTime &&
        !!item.meeting_link &&
        joinUnlocksAt !== null &&
        closesAt !== null &&
        now >= joinUnlocksAt &&
        now < closesAt;

    // Bookings made before slots existed have no window, no link and no confirmed time —
    // there is nothing for the expanded card to show, so they keep the original strip.
    if (!item.preferred_slot && !item.meeting_link && !item.meeting_confirmed_at) {
        if (new Date(item.preferred_consultation_date) < new Date()) {
            return null;
        }
        return (
            <View style={styles.legacyWrapper}>
                <LinearGradient
                    colors={[colors.purple, colors.darkPurple]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.legacyGradient}
                >
                    <Text style={[styles.legacyText, globalStyles.fontSemiBold]}>
                        {t('consultation.upcoming', {
                            who:
                                item.consultationType === ConsultationTypeEnum.CARE_MANAGER
                                    ? t('consultation.careManager')
                                    : t('consultation.expert'),
                            name: item.consultatorId.name,
                            date: convertDateToIST(item.preferred_consultation_date),
                        })}
                    </Text>
                </LinearGradient>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            <View
                style={[{
                    backgroundColor: colors.darkPurple,
                }, styles.header]}
            >
                <Text style={[styles.headerLabel, globalStyles.fontRegular]}>
                    {t('consultation.banner.heading')}
                </Text>
                <Text style={[styles.headerTitle, globalStyles.fontSemiBold]}>
                    {item.consultatorId.name} · {convertDateToIST(item.preferred_consultation_date)}
                </Text>
            </View>

            <View style={styles.body}>
                {item.preferred_slot && (
                    <View style={styles.metaRow}>
                        <Lucide name="clock" size={15} color={colors.darkGray} />
                        <Text style={[styles.metaText, globalStyles.fontRegular]}>
                            {t('consultation.banner.preferredSlot', {
                                slot: t(PREFERRED_SLOT_LABEL_KEYS[item.preferred_slot]),
                            })}
                        </Text>
                    </View>
                )}

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
                ) : (
                    <View style={styles.metaRow}>
                        <Lucide name="hourglass" size={15} color={colors.warning} />
                        <Text style={[styles.metaText, globalStyles.fontRegular]}>
                            {t('consultation.banner.awaitingConfirmation')}
                        </Text>
                    </View>
                )}

                {/* A time is set but the room was never minted — ops will paste one in, so
                    promise the link rather than showing a button that cannot work. */}
                {item.meeting_confirmed_at && !item.meeting_link ? (
                    <Text style={[styles.helper, globalStyles.fontRegular]}>
                        {t('consultation.banner.linkComingSoon')}
                    </Text>
                ) : (
                    <>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            disabled={!canJoin}
                            onPress={() => {
                                if (!item.meeting_link) return;
                                track(AnalyticsEvent.CONSULTATION_JOINED, {
                                    consultation_type: toAnalyticsConsultationType(
                                        item.consultationType,
                                    ),
                                });
                                Linking.openURL(item.meeting_link);
                            }}
                            style={[styles.joinButton, !canJoin && styles.joinButtonDisabled]}
                        >
                            <Lucide
                                name="video"
                                size={18}
                                color={canJoin ? colors.white : colors.gray}
                            />
                            <Text
                                style={[
                                    styles.joinButtonText,
                                    !canJoin && styles.joinButtonTextDisabled,
                                    globalStyles.fontSemiBold,
                                ]}
                            >
                                {t('consultation.banner.joinNow')}
                            </Text>
                        </TouchableOpacity>

                        <Text style={[styles.helper, globalStyles.fontRegular]}>
                            {canJoin
                                ? t('consultation.banner.browserHint')
                                : item.joinUnlocksAt
                                    ? t('consultation.banner.joinOpensAt', {
                                        time: formatTime(item.joinUnlocksAt),
                                    })
                                    : t('consultation.banner.joinOpensBefore')}
                        </Text>
                    </>
                )}

                <View style={styles.divider} />

                <Text style={[styles.modifyPrompt, globalStyles.fontRegular]}>
                    {t('consultation.banner.modifyPrompt')}
                </Text>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={openWhatsApp}
                    style={styles.whatsappButton}
                >
                    <Lucide name="message-circle" size={16} color={colors.darkPurple} />
                    <Text style={[styles.whatsappButtonText, globalStyles.fontSemiBold]}>
                        {t('consultation.banner.modifyCta')}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 12,
        marginHorizontal: 2,
        backgroundColor: colors.white,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    header: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    headerLabel: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.85)',
        marginBottom: 2,
    },
    headerTitle: {
        fontSize: 15,
        color: colors.white,
    },
    body: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 8,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    metaText: {
        fontSize: 13,
        color: colors.darkGray,
        flexShrink: 1,
    },
    confirmedText: {
        fontSize: 13,
        color: colors.success,
        flexShrink: 1,
    },
    joinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.darkPurple,
        borderRadius: 25,
        paddingVertical: 12,
        marginTop: 4,
    },
    joinButtonDisabled: {
        backgroundColor: colors.lightGray,
    },
    joinButtonText: {
        fontSize: 15,
        color: colors.white,
    },
    joinButtonTextDisabled: {
        color: colors.gray,
    },
    helper: {
        fontSize: 11,
        color: colors.gray,
        textAlign: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 6,
    },
    modifyPrompt: {
        fontSize: 12,
        color: colors.darkGray,
    },
    whatsappButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderColor: colors.purple,
        borderRadius: 25,
        paddingVertical: 10,
    },
    whatsappButtonText: {
        fontSize: 14,
        color: colors.darkPurple,
    },
    legacyWrapper: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    legacyGradient: {
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
        flex: 1,
        gap: 15,
    },
    legacyText: {
        fontSize: 14,
        flexShrink: 1,
        color: colors.white,
    },
});

export default ActiveConsultation
