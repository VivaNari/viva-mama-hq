import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { getEntitlements, verifyPlayPurchase } from '../api/subscription.api';
import { setPaywallHandler } from '../api/paywallEventHandler';
import {
  finishPlayPurchase,
  getOutstandingPlayPurchases,
} from '../services/playBilling';
import {
  Access,
  Capability,
  DenialPayload,
  Entitlements,
  ResolvedCapability,
  SubscriptionTier,
} from '../types/entitlements.types';
import { useAuth } from './AuthContext';
import { recordError, setUserProps, UserProperty } from '../analytics';

interface SubscriptionContextType {
  entitlements: Entitlements | null;
  loading: boolean;
  /** Set when a 402 arrives; drives the paywall sheet. */
  denial: DenialPayload | null;
  tier: SubscriptionTier;
  refresh: () => Promise<void>;
  openPaywall: (denial?: DenialPayload | null) => void;
  dismissPaywall: () => void;
  capability: (name: Capability) => ResolvedCapability | null;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined,
);

export const SubscriptionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { userToken } = useAuth();
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(false);
  const [denial, setDenial] = useState<DenialPayload | null>(null);
  const appState = useRef(AppState.currentState);

  const refresh = useCallback(async () => {
    if (!userToken) {
      setEntitlements(null);
      return;
    }
    setLoading(true);
    try {
      const next = await getEntitlements();
      setEntitlements(next);
      // Tier and billing mode are the two segments almost every report wants to
      // be sliced by, and this is the one place they are authoritative.
      setUserProps({
        [UserProperty.SUBSCRIPTION_TIER]: next?.tier,
        [UserProperty.BILLING_MODE]: next?.billingMode,
      });
    } catch (error) {
      // Deliberately non-fatal. A failed refresh leaves the previous snapshot in
      // place; the server is still the authority and will answer 402 on anything
      // this user is not entitled to, so a stale client cannot grant real access.
      // Still recorded, because silently stale entitlements are exactly the kind
      // of thing we would otherwise never hear about.
      if (__DEV__) {
        console.warn('[Subscription] Failed to refresh entitlements', error);
      }
      recordError(error, 'SubscriptionContext.refresh');
    } finally {
      setLoading(false);
    }
  }, [userToken]);

  /**
   * Report any Play purchase Google still considers outstanding.
   *
   * The client-side purchase flow reports its own token, but only if the app survives
   * long enough to do it. A process death between paying and reporting, a UPI payment
   * that settles after the sheet has gone, or a reinstall on a new device all leave
   * Google holding money the server has never heard about — the user is charged and
   * unsubscribed at once, and nothing else in the system would ever notice.
   *
   * Runs after every entitlement refresh rather than only at launch, because the app
   * also refreshes on foreground, which is exactly when a pending UPI payment tends to
   * have completed.
   *
   * Deliberately quiet. The user did not ask for this and, in the overwhelmingly common
   * case, there is nothing outstanding; a failure here must never surface as an error on
   * a screen the user is looking at.
   */
  const reconcilePlayPurchases = useCallback(async () => {
    if (Platform.OS !== 'android' || !userToken) return;

    try {
      const outstanding = await getOutstandingPlayPurchases();
      if (outstanding.length === 0) return;

      let recovered = false;

      for (const purchase of outstanding) {
        try {
          await verifyPlayPurchase({
            purchaseToken: purchase.purchaseToken,
            productId: purchase.productId,
          });
          // Only once the server has it. Finishing on a failed verification would drop
          // the purchase from Play's queue while Google still considers it delivered.
          await finishPlayPurchase(purchase.raw);
          recovered = true;
        } catch (error) {
          // One bad purchase must not stop the others. A token Google has but the
          // server rejects — a purchase made on another account, most likely — would
          // otherwise block recovery of a legitimate one behind it.
          recordError(error, 'SubscriptionContext.reconcilePlayPurchase', {
            product_id: purchase.productId,
          });
        }
      }

      // Only re-fetch if something actually changed, so the common "nothing pending"
      // case costs one Play query and no network round trip.
      if (recovered) await refresh();
    } catch (error) {
      // Play being unreachable is not an error the user needs to see; it simply means
      // this sweep does nothing until the next foreground.
      recordError(error, 'SubscriptionContext.reconcilePlayPurchases');
    }
  }, [userToken, refresh]);

  // On login and on logout.
  useEffect(() => {
    refresh().then(reconcilePlayPurchases);
  }, [refresh, reconcilePlayPurchases]);

  /**
   * On foreground. A trial can lapse while the app is backgrounded, so the tier the
   * UI is drawing may be hours out of date by the time the user looks at it again.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        if (appState.current.match(/inactive|background/) && next === 'active') {
          refresh().then(reconcilePlayPurchases);
        }
        appState.current = next;
      },
    );
    return () => subscription.remove();
  }, [refresh, reconcilePlayPurchases]);

  /**
   * Any 402 anywhere in the app opens the paywall with the server's own context —
   * one handler instead of per-screen error handling.
   */
  useEffect(() => {
    setPaywallHandler((payload: DenialPayload) => {
      setDenial(payload);
      // The denial means our snapshot disagrees with the server about what this user
      // can do, so pull a fresh one.
      refresh();
    });
    return () => setPaywallHandler(null);
  }, [refresh]);

  const openPaywall = useCallback((payload: DenialPayload | null = null) => {
    setDenial(payload ?? ({} as DenialPayload));
  }, []);

  const dismissPaywall = useCallback(() => setDenial(null), []);

  const capability = useCallback(
    (name: Capability) => entitlements?.capabilities?.[name] ?? null,
    [entitlements],
  );

  const value = useMemo<SubscriptionContextType>(
    () => ({
      entitlements,
      loading,
      denial,
      // Default to FREE until the first fetch lands. Assuming premium and downgrading
      // would flash paid UI at a free user and then snatch it away.
      tier: entitlements?.tier ?? SubscriptionTier.FREE,
      refresh,
      openPaywall,
      dismissPaywall,
      capability,
    }),
    [
      entitlements,
      loading,
      denial,
      refresh,
      openPaywall,
      dismissPaywall,
      capability,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscriptionContext = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error(
      'useSubscriptionContext must be used within a SubscriptionProvider',
    );
  }
  return context;
};

export interface CapabilityState {
  /** False when the tier locks the feature or the allowance is spent. */
  allowed: boolean;
  locked: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  maxChars: number | null;
  resetAt: string | null;
  unlimited: boolean;
  tier: SubscriptionTier;
}

/**
 * Read one capability's live state.
 *
 * Every number comes from the server. Screens must not carry their own copy of a
 * limit, or tuning the funnel would need an app-store release.
 */
export const useCapability = (name: Capability): CapabilityState => {
  const { capability, tier } = useSubscriptionContext();
  const rule = capability(name);

  const unlimited = rule?.limit === null || rule?.limit === undefined;
  const locked = rule?.access === Access.LOCKED;
  const remaining = rule?.remaining ?? null;

  return {
    locked,
    // Unknown (no snapshot yet) is treated as allowed: the server still enforces, and
    // blocking the UI on a slow fetch would be worse than a 402 the user never sees.
    allowed: !locked && (unlimited || (remaining ?? 1) > 0),
    limit: rule?.limit ?? null,
    used: rule?.used ?? 0,
    remaining,
    maxChars: rule?.maxChars ?? null,
    resetAt: rule?.resetAt ?? null,
    unlimited: unlimited && !locked,
    tier,
  };
};

export const useEntitlements = () => useSubscriptionContext().entitlements;
