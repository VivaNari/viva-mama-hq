import React, { useEffect, useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Lucide from '@react-native-vector-icons/lucide';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../public/assets/colors';
import { AnalyticsEvent, trackEvent } from '../../api/analytics.api';
// Aliased: this file talks to both pipelines. `trackEvent`/`AnalyticsEvent` are
// the server-side funnel (which resolves tier itself); `track`/`FirebaseEvent`
// are Firebase. They are independent by design and neither replaces the other —
// the Firebase copies exist so these moments can drive audiences for FCM
// campaigns and Remote Config, which the server pipeline cannot do.
import { AnalyticsEvent as FirebaseEvent, track } from '../../analytics';
import { useSubscriptionContext } from '../../context/SubscriptionContext';
import {
  Capability,
  DenialCode,
  PlanCode,
  SubscriptionTier,
} from '../../types/entitlements.types';

/**
 * One paywall, every entry point.
 *
 * Opens automatically whenever the API layer sees a 402, using the capability and
 * limit the SERVER reported — so the copy always matches the rule that actually fired,
 * and tuning a limit server-side never leaves the app describing the old one.
 */

/** i18n key suffix per capability, so each refusal explains itself concretely. */
const CAPABILITY_COPY: Partial<Record<Capability, string>> = {
  [Capability.AI_CHAT]: 'aiChat',
  [Capability.CHECKIN_WEEKLY]: 'checkin',
  [Capability.CONTENT_WEEKLY_RECOVERY]: 'content',
  [Capability.PRODUCTS_VIEW]: 'products',
  [Capability.COMMUNITY_POST]: 'communityPost',
  [Capability.CONSULTATION_CARE_MANAGER]: 'careManager',
  [Capability.CONSULTATION_EXPERT]: 'expert',
};

interface PaywallSheetProps {
  /** Route the user to the plan catalog. Owned by the navigator. */
  onSeePlans: () => void;
  onStartTrial?: () => void;
}

const PaywallSheet: React.FC<PaywallSheetProps> = ({
  onSeePlans,
  onStartTrial,
}) => {
  const { t } = useTranslation();
  const { denial, dismissPaywall, entitlements } = useSubscriptionContext();

  const insets = useSafeAreaInsets();

  const visible = denial !== null;

  // Reported when the sheet actually becomes visible, not when a 402 arrives — those
  // differ if the user is mid-navigation, and an impression that was never seen would
  // understate every conversion rate computed against it.
  useEffect(() => {
    if (visible) {
      trackEvent(AnalyticsEvent.PAYWALL_SHOWN, denial?.capability, {
        code: denial?.code,
      });
      track(FirebaseEvent.PAYWALL_SHOWN, {
        capability: denial?.capability,
        denial_code: denial?.code,
      });
    }
  }, [visible, denial?.capability, denial?.code]);

  const { title, body } = useMemo(() => {
    const slug = denial?.capability
      ? CAPABILITY_COPY[denial.capability]
      : undefined;

    if (!slug) {
      return {
        title: t('subscription.paywall.genericTitle'),
        body: t('subscription.paywall.genericBody'),
      };
    }

    // A spent daily allowance and a feature the tier never included need different
    // copy: one comes back tomorrow, the other needs a subscription.
    //
    // NO_CREDITS splits the same way. On a credit-bearing plan it means the bucket ran
    // dry, which is the quota story. On Viva Lite — or on no plan at all — there were
    // never any credits to spend, and telling a paying Lite user that consultations
    // "are included with a subscription" would be plainly wrong. They get their own
    // copy pointing at the per-session fee.
    let kind: 'quota' | 'locked' | 'nocredits' = 'locked';
    if (denial?.code === DenialCode.QUOTA_EXCEEDED) {
      kind = 'quota';
    } else if (denial?.code === DenialCode.NO_CREDITS) {
      const planCode = entitlements?.planCode ?? null;
      kind = planCode && planCode !== PlanCode.LITE ? 'quota' : 'nocredits';
    }

    return {
      title: t(`subscription.paywall.${slug}.title`),
      body: t(`subscription.paywall.${slug}.${kind}`, {
        limit: denial?.limit ?? '',
      }),
    };
  }, [denial, entitlements?.planCode, t]);

  // The trial is once per user, forever — never offer it to someone who has used it.
  const canStartTrial =
    entitlements?.hasUsedTrial === false &&
    entitlements?.tier === SubscriptionTier.FREE;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={dismissPaywall}
    >
      <Pressable style={styles.backdrop} onPress={dismissPaywall}>
        {/* Stops a tap inside the sheet from dismissing it. */}
        {/* The sheet is anchored to the bottom of the window, so under enforced
            edge-to-edge its CTA lands under the gesture bar without insets.bottom.
            32 is the design padding; the inset is added on top of it. */}
        <Pressable
          style={[styles.sheet, { paddingBottom: 32 + insets.bottom }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />

          <View style={styles.iconCircle}>
            <Lucide name="lock" size={22} color={colors.purple} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          {denial?.resetAt ? (
            <Text style={styles.reset}>
              {t('subscription.paywall.resetsAt', {
                time: new Date(denial.resetAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
            </Text>
          ) : null}

          {canStartTrial && onStartTrial ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                trackEvent(AnalyticsEvent.PAYWALL_CTA_TAPPED, denial?.capability, {
                  cta: 'start_trial',
                });
                track(FirebaseEvent.PAYWALL_CTA_TAPPED, {
                  capability: denial?.capability,
                  cta: 'start_trial',
                });
                dismissPaywall();
                onStartTrial();
              }}
            >
              <Text style={styles.primaryButtonText}>
                {t('subscription.startFreeTrial')}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                trackEvent(AnalyticsEvent.PAYWALL_CTA_TAPPED, denial?.capability, {
                  cta: 'see_plans',
                });
                track(FirebaseEvent.PAYWALL_CTA_TAPPED, {
                  capability: denial?.capability,
                  cta: 'see_plans',
                });
                dismissPaywall();
                onSeePlans();
              }}
            >
              <Text style={styles.primaryButtonText}>
                {t('subscription.paywall.seePlans')}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={dismissPaywall} style={styles.secondary}>
            <Text style={styles.secondaryText}>
              {t('subscription.paywall.notNow')}
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.lightPurple,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.darkGray,
    textAlign: 'center',
    marginBottom: 8,
  },
  reset: {
    fontSize: 13,
    color: colors.gray,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: colors.purple,
    borderRadius: 28,
    paddingVertical: 15,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 16,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  secondary: {
    paddingVertical: 14,
  },
  secondaryText: {
    color: colors.darkGray,
    fontSize: 15,
  },
});

export default PaywallSheet;
