import Lucide from '@react-native-vector-icons/lucide';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { cancelSubscription, getSubscriptionPlans } from '../api/subscription.api';
import { AnalyticsEvent, recordError, track } from '../analytics';
import CancelSubscriptionModal from '../components/subscriptions/CancelSubscriptionModal';
import { useAuth } from '../context/AuthContext';
import { useSubscriptionContext } from '../context/SubscriptionContext';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { BillingMode, SubscriptionTier } from '../types/entitlements.types';
import { syncUserData } from '../utils/syncUserData';

/**
 * Manage the current subscription — plan, what it costs her nothing to know, and how to
 * stop it.
 *
 * Required by Play's Subscriptions policy: an app selling a subscription must give an
 * in-app way to manage and cancel it, in account settings or an equivalent page. The
 * named violation is exactly its absence.
 *
 * Reads `useSubscriptionContext()` rather than the SQLite user blob that MyProfile's
 * badge uses. The context is refreshed on foreground and is the only place `credits`
 * exists at all.
 */

/** `cancelled` is a live status here — access runs on until the period ends. */
const STATUS_CANCELLED = 'cancelled';
const STATUS_HALTED = 'halted';

/**
 * Part of the Play subscription-centre deep link. Hardcoded rather than read from native
 * config: it is the application id, which is fixed for the lifetime of the listing and
 * cannot change without a new app.
 */
const PACKAGE_NAME = 'com.wellnessemporio.vivamama';

const formatDate = (iso: string | null): string | null =>
    iso
        ? new Date(iso).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
          })
        : null;

const MySubscription: React.FC = () => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const { userToken } = useAuth();
    const { entitlements, loading, refresh } = useSubscriptionContext();

    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [planName, setPlanName] = useState<string | null>(null);
    // Needed to deep-link into the right subscription in the Play app. Loaded alongside
    // the display name from the same call.
    const [playProductId, setPlayProductId] = useState<string | null>(null);

    const planCode = entitlements?.planCode ?? null;

    // The plan's display name is server-owned and already localised there, so it is
    // fetched rather than mapped from the code in app strings. A failure degrades to the
    // raw code, which is ugly but true — better than an empty card.
    useEffect(() => {
        if (!planCode) {
            setPlanName(null);
            setPlayProductId(null);
            return;
        }

        let cancelledEffect = false;

        (async () => {
            try {
                const plans = await getSubscriptionPlans();
                if (cancelledEffect) return;
                const match = plans.find((plan) => plan.code === planCode);
                setPlanName(match?.displayName ?? planCode);
                setPlayProductId(match?.playProductId ?? null);
            } catch (error) {
                if (cancelledEffect) return;
                recordError(error, 'MySubscription.loadPlanName');
                setPlanName(planCode);
                setPlayProductId(null);
            }
        })();

        return () => {
            cancelledEffect = true;
        };
    }, [planCode]);

    const tier = entitlements?.tier ?? SubscriptionTier.FREE;
    const status = entitlements?.status ?? null;
    const billingMode = entitlements?.billingMode ?? null;

    // PREMIUM runs to `currentPeriodEnd`; a trial has none and runs to `trialEndAt`.
    const accessEndsAt = entitlements?.currentPeriodEnd ?? entitlements?.trialEndAt ?? null;
    const accessEndsOn = formatDate(accessEndsAt);

    const isFree = tier === SubscriptionTier.FREE;
    const isAlreadyCancelled = status === STATUS_CANCELLED;
    const isPlay = billingMode === BillingMode.PLAY;

    // Offered whenever something live could still renew or still be stopped. Hidden once
    // cancelled, because tapping it again would ask her to confirm a decision she has
    // already made, and hidden on FREE, where there is nothing to cancel.
    //
    // Never on the Play rail: there, cancelling belongs to Google. See below.
    const canCancel = !isFree && !isAlreadyCancelled && !isPlay;

    /**
     * On the Play rail the app links out instead of cancelling.
     *
     * Two reasons, and the second is the one that matters. Play requires subscription
     * management to be reachable from the app, and its subscription centre is where it
     * expects that to land. But more concretely: cancelling locally without cancelling at
     * Google would leave the two disagreeing about a state Google owns — the row would
     * read cancelled here while Google carried on renewing and charging. The local row
     * changes only when the notification arrives.
     *
     * Shown even once cancelled, because managing is still useful then: resubscribing,
     * or fixing a declined payment method.
     */
    const canManageInPlay = !isFree && isPlay;

    const handleManageInPlay = useCallback(async () => {
        // Without a product id Play opens its subscription list rather than this
        // subscription. Degraded, not broken — better than not opening at all.
        const url = playProductId
            ? `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(
                  playProductId,
              )}&package=${PACKAGE_NAME}`
            : 'https://play.google.com/store/account/subscriptions';

        try {
            await Linking.openURL(url);
        } catch (error) {
            recordError(error, 'MySubscription.manageInPlay');
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: t('mySubscription.playOpenFailed'),
                position: 'bottom',
            });
        }
    }, [playProductId, t]);

    const handleCancel = useCallback(async () => {
        setCancelling(true);
        try {
            const { accessUntil } = await cancelSubscription();

            track(AnalyticsEvent.SUBSCRIPTION_CANCELLED, {
                plan_code: planCode ?? 'NONE',
                billing_mode: billingMode ?? 'NONE',
            });

            // Both stores have to be refreshed. `refresh()` updates the entitlements this
            // screen renders and re-sets the Firebase user properties, which are written
            // nowhere else; `syncUserData` updates the SQLite blob MyProfile's plan badge
            // reads, which would otherwise stay stale until the next app launch.
            await refresh();
            if (userToken) {
                await syncUserData(userToken);
            }

            setShowCancelModal(false);

            const until = formatDate(accessUntil);
            Toast.show({
                type: 'success',
                text1: t('mySubscription.cancelledToastTitle'),
                text2: until
                    ? t('mySubscription.cancelledToastBody', { date: until })
                    : t('mySubscription.cancelledToastBodyNoDate'),
                position: 'bottom',
            });
        } catch (error) {
            recordError(error, 'MySubscription.cancel');
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: t('mySubscription.cancelFailed'),
                position: 'bottom',
            });
        } finally {
            setCancelling(false);
        }
    }, [billingMode, planCode, refresh, t, userToken]);

    if (loading && !entitlements) {
        return (
            <SafeAreaView style={[styles.container, styles.center]} edges={['bottom', 'left', 'right']}>
                <ActivityIndicator size="large" color={colors.purple} />
            </SafeAreaView>
        );
    }

    // No entitlements and not loading means the fetch failed. Falling through would
    // render the free-plan state, which for a paying subscriber is both wrong and
    // alarming — it would tell her the plan she is paying for does not exist and hide
    // the cancel button. Say we could not load it, and offer a retry.
    if (!entitlements) {
        return (
            <SafeAreaView style={[styles.container, styles.center]} edges={['bottom', 'left', 'right']}>
                <View style={styles.errorBlock}>
                    <Lucide name="triangle-alert" size={28} color={colors.darkGray} />
                    <Text style={[styles.errorText, globalStyles.fontRegular]}>
                        {t('mySubscription.loadFailed')}
                    </Text>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        style={styles.primaryButton}
                        onPress={() => refresh()}
                    >
                        <Text style={[styles.primaryButtonText, globalStyles.fontSemiBold]}>
                            {t('common.retry')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            <CancelSubscriptionModal
                visible={showCancelModal}
                submitting={cancelling}
                accessUntil={accessEndsOn}
                billingMode={billingMode}
                onConfirm={handleCancel}
                onDismiss={() => setShowCancelModal(false)}
            />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        {/* A trial carries no planCode — the schema leaves it null until
                            something is bought — so it needs its own name rather than
                            falling through to the generic premium label. */}
                        <Text style={[styles.planName, globalStyles.fontBold]}>
                            {isFree
                                ? t('mySubscription.freePlan')
                                : tier === SubscriptionTier.TRIAL
                                  ? t('mySubscription.trialPlan')
                                  : planName ?? t('mySubscription.premiumPlan')}
                        </Text>

                        {!isFree && (
                            <View
                                style={[
                                    styles.badge,
                                    isAlreadyCancelled && styles.badgeMuted,
                                ]}
                            >
                                <Text style={[styles.badgeText, globalStyles.fontSemiBold]}>
                                    {isAlreadyCancelled
                                        ? t('mySubscription.statusCancelled')
                                        : tier === SubscriptionTier.TRIAL
                                          ? t('mySubscription.statusTrial')
                                          : t('mySubscription.statusActive')}
                                </Text>
                            </View>
                        )}
                    </View>

                    {isFree ? (
                        <Text style={[styles.detail, globalStyles.fontRegular]}>
                            {t('mySubscription.freePlanBody')}
                        </Text>
                    ) : (
                        <>
                            {/* The one line every state has to get right. Cancelled ends
                                on a date without renewing; MANUAL never renews at all;
                                AUTOPAY and PLAY are both going to charge her again.
                                Falling through to "does not renew automatically" on the
                                Play rail would be a plain untruth on the screen whose
                                whole job is telling her what happens next. */}
                            <Text style={[styles.detail, globalStyles.fontRegular]}>
                                {(() => {
                                    if (!accessEndsOn) {
                                        return t('mySubscription.noEndDate');
                                    }
                                    if (isAlreadyCancelled) {
                                        return t('mySubscription.accessUntil', {
                                            date: accessEndsOn,
                                        });
                                    }
                                    if (
                                        billingMode === BillingMode.AUTOPAY ||
                                        billingMode === BillingMode.PLAY
                                    ) {
                                        return t('mySubscription.renewsOn', {
                                            date: accessEndsOn,
                                        });
                                    }
                                    return t('mySubscription.endsOnNoRenewal', {
                                        date: accessEndsOn,
                                    });
                                })()}
                            </Text>

                            {status === STATUS_HALTED && (
                                <View style={styles.noticeBlock}>
                                    <Lucide
                                        name="triangle-alert"
                                        size={16}
                                        color={colors.error}
                                    />
                                    <Text style={[styles.noticeText, globalStyles.fontRegular]}>
                                        {t('mySubscription.haltedNotice')}
                                    </Text>
                                </View>
                            )}
                        </>
                    )}
                </View>

                {/* Credits are part of what the plan bought and the part most easily
                    forgotten. Shown for FREE too, because a lapsed subscriber can still
                    be holding unspent credits. */}
                <View style={styles.card}>
                    <Text style={[styles.sectionTitle, globalStyles.fontSemiBold]}>
                        {t('mySubscription.creditsTitle')}
                    </Text>

                    <View style={styles.creditRow}>
                        <Text style={[styles.creditLabel, globalStyles.fontRegular]}>
                            {t('mySubscription.creditsExpert')}
                        </Text>
                        <Text style={[styles.creditValue, globalStyles.fontSemiBold]}>
                            {entitlements.credits.expert}
                        </Text>
                    </View>

                    <View style={styles.creditRow}>
                        <Text style={[styles.creditLabel, globalStyles.fontRegular]}>
                            {t('mySubscription.creditsCareManager')}
                        </Text>
                        <Text style={[styles.creditValue, globalStyles.fontSemiBold]}>
                            {entitlements.credits.careManager}
                        </Text>
                    </View>
                </View>

                {isFree && (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        style={styles.primaryButton}
                        onPress={() => navigation.navigate('SubscriptionDetails')}
                    >
                        <Text style={[styles.primaryButtonText, globalStyles.fontSemiBold]}>
                            {t('mySubscription.seePlans')}
                        </Text>
                    </TouchableOpacity>
                )}

                {canManageInPlay && (
                    <>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            style={styles.primaryButton}
                            onPress={handleManageInPlay}
                        >
                            <Text style={[styles.primaryButtonText, globalStyles.fontSemiBold]}>
                                {t('mySubscription.manageInPlay')}
                            </Text>
                        </TouchableOpacity>
                        {/* Says where cancelling happens, so the absence of a cancel
                            button here does not read as its absence from the app. */}
                        <Text style={[styles.playHint, globalStyles.fontRegular]}>
                            {t('mySubscription.manageInPlayHint')}
                        </Text>
                    </>
                )}

                {canCancel && (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.cancelButton}
                        onPress={() => setShowCancelModal(true)}
                    >
                        <Text style={[styles.cancelButtonText, globalStyles.fontSemiBold]}>
                            {t('mySubscription.cancelAction')}
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.pageBG,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: colors.white,
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 8,
    },
    planName: {
        fontSize: 18,
        color: colors.text,
        flexShrink: 1,
    },
    badge: {
        backgroundColor: colors.lightPurple,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    badgeMuted: {
        backgroundColor: colors.pageBG,
    },
    badgeText: {
        fontSize: 11,
        color: colors.darkPurple,
    },
    detail: {
        fontSize: 14,
        color: colors.darkGray,
        lineHeight: 20,
    },
    noticeBlock: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
        backgroundColor: '#FDECEC',
        borderRadius: 10,
        padding: 10,
        marginTop: 12,
    },
    noticeText: {
        flex: 1,
        fontSize: 12,
        color: colors.text,
        lineHeight: 17,
    },
    sectionTitle: {
        fontSize: 15,
        color: colors.text,
        marginBottom: 10,
    },
    creditRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    creditLabel: {
        fontSize: 14,
        color: colors.darkGray,
        flexShrink: 1,
    },
    creditValue: {
        fontSize: 16,
        color: colors.darkPurple,
    },
    primaryButton: {
        backgroundColor: colors.darkPurple,
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
    },
    primaryButtonText: {
        fontSize: 16,
        color: colors.white,
    },
    cancelButton: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 15,
        color: colors.error,
    },
    playHint: {
        fontSize: 13,
        lineHeight: 19,
        color: colors.gray,
        textAlign: 'center',
        marginTop: 10,
        paddingHorizontal: 12,
    },
    errorBlock: {
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 32,
    },
    errorText: {
        fontSize: 14,
        color: colors.darkGray,
        textAlign: 'center',
        lineHeight: 20,
    },
});

export default MySubscription;
