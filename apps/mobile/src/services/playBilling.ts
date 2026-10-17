import { Platform } from 'react-native';
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from 'react-native-iap';
import type { Purchase, ProductSubscription } from 'react-native-iap';

/**
 * Google Play Billing, wrapped so the rest of the app never touches react-native-iap.
 *
 * The library's purchase API is event-based: `requestPurchase` only *dispatches* the
 * flow, and the outcome arrives later on a listener. Every caller would otherwise have
 * to reimplement that bridge, and get the teardown wrong. `purchasePlan` below turns it
 * into a single awaited call.
 *
 * Razorpay is untouched by this module. It remains the rail for per-session consultation
 * fees, which sit outside Play Billing as real-world services, and for subscription rows
 * bought before this rail existed.
 */

export class PlayBillingError extends Error {
  constructor(
    public readonly code: PlayBillingErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PlayBillingError';
  }
}

export type PlayBillingErrorCode =
  /** The user closed the Play sheet. A decision, not a fault — never report it. */
  | 'USER_CANCELLED'
  /** Play is unavailable: no Play Store, an emulator without it, or a sideloaded build. */
  | 'UNAVAILABLE'
  /** The plan has no Play product mapped, or Play does not know the product id. */
  | 'PRODUCT_NOT_FOUND'
  /** Play returned the product but no offer the user is eligible for. */
  | 'NO_OFFER'
  /** Anything else the store reported. */
  | 'PURCHASE_FAILED';

export interface PlayPurchaseResult {
  /** The opaque token the server exchanges with Google for the real subscription state. */
  purchaseToken: string;
  productId: string;
  /** Held so the caller can finish the transaction only after the server has verified. */
  raw: Purchase;
}

/**
 * Play's own error codes, as react-native-iap surfaces them. Matched loosely on purpose:
 * the string form has changed between library majors and a missed match must degrade to
 * "purchase failed", never to a crash.
 */
function isUserCancellation(error: unknown): boolean {
  const code = String((error as { code?: unknown })?.code ?? '').toLowerCase();
  return code.includes('user-cancel') || code.includes('user_cancel');
}

/**
 * Idempotent. Play's connection can drop while the app is backgrounded — the Play Store
 * updating itself is enough — so this runs before every purchase and every sweep rather
 * than once at startup.
 *
 * There is deliberately no "already connected" memo. One existed and it contradicted the
 * paragraph above: the flag latched true on first success and nothing ever cleared it,
 * so this function could never actually re-establish anything. It was not causing failed
 * purchases only because HybridRnIap.kt calls its own ensureConnection() at the top of
 * fetchProducts, requestPurchase, getAvailablePurchases and finishTransaction — the
 * reconnect that matters happens one layer down, and the memo was buying nothing in
 * exchange for looking like it did.
 */
export async function ensurePlayConnection(): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new PlayBillingError('UNAVAILABLE', 'Play Billing is Android only');
  }

  try {
    await initConnection();
  } catch (error) {
    throw new PlayBillingError(
      'UNAVAILABLE',
      'Could not connect to Google Play Billing',
      error,
    );
  }
}

/**
 * Release the Play connection. Nothing calls this today — holding it is cheap and the
 * native layer reconnects per operation anyway — but it is kept so a caller wanting
 * deterministic teardown has one.
 */
export async function closePlayConnection(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await endConnection();
  } catch {
    // Teardown only. A failure here changes nothing the user can see.
  }
}

/**
 * Launch the Play purchase sheet for one plan and resolve when Google reports the
 * purchase.
 *
 * Resolving does NOT mean the user is entitled. The purchase token still has to be sent
 * to the server, which is the only party that can ask Google what was actually bought —
 * a client-side "success" is trivially forgeable. Nor is the transaction finished here:
 * see `finishPlayPurchase`.
 */
export async function purchasePlan(opts: {
  productId: string;
  /** Selects the offer within the product. Falls back to the first offer if absent. */
  basePlanId: string | null;
  /** From GET /subscription/me. Binds the purchase to this user; see play-account-id.ts. */
  accountId: string;
}): Promise<PlayPurchaseResult> {
  await ensurePlayConnection();

  const products = (await fetchProducts({
    skus: [opts.productId],
    type: 'subs',
  })) as ProductSubscription[] | null;

  const product = products?.find(p => p.id === opts.productId);
  if (!product) {
    throw new PlayBillingError(
      'PRODUCT_NOT_FOUND',
      `Google Play has no subscription product "${opts.productId}"`,
    );
  }

  const offers = product.subscriptionOffers ?? [];
  // Prefer the base plan the catalog names. Falling back to the first offer keeps a
  // purchase possible when the Console has been reorganised and the mapping is stale —
  // wrong price beats no purchase path, and the server re-reads what was actually bought
  // from Google anyway, so the wrong plan cannot be granted.
  const offer =
    offers.find(o => o.basePlanIdAndroid === opts.basePlanId) ?? offers[0];

  if (!offer?.offerTokenAndroid) {
    throw new PlayBillingError(
      'NO_OFFER',
      `No purchasable offer on "${opts.productId}"`,
    );
  }

  return new Promise<PlayPurchaseResult>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      settled = true;
      successSub.remove();
      errorSub.remove();
    };

    const successSub = purchaseUpdatedListener(purchase => {
      if (settled) return;

      // The listener is global: a purchase for a different product would be one the app
      // never asked for here. Leaving it unhandled is correct — restore-on-launch picks
      // it up rather than this call resolving with the wrong thing.
      if (purchase.productId !== opts.productId) return;

      const token = purchase.purchaseToken;
      if (!token) {
        cleanup();
        reject(
          new PlayBillingError(
            'PURCHASE_FAILED',
            'Google Play returned a purchase with no token',
          ),
        );
        return;
      }

      cleanup();
      resolve({ purchaseToken: token, productId: purchase.productId, raw: purchase });
    });

    const errorSub = purchaseErrorListener(error => {
      if (settled) return;
      cleanup();

      reject(
        isUserCancellation(error)
          ? new PlayBillingError('USER_CANCELLED', 'Purchase cancelled', error)
          : new PlayBillingError(
              'PURCHASE_FAILED',
              error?.message ?? 'Google Play could not complete the purchase',
              error,
            ),
      );
    });

    requestPurchase({
      type: 'subs',
      request: {
        google: {
          skus: [opts.productId],
          subscriptionOffers: [
            { sku: opts.productId, offerToken: offer.offerTokenAndroid as string },
          ],
          // Binds the purchase to this account so a token lifted from elsewhere cannot
          // be redeemed here. The server checks it again on the way back in.
          obfuscatedAccountId: opts.accountId,
        },
      },
    }).catch(error => {
      if (settled) return;
      cleanup();
      reject(
        isUserCancellation(error)
          ? new PlayBillingError('USER_CANCELLED', 'Purchase cancelled', error)
          : new PlayBillingError(
              'PURCHASE_FAILED',
              error?.message ?? 'Could not open Google Play',
              error,
            ),
      );
    });
  });
}

/**
 * Remove a purchase from Play's queue.
 *
 * ⚠️ Call this ONLY after the server has confirmed the purchase. Finishing first means a
 * failed verification loses the purchase from the client queue while Google considers it
 * delivered — the user is charged and nothing replays it.
 *
 * `isConsumable: false` because a subscription must not be consumed; consuming would let
 * the same SKU be bought again immediately.
 */
export async function finishPlayPurchase(purchase: Purchase): Promise<void> {
  await finishTransaction({ purchase, isConsumable: false });
}

/**
 * Purchases Google still considers outstanding for this account.
 *
 * Three situations produce one, and all three are ordinary rather than exotic:
 *
 *  - the app was killed, or lost the network, between paying and reporting the token
 *  - a UPI payment settled after the purchase sheet had already gone
 *  - the user reinstalled, or signed in on a new device
 *
 * In every case Google has taken the money and the server knows nothing about it, so
 * without a sweep at launch the user is charged and unsubscribed at the same time. The
 * server is idempotent on the purchase token, so re-reporting one it already has is
 * free.
 *
 * ⚠️ "Outstanding" is narrower than "available". `getAvailablePurchases` returns every
 * subscription the account still owns, and acknowledging one does NOT remove it from
 * that set — unlike consuming a consumable. Reporting everything it returns therefore
 * re-verifies the user's live subscription on every foreground: a POST, a Play Developer
 * API read on the server, and a redundant refetch, forever. It also puts a second verify
 * in flight beside the one the purchase listener is already running, which is what made
 * concurrent activations of the same token routine rather than rare.
 *
 * Acknowledgement is the discriminator. The server acknowledges only after committing
 * the subscription row, so an acknowledged purchase is by construction one it already
 * has. Anything unacknowledged is either genuinely unreported or a purchase whose
 * acknowledgement failed, and both want reporting again.
 */
export async function getOutstandingPlayPurchases(): Promise<PlayPurchaseResult[]> {
  if (Platform.OS !== 'android') return [];

  await ensurePlayConnection();

  const purchases = (await getAvailablePurchases()) as Purchase[] | null;

  return (purchases ?? [])
    .filter(p => Boolean(p.purchaseToken))
    // Absent rather than false counts as unacknowledged on purpose: the field is
    // optional and nullable, and re-reporting a purchase the server already has is
    // harmless, while skipping one it lacks leaves a paying user unsubscribed.
    .filter(
      p =>
        (p as { isAcknowledgedAndroid?: boolean | null }).isAcknowledgedAndroid !==
        true,
    )
    .map(p => ({
      purchaseToken: p.purchaseToken as string,
      productId: p.productId,
      raw: p,
    }));
}
