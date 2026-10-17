import Lucide from '@react-native-vector-icons/lucide';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import Toast from 'react-native-toast-message';

import {
  createCheckout,
  getSubscriptionPlans,
  reconcileCheckout,
  selectFreePlan,
  startFreeTrial,
  verifyCheckout,
  verifyPlayPurchase,
} from '../../api/subscription.api';
import { finishPlayPurchase, purchasePlan } from '../../services/playBilling';
import { useAuth } from '../../context/AuthContext';
import { useSubscriptionContext } from '../../context/SubscriptionContext';
import { syncUserData } from '../../utils/syncUserData';
import { AnalyticsEvent, recordError, track } from '../../analytics';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import {
  BillingMode,
  PlanCode,
  SubscriptionPlan,
  SubscriptionTier,
} from '../../types/entitlements.types';
import { FeatureState, FeaturesTable } from './FeaturesTable';

/**
 * The plan catalog and checkout, driven entirely by the server.
 *
 * Prices, terms and credit counts come from GET /subscription/plans — nothing is
 * hardcoded here, so changing a price is a database update rather than an app release.
 * This replaces the old two-plan monthly/yearly layout, which could not express three
 * fixed-term plans.
 */

/** Paise → whole rupees, for display only. */
const rupees = (paise: number) => Math.round(paise / 100);

/** Per-month equivalent, so three different terms can actually be compared. */
const perMonth = (plan: SubscriptionPlan) => {
  const months = Math.max(1, Math.round(plan.durationDays / 30));
  return Math.round(rupees(plan.amountPaise) / months);
};

/**
 * Display order of the feature table. The fN keys are stable identifiers, not
 * positions — this array is what orders the rows, so a feature can be inserted
 * mid-table without renumbering every locale string. Hence f10 sitting seventh.
 */
const FEATURE_ROWS = [
  'subscription.featureRows.f1',
  'subscription.featureRows.f2',
  'subscription.featureRows.f3',
  'subscription.featureRows.f4',
  'subscription.featureRows.f5',
  'subscription.featureRows.f6',
  'subscription.featureRows.f10',
  'subscription.featureRows.f7',
  'subscription.featureRows.f8',
  'subscription.featureRows.f9',
];

/** Supporting line under each feature. Positional against FEATURE_ROWS. */
const FEATURE_CAPTIONS = [
  'subscription.featureCaptions.f1',
  'subscription.featureCaptions.f2',
  'subscription.featureCaptions.f3',
  'subscription.featureCaptions.f4',
  'subscription.featureCaptions.f5',
  'subscription.featureCaptions.f6',
  'subscription.featureCaptions.f10',
  'subscription.featureCaptions.f7',
  'subscription.featureCaptions.f8',
  'subscription.featureCaptions.f9',
];

/**
 * Positional against FEATURE_ROWS. Lite differs only at indices 6 and 7 — f10 (the
 * certified postpartum counsellor) and f7 (specialist consultations) — which it grants
 * without credits. Those are not absent from the plan, so they are marked
 * pay-per-session rather than crossed out.
 */
const FEATURES_MATRIX: Record<string, FeatureState[]> = {
  [PlanCode.LITE]: [
    true, true, true, true, true, true,
    'PAY_PER_SESSION',
    'PAY_PER_SESSION',
    true, true,
  ],
  [PlanCode.MONTHLY]: [true, true, true, true, true, true, true, true, true, true],
  [PlanCode.QUARTERLY]: [true, true, true, true, true, true, true, true, true, true],
  [PlanCode.HALF_YEARLY]: [true, true, true, true, true, true, true, true, true, true],
};

/** A group heading with a rule running out to the right of it. */
const SectionLabel: React.FC<{ text: string; accent?: boolean }> = ({ text, accent }) => (
  <View style={styles.sectionLabelRow}>
    <Text
      style={[
        globalStyles.fontBold,
        styles.sectionLabelText,
        accent && styles.sectionLabelAccent,
      ]}
    >
      {text}
    </Text>
    <View style={styles.sectionLabelRule} />
  </View>
);

const PlanCatalog: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { isFullyOnboarded, userToken, completeOnboarding } = useAuth();
  const { entitlements, refresh } = useSubscriptionContext();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<'trial' | 'subscribe' | 'free' | null>(null);
  const busy = busyType !== null;
  const [selected, setSelected] = useState<PlanCode | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const catalog = await getSubscriptionPlans();
        setPlans(catalog);
        track(AnalyticsEvent.VIEW_ITEM_LIST, {
          item_list_name: 'subscription_plans',
        });
        // Default to the 6 months plan rather than the cheapest. The fallbacks walk
        // down by code, not by index: Lite sorts first, so a positional guess would
        // land on the one plan we least want preselected.
        const byCode = (code: PlanCode) => catalog.find((p) => p.code === code)?.code;
        setSelected(
          byCode(PlanCode.HALF_YEARLY) ??
          byCode(PlanCode.QUARTERLY) ??
          byCode(PlanCode.MONTHLY) ??
          catalog[0]?.code ??
          null,
        );
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: t('common.error'),
          text2: t('subscription.setupFailed'),
          position: 'bottom',
        });
        // A catalog that will not load is a total block on revenue.
        recordError(error, 'PlanCatalog.getSubscriptionPlans');
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  /**
   * The saving is expressed against the monthly plan's per-month rate — the only
   * comparison that means anything across different term lengths.
   */
  const baselinePerMonth = useMemo(() => {
    const monthly = plans.find((p) => p.code === PlanCode.MONTHLY);
    return monthly ? perMonth(monthly) : null;
  }, [plans]);

  /**
   * The catalog is sold as two propositions, not one ladder: Lite, and the
   * credit-bearing Signature plans. Splitting here rather than in the render keeps the
   * order the server chose within each group.
   */
  const litePlans = useMemo(
    () => plans.filter((p) => p.code === PlanCode.LITE),
    [plans],
  );
  const signaturePlans = useMemo(
    () => plans.filter((p) => p.code !== PlanCode.LITE),
    [plans],
  );

  const selectedPlanAdapter = useMemo(() => {
    if (!selected) return null;
    const plan = plans.find((p) => p.code === selected);
    if (!plan) return null;
    return {
      id: plan.code,
      title: plan.displayName,
      monthlyPrice: 0,
      yearlyPrice: 0,
      yearlyLabel: '',
    };
  }, [selected, plans]);

  const canStartTrial = entitlements?.hasUsedTrial === false;
  /**
   * Only offered alongside the trial. Once the trial is spent, "continue with the free
   * app" is what the user is already doing, so the link has nothing to do.
   */
  const showFreeLink =
    canStartTrial && entitlements?.tier === SubscriptionTier.FREE;
  const isAutopay =
    entitlements?.billingModeForNewSubscriptions === BillingMode.AUTOPAY;

  const finish = useCallback(async () => {
    if (userToken) {
      await syncUserData(userToken);
    }
    await refresh();

    const wasAlreadyOnboarded = isFullyOnboarded();

    if (wasAlreadyOnboarded) {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } else {
      // The referral screen is now UPSTREAM of this one — she has already been asked
      // for a code. This is the end of onboarding; navigating forward to ReferralCode
      // would loop her back through a step she has passed.
      await completeOnboarding();
    }
  }, [refresh, isFullyOnboarded, navigation, userToken, completeOnboarding]);

  const handleStartTrial = useCallback(async () => {
    setBusyType('trial');
    try {
      await startFreeTrial();
      track(AnalyticsEvent.TRIAL_STARTED);
      await finish();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('subscription.setupFailed'),
        position: 'bottom',
      });
      recordError(error, 'PlanCatalog.startFreeTrial');
    } finally {
      setBusyType(null);
    }
  }, [finish, t]);

  const handleContinueFree = useCallback(async () => {
    setBusyType('free');
    try {
      await selectFreePlan();
      track(AnalyticsEvent.FREE_PLAN_SELECTED);
      await finish();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('subscription.setupFailed'),
        position: 'bottom',
      });
      recordError(error, 'PlanCatalog.selectFreePlan');
    } finally {
      setBusyType(null);
    }
  }, [finish, t]);

  /**
   * Google Play rail.
   *
   * Shorter than the Razorpay path because Play owns more of it: there is no order to
   * create, no signature to pass along, and no reconcile fallback — a purchase the app
   * fails to report stays in Play's queue and is picked up on the next launch.
   */
  const subscribeViaPlay = useCallback(async () => {
    if (!selected) return;

    const plan = plans.find(p => p.code === selected);
    const productId = plan?.playProductId;
    const accountId = entitlements?.playAccountId;

    // Both come from the server. Missing means the Play product mapping migration has
    // not run on this deployment, which is a deployment fault rather than a user one —
    // fail loudly here rather than opening a sheet that cannot complete.
    if (!plan || !productId || !accountId) {
      throw new Error(
        `Plan ${selected} has no Play product mapped (productId=${productId ?? 'null'})`,
      );
    }

    track(AnalyticsEvent.BEGIN_CHECKOUT, {
      item_id: selected,
      value: plan.amountPaise / 100,
      currency: 'INR',
    });

    const purchase = await purchasePlan({
      productId,
      basePlanId: plan.playBasePlanId,
      accountId,
    });

    // The server is the only party that can ask Google what was actually bought. A
    // client-side "purchase succeeded" is forgeable, so nothing is granted until this
    // returns.
    await verifyPlayPurchase({
      purchaseToken: purchase.purchaseToken,
      productId: purchase.productId,
    });

    track(AnalyticsEvent.PURCHASE, {
      transaction_id: purchase.purchaseToken,
      value: plan.amountPaise / 100,
      currency: 'INR',
      items: [{ item_id: selected, item_name: selected }],
    });

    // Only now. Finishing before verification would drop the purchase from Play's queue
    // while Google still considers it delivered — the user is charged and nothing
    // replays it. Left unfinished, the next launch recovers it.
    await finishPlayPurchase(purchase.raw);

    await finish();
  }, [selected, plans, entitlements, finish]);

  const handleSubscribe = useCallback(async () => {
    if (!selected) return;

    // Play is a wholly different rail, not a variation on the Razorpay one, so it gets
    // its own path rather than a set of conditionals threaded through this handler.
    if (entitlements?.billingModeForNewSubscriptions === BillingMode.PLAY) {
      setBusyType('subscribe');
      try {
        await subscribeViaPlay();
      } catch (error: any) {
        // Closing the Play sheet is a decision, not a fault. Recorded as an outcome so
        // the drop-off stays visible, never as an error.
        const serverCode = error?.response?.data?.data?.code;

        if (error?.code === 'USER_CANCELLED') {
          track(AnalyticsEvent.CHECKOUT_FAILED, {
            reason: 'play_cancelled',
            item_id: selected,
          });
        } else if (serverCode === 'PLAY_PURCHASE_PENDING') {
          // Not a failure. UPI purchases sit unconfirmed for anything from seconds to
          // minutes, which on this market is the common case rather than the edge one,
          // and Google has the money in hand the whole time. Saying "failed" here invites
          // the user to pay a second time for a subscription they already bought.
          //
          // Nothing more to do from this screen: the purchase stays unacknowledged, so
          // the reconcile sweep picks it up on the next foreground and activates it.
          Toast.show({
            type: 'info',
            text1: t('subscription.paymentPendingTitle'),
            text2: t('subscription.paymentPendingMessage'),
            position: 'bottom',
            visibilityTime: 6000,
          });
          track(AnalyticsEvent.CHECKOUT_FAILED, {
            reason: 'play_pending',
            item_id: selected,
          });
        } else {
          Toast.show({
            type: 'error',
            text1: t('common.error'),
            text2: t('subscription.setupFailed'),
            position: 'bottom',
          });
          track(AnalyticsEvent.CHECKOUT_FAILED, {
            reason: error?.code ?? 'play_failed',
            item_id: selected,
          });
          recordError(error, 'PlanCatalog.subscribeViaPlay', {
            plan_code: selected,
            play_code: error?.code ?? 'none',
          });
        }
      } finally {
        setBusyType(null);
      }
      return;
    }

    setBusyType('subscribe');

    // Held outside the try so the error path can still reconcile against it: the SDK can
    // reject AFTER the payment is captured, and we must not lose the order reference.
    let orderId: string | null = null;

    try {
      // Only the plan code goes up. The server derives the amount, so the client
      // cannot influence what is charged.
      const checkout = await createCheckout(selected);
      orderId = checkout.providerOrderId;

      track(AnalyticsEvent.BEGIN_CHECKOUT, {
        item_id: selected,
        value: checkout.amountPaise / 100,
        currency: checkout.currency,
      });

      const result = await RazorpayCheckout.open({
        key: checkout.providerKeyId,
        order_id: checkout.providerOrderId,
        amount: checkout.amountPaise,
        currency: checkout.currency,
        name: 'VivaMama',
        description: t('subscription.choosePlan'),
        theme: { color: colors.purple },
      });

      await verifyCheckout({
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });

      // Only after the server has verified the signature. Firing on the Razorpay
      // sheet resolving alone would count payments that never actually settled,
      // and this event drives revenue reporting and store attribution.
      track(AnalyticsEvent.PURCHASE, {
        transaction_id: result.razorpay_payment_id,
        value: checkout.amountPaise / 100,
        currency: checkout.currency,
        items: [{ item_id: selected, item_name: selected }],
      });

      await finish();
    } catch (error: any) {
      // A user who deliberately closed the sheet did not pay — nothing to recover.
      const cancelled = error?.code === 0 || error?.code === 2;

      // Otherwise the sheet errored, which does NOT mean the payment failed: on UPI it
      // can reject after the charge was already captured. Ask the server to confirm
      // with Razorpay directly and activate if the money actually moved, so a real
      // payment is never silently lost.
      if (cancelled) {
        // Closing the sheet is a decision, not a fault. Logged as an outcome so
        // the drop-off is visible, but never recorded as an error.
        track(AnalyticsEvent.CHECKOUT_FAILED, {
          reason: 'razorpay_cancelled',
          item_id: selected,
        });
      }

      if (!cancelled && orderId) {
        try {
          const { activated } = await reconcileCheckout(orderId);
          track(AnalyticsEvent.CHECKOUT_RECONCILED, { activated });
          if (activated) {
            await finish();
            return;
          }
        } catch (reconcileError) {
          // fall through to the generic error below
          recordError(reconcileError, 'PlanCatalog.reconcileCheckout', {
            order_id: orderId,
          });
        }
      }

      if (!cancelled) {
        Toast.show({
          type: 'error',
          text1: t('common.error'),
          text2: t('subscription.setupFailed'),
          position: 'bottom',
        });
        track(AnalyticsEvent.CHECKOUT_FAILED, {
          reason: orderId ? 'verify_failed' : 'network',
          item_id: selected,
        });
        // A payment that reached Razorpay and then failed verification is the
        // worst outcome in the app — the user may have been charged.
        recordError(error, 'PlanCatalog.handleSubscribe', {
          plan_code: selected,
          order_id: orderId ?? 'none',
        });
      }
    } finally {
      setBusyType(null);
    }
  }, [selected, finish, t, entitlements, subscribeViaPlay]);

  const renderPlanCard = useCallback(
    (plan: SubscriptionPlan) => {
      const isSelected = plan.code === selected;
      const isLite = plan.code === PlanCode.LITE;
      const monthly = perMonth(plan);

      // Lite is deliberately left out of the comparison. Measured against the monthly
      // plan's rate it would claim an ~80% saving, which reads as a discount on the
      // same thing rather than a cheaper, smaller plan.
      const savePercent =
        !isLite && baselinePerMonth && monthly < baselinePerMonth
          ? Math.round((1 - monthly / baselinePerMonth) * 100)
          : 0;

      return (
        <TouchableOpacity
          key={plan.code}
          style={[
            styles.card,
            isLite && styles.cardLite,
            isSelected && styles.cardSelected,
          ]}
          onPress={() => {
            setSelected(plan.code);
            track(AnalyticsEvent.SELECT_ITEM, {
              item_id: plan.code,
              item_list_name: 'subscription_plans',
            });
          }}
          activeOpacity={0.85}
        >
          <View style={styles.cardRow}>
            {/* Left Side: Radio circle, Plan Name, Credits */}
            <View style={styles.cardLeft}>
              <View style={[styles.radio, isSelected && styles.radioSelected]} />
              <View style={styles.planDetails}>
                <View style={styles.planNameRow}>
                  <Text style={[globalStyles.fontSemiBold, styles.planName]}>
                    {plan.displayName}
                  </Text>
                  {isLite ? (
                    <View style={styles.budgetBadge}>
                      <Text style={[globalStyles.fontBold, styles.budgetBadgeText]}>
                        {t('subscription.budgetFriendly')}
                      </Text>
                    </View>
                  ) : null}
                  {plan.code === PlanCode.HALF_YEARLY ? (
                    <View style={styles.bestValueBadge}>
                      <Text style={[globalStyles.fontBold, styles.bestValueBadgeText]}>
                        {t('subscription.bestValue')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[globalStyles.fontRegular, styles.planSubtext]} numberOfLines={2}>
                  {/* creditsSplit would read "0 expert consultations + 0 counsellor
                      callbacks" here, which sells the plan on what it lacks. */}
                  {isLite
                    ? t('subscription.liteSubtext')
                    : t('subscription.creditsSplit', {
                      expert: plan.credits.expert,
                      expertPlural: plan.credits.expert === 1 ? '' : 's',
                      care: plan.credits.careManager,
                      carePlural: plan.credits.careManager === 1 ? '' : 's',
                    })}
                </Text>
              </View>
            </View>

            {/* Right Side: Price, Save Badge, Per-Month */}
            <View style={styles.cardRight}>
              <View style={styles.priceRow}>
                {savePercent > 0 ? (
                  <View style={styles.saveBadge}>
                    <Text style={[globalStyles.fontBold, styles.saveBadgeText]}>
                      {t('subscription.saveBadge', { percent: savePercent })}
                    </Text>
                  </View>
                ) : null}
                <Text style={[globalStyles.fontBold, styles.price]}>
                  ₹{rupees(plan.amountPaise)}
                </Text>
              </View>
              <Text style={[globalStyles.fontRegular, styles.perMonth]}>
                {t('subscription.perMonthEquivalent', { amount: monthly })}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [selected, baselinePerMonth, t],
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.purple} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[globalStyles.fontBold, styles.heading]}>{t('subscription.choosePlan')}</Text>

        {canStartTrial ? (
          <View style={styles.trialBanner}>
            <View style={styles.trialBannerIcon}>
              <Lucide name="percent" size={14} color={colors.white} />
            </View>
            <Text style={[globalStyles.fontRegular, styles.trialBannerText]}>
              {/* The promise has to match the rail we are actually on. Under MANUAL
                  there is no card on file, so "cancel anytime" would be meaningless
                  and "you won't be charged" misleading. */}
              {isAutopay
                ? t('subscription.trialAutopay')
                : t('subscription.trialNoCard')}
            </Text>
          </View>
        ) : null}

        {litePlans.length ? (
          <>
            <SectionLabel text={t('subscription.groupLite')} />
            {litePlans.map(renderPlanCard)}
          </>
        ) : null}

        {signaturePlans.length ? (
          <>
            <SectionLabel text={t('subscription.groupSignature')} accent />
            {signaturePlans.map(renderPlanCard)}
          </>
        ) : null}

        <FeaturesTable
          selectedPlan={selectedPlanAdapter}
          featureRows={FEATURE_ROWS}
          featureCaptions={FEATURE_CAPTIONS}
          featuresMatrix={FEATURES_MATRIX}
        />
      </ScrollView>

      <View style={styles.actions}>
        {/* Paying is the one primary action. The trial and the free tier are the
            alternatives to it, so they sit below as links rather than competing
            for the same visual weight. */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSubscribe}
          disabled={busy || !selected}
        >
          {busyType === 'subscribe' ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={[globalStyles.fontBold, styles.primaryButtonText]}>
              {t('subscription.continueToPay', {
                price: selected
                  ? rupees(plans.find((p) => p.code === selected)?.amountPaise ?? 0)
                  : 0,
              })}
            </Text>
          )}
        </TouchableOpacity>

        {canStartTrial ? (
          <>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleStartTrial}
              disabled={busy}
            >
              {busyType === 'trial' ? (
                <ActivityIndicator color={colors.purple} />
              ) : (
                <Text style={[globalStyles.fontBold, styles.secondaryButtonText]}>
                  {t('subscription.startFreeTrial')}
                </Text>
              )}
            </TouchableOpacity>

            {showFreeLink ? (
              <View style={styles.linkRow}>
                <TouchableOpacity onPress={handleContinueFree} disabled={busy}>
                  {busyType === 'free' ? (
                    <ActivityIndicator size="small" color={colors.darkGray} />
                  ) : (
                    <Text style={[globalStyles.fontRegular, styles.link]}>
                      {t('subscription.continueFree')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 12 },
  heading: {
    fontSize: 24,
    color: colors.text,
    marginBottom: 16,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.lightPurple,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  trialBannerText: { flex: 1, color: colors.darkPurple, fontSize: 13 },
  trialBannerIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 10,
  },
  sectionLabelText: {
    fontSize: 12,
    letterSpacing: 1,
    color: colors.gray,
    textTransform: 'uppercase',
  },
  sectionLabelAccent: { color: colors.purple },
  sectionLabelRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  card: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  // Dashed to set Lite apart from the credit-bearing plans at a glance, without
  // making it look disabled.
  cardLite: { borderStyle: 'dashed' },
  cardSelected: {
    borderColor: colors.purple,
    backgroundColor: colors.SubscriptionOptionsBG,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1.3,
  },
  planDetails: {
    flex: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.mediumGray,
  },
  radioSelected: {
    borderColor: colors.purple,
    backgroundColor: colors.purple,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  planName: { fontSize: 15, color: colors.text },
  planSubtext: { fontSize: 11, color: colors.darkGray, marginTop: 2 },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveBadge: {
    backgroundColor: colors.greenBadgeBG,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  saveBadgeText: {
    color: colors.greenBadgeText,
    fontSize: 10,
  },
  price: {
    fontSize: 18,
    color: colors.text,
  },
  perMonth: { fontSize: 12, color: colors.darkGray, marginTop: 1 },
  bestValueBadge: {
    backgroundColor: colors.yellowBadgeBG,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  bestValueBadgeText: {
    color: colors.yellowBadgeText,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  budgetBadge: {
    backgroundColor: colors.lightGray,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  budgetBadgeText: {
    color: colors.darkGray,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  footnote: {
    fontSize: 12,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 8,
  },
  actions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryButton: {
    backgroundColor: colors.purple,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.white, fontSize: 16 },
  secondaryButton: {
    backgroundColor: colors.white,
    borderColor: colors.purple,
    borderWidth: 1.5,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: { color: colors.purple, fontSize: 16 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 14,
    minHeight: 34,
  },
  link: {
    color: colors.darkGray,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  linkSeparator: { color: colors.gray, fontSize: 14 },
});

export default PlanCatalog;
