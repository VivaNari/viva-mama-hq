# B2 — Google Play Billing implementation plan

*Written 2026-08-14. Companion to §12.3 of `PLAY_STORE_COMPLIANCE_AUDIT.md`.*

**Decision:** Google Play Billing for subscriptions. Razorpay retired on that rail only, and kept for per-session consultation fees, which sit outside Play Billing under the real-world-services carve-out. User Choice Billing was evaluated and rejected — see §12.3.

---

## 1. What does *not* change

The exploration finding that sets the scope. The backend was built with a payment-rail seam already in place, and entitlement resolution never reads payment state:

- `EntitlementService.resolveTier` derives tier from `tier` + dates only, never `status` or provider
- `ISubscription` already carries `billingMode` and `provider` per row, stamped at creation and never rewritten
- `getBillingProvider(mode)` already dispatches on the **row's** mode, not the env value
- `webhook_events` already exists with idempotency, built for Razorpay's redeliveries
- Credits, usage counters, the lifecycle cron, the paywall, `MySubscription.tsx` — all sit above the seam

So this is **an additional rail, not a rewrite**. Nothing in entitlements, credits, quotas or the consultation flow is touched.

**Existing Razorpay subscribers are not migrated.** Their rows keep `billingMode: MANUAL` and run to `currentPeriodEnd` on the existing code path. Only new purchases go to Play. Forced migration is unnecessary and would be the riskiest part of the change.

---

## 2. The seam problem, and the decision

`IBillingProvider` is Razorpay-shaped in three places, and Play does not fit any of them:

| Interface member | Razorpay | Google Play |
|---|---|---|
| `createCheckout()` → `{ providerOrderId, amountPaise, currency, providerKeyId }` | Server creates the order, client opens a sheet with it | **No server-created order exists.** The client launches the billing flow with a product id; the server first hears about it after payment |
| `IVerificationInput` = `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` | HMAC verified locally | A single opaque **`purchaseToken`**, verified by calling Google |
| `verify()` | Signature check, no network | `purchases.subscriptionsv2.get` — a network call that is also the source of truth for dates |

**Decision: add a parallel rail rather than widen the shared interface.**

Turning `IVerificationInput` into a discriminated union would touch every existing Razorpay call site and the consultation rail that shares `paymentOrderModel`. The consultation flow is live, correct, and out of scope. Widening it to accommodate a rail with a fundamentally different shape buys nothing and risks a working payment path.

Concretely:

- `EBillingMode.PLAY` and `EBillingProvider.GOOGLE_PLAY` are added to the enums, so every row still records how it was bought and `getBillingProvider` keeps its "read the row, not the env" discipline
- `GooglePlayProvider` is registered in the factory and implements **`cancel()` only**. `createCheckout()` and `verify()` throw `RAIL_NOT_SUPPORTED`. Registering it matters because account deletion (M10) and the lifecycle cron resolve a provider from the row's mode and must not blow up on a Play row
- Play verification and activation live on their own service methods and their own endpoint, not inside `activatePaid`

---

## 3. Play is the source of truth for dates

The single most important rule in this change.

`activateFromPaidOrder` computes `currentPeriodEnd = addDays(baseDate, plan.durationDays)`. **The Play path must not do this.** Google owns the billing calendar: free-trial length, grace periods, account hold, pauses, and its own proration on upgrades all move the expiry. A locally computed date will drift from what the user sees in the Play app, and the user is right and we are wrong.

The Play activation path reads `lineItems[0].expiryTime` from `subscriptionsv2.get` and stores it verbatim. Every RTDN then re-reads the same field rather than incrementing.

`plan.durationDays` stays in the catalog — it is still correct for the Razorpay rows and for display — but is never used to compute a Play row's dates.

---

## 4. Server work

### 4.1 Types and schema

`src/types/subscription.types.ts`
- `EBillingMode.PLAY = "PLAY"`
- `EBillingProvider.GOOGLE_PLAY = "google_play"`
- `ISubscriptionPlan` gains `playProductId: string | null` and `playBasePlanId: string | null`, mirroring the existing `razorpayPlanId`
- `ISubscription` gains `playPurchaseToken: string | null`

`playPurchaseToken` is not optional polish. **RTDN messages carry only `purchaseToken` and `subscriptionId` — no user id** — so it is the only way to find the row a notification belongs to. Index it.

`src/models/schema/subscription-plan.schema.ts`, `subscription.schema.ts` — same fields. Migration step to backfill `playProductId` on the four plans, following `seed-subscription-plans.step.ts`.

### 4.2 `src/services/subscription/billing/google-play.provider.ts` (new)

Uses `google-auth-library` (**already a dependency**, v10.4.0) with a `JWT` client scoped to `https://www.googleapis.com/auth/androidpublisher`, reading `PLAY_DEVELOPER_SA_KEY_JSON` from the environment. Calls the REST API directly — do **not** add `googleapis`, which is enormous for three endpoints.

Methods:
- `getSubscription(purchaseToken)` → `GET /androidpublisher/v3/applications/{pkg}/purchases/subscriptionsv2/tokens/{token}`
- `acknowledge(purchaseToken, productId)` → `POST .../purchases/subscriptions/{sub}/tokens/{token}:acknowledge`
- `cancel(subscription)` → `POST .../:cancel` (interface method; see §4.5 for why the app does not call it)

⚠️ **Acknowledge within 3 days or Google automatically refunds the purchase.** Acknowledge server-side inside the verify handler, immediately after activation succeeds, never on the client. This is the single most common way a Play integration silently loses money.

### 4.3 `SubscriptionService.activateFromPlayPurchase()`

New method, mirroring `activateFromPaidOrder` but with Play semantics:

1. Call `getSubscription(purchaseToken)`
2. Reject unless `subscriptionState` is `ACTIVE` or `IN_GRACE_PERIOD`
3. Map `lineItems[0].productId` + `offerDetails.basePlanId` → `EPlanCode` via the new plan fields. **An unmapped product is an error, not a default** — silently granting the cheapest plan on a mapping typo is how users get the wrong tier
4. Verify `externalAccountIdentifiers.obfuscatedExternalAccountId` matches the calling user, when present (§5.2)
5. **Idempotency:** if a live row already exists with this `playPurchaseToken`, return it unchanged
6. `closeCurrent(userId, EXPIRED)`, then create the new row with `currentPeriodEnd = lineItems[0].expiryTime`, `billingMode: PLAY`, `provider: GOOGLE_PLAY`, `playPurchaseToken`
7. Grant credits from the plan — unchanged from the existing path
8. `acknowledge()` **after** the row is committed. Acknowledging before means a crash mid-activation leaves a purchase Google considers settled and we have no record of
9. Sync the user snapshot, emit analytics

No `paymentOrderModel` row is created. That collection models a server-created order; Play has none. Purchase history for a Play row lives in Google's records and in the subscription row itself.

### 4.4 `POST /api/v1/subscription/play/verify`

Body: `{ purchaseToken: string, productId: string }`. Authed. Returns `{ entitlements }`, matching the shape `verifyCheckout` already returns so the client's success path is unchanged.

Validator alongside the existing subscription validators. Rate-limited.

### 4.5 `cancel()` on the Play rail

Play requires that users can cancel, and the Play subscription centre is where they do it. The app's cancel action **deep-links out**; it does not call our cancel endpoint.

`GooglePlayProvider.cancel()` still exists because account deletion (**M10**) must stop billing a deleted user, and that is a server-initiated cancel with no user present. Wire M10 to call `getBillingProvider(row.billingMode).cancel(row)` before the `deleteMany`, tolerating a provider failure so deletion still completes.

The local row is **not** marked cancelled by the app. It transitions when RTDN says so — otherwise the app and Play disagree about a state Play owns.

### 4.6 RTDN consumer — `POST /api/v1/webhooks/play/rtdn`

A Pub/Sub **push** endpoint. Body is `{ message: { data: <base64>, messageId } }`; decode to a `DeveloperNotification`.

- **Authenticate the push.** Verify the OIDC bearer token Pub/Sub attaches, against the service account configured on the subscription. An unauthenticated RTDN endpoint lets anyone grant themselves PREMIUM
- **Idempotency** via the existing `webhook_events` collection, keyed on `messageId`. Google redelivers
- **Always 200**, even on an unmapped notification type. A non-2xx makes Pub/Sub retry forever

Handle:

| `notificationType` | Action |
|---|---|
| `SUBSCRIPTION_PURCHASED` (4) | Activate if not already — covers a client that died before calling verify |
| `SUBSCRIPTION_RENEWED` (2) | Re-read `expiryTime`, extend the row, **grant the next period's credits** |
| `SUBSCRIPTION_CANCELED` (3) | `status: CANCELLED`, `cancelledAt`. **Do not touch dates** — access runs to `expiryTime`, exactly as `LIVE_STATUSES` already assumes |
| `SUBSCRIPTION_IN_GRACE_PERIOD` (6) | `status: HALTED`. Access continues |
| `SUBSCRIPTION_ON_HOLD` (5) | `status: HALTED`, access ends. Re-read dates |
| `SUBSCRIPTION_EXPIRED` (13) | `expire()` — the existing method |
| `SUBSCRIPTION_REVOKED` (12) | Refund or chargeback. **Expire immediately**, do not wait for the date |
| `SUBSCRIPTION_RESTARTED` (7) | Re-activate from the current Play state |
| `VOIDED_PURCHASE` | Same as revoked |

Every handler re-reads `subscriptionsv2.get` rather than trusting the notification body. The notification is a *signal that something changed*, not a description of the new state.

### 4.7 Config

`PLAY_DEVELOPER_SA_KEY_JSON` and `PLAY_PACKAGE_NAME` in `src/config/env.ts`, following the `GOOGLE_MEET_SA_KEY_JSON` pattern at lines 69–71. Key injected from Secret Manager, never `.env`.

---

## 5. Client work

### 5.1 Library

**`react-native-iap`**, latest. Verify immediately after install that the bundled Play Billing Library is **≥ 8** — Google's floor moved on 31 Aug 2026 — by checking the resolved `com.android.billingclient:billing` version in the Gradle dependency tree, not the README.

> Noted risk: the project is being succeeded by `expo-iap`. That is the better long-term home but needs `expo-modules-core` in a bare RN app, which is not a change to make on the day of a submission. Accept `react-native-iap` now, revisit after launch.

### 5.2 Purchase flow — `PlanCatalog.tsx`

Replace `RazorpayCheckout.open` (line 291) on the subscription path only. `ExpertDetails.tsx` and `useCareManagerBooking.ts` keep Razorpay untouched.

```
connect → getSubscriptions([productIds]) → requestSubscription({
  sku, subscriptionOffers: [{ sku, offerToken }],
  obfuscatedAccountIdAndroid: <hash of user id>
})
→ purchaseUpdatedListener fires
→ POST /subscription/play/verify { purchaseToken, productId }
→ refresh() + syncUserData()
→ finishTransaction({ purchase, isConsumable: false })
```

**`obfuscatedAccountIdAndroid` is required, not optional.** It is what lets §4.3 step 4 reject a purchase token replayed from another account, and what makes an RTDN traceable to a user when the row lookup fails. Send a hash of the user id, never the id itself.

**`finishTransaction` only after the server returns 200.** Finishing first means a network failure loses the purchase from the client queue while Google considers it delivered.

`createCheckout`, `verifyCheckout` and `reconcileCheckout` remain in `subscription.api.ts` for the Razorpay rows still in flight. `reconcileCheckout` has no Play equivalent — Play's own purchase queue plus RTDN cover the same failure.

### 5.3 Restore on launch

`getAvailablePurchases()` on app start; any unacknowledged purchase is re-sent to `/play/verify`. This is what recovers a purchase whose verify call failed, and it is also how a reinstall or a new device regains entitlement. Without it, a user who reinstalls appears unsubscribed while Google keeps charging them.

### 5.4 `MySubscription.tsx`

For `billingMode: PLAY`, the cancel button becomes **Manage in Google Play**, opening:

```
https://play.google.com/store/account/subscriptions?sku=<productId>&package=com.wellnessemporio.vivamama
```

`CancelSubscriptionModal` stays for the Razorpay rows still live. Both paths must remain, because both kinds of row exist simultaneously for months.

Copy changes: renewal is automatic on this rail, so the MANUAL wording ("this plan does not renew automatically") must not show for a Play row.

### 5.5 i18n

New strings in `en.json` and `hi.json`. Parity is currently **664** and must stay equal.

---

## 6. Play Console work

1. **C12** — four subscription products matching `EPlanCode`, each with one base plan, India pricing matching `amountPaise`. Record the product id and base plan id for §4.1
2. **C13** — license testers. Renewals accelerate: a monthly plan renews in ~5 minutes, which is the only practical way to test RTDN
3. **C14** — internal testing track
4. **G6** — Pub/Sub topic, grant `pubsub.publisher` to `google-play-developer-notifications@system.gserviceaccount.com`, then set the topic name in Monetise → Monetisation setup. Push subscription → the Cloud Run RTDN endpoint with OIDC auth

**Trial decision: keep the server-side trial, configure no Play free-trial offer initially.** The 7-day trial is built, tested, and `hasUsedTrial` is enforced per user forever. Moving it into Play means Google owns trial eligibility, which is better long-term but is a second unfamiliar system to debug on day one. A user finishing a server trial simply buys a Play subscription that starts immediately.

---

## 7. Order of work

**P0 — purchase works end to end.** Everything in §4.1–4.4, §5.1–5.2, Console products and license testers. This is the piece that must be on a track to be testable at all, so it lands first.

**P1 — the lifecycle is correct.** §4.6 RTDN, §5.3 restore, M10. Without this, renewals never extend anyone's access and refunds never revoke it.

**P2 — the edges.** Upgrade/downgrade via `linkedPurchaseToken` (Play issues a new token and links it to the old one; without handling it an upgrade creates a second live row and the partial unique index rejects the insert), pending purchases (`PENDING` state for India's slower payment methods — **common on UPI, not an edge case here**), and paused subscriptions.

P0 is a day. P1 is a day. P2 is where the estimate is soft.

---

## 8. Verification

**Server** — new suites alongside `__tests__/subscription.lifecycle.test.ts`, with the Play API stubbed through `__setBillingProviderForTests`:
- verify activates, stores the token, and acknowledges
- replayed purchase token is idempotent
- unmapped product id errors rather than defaulting
- `obfuscatedExternalAccountId` mismatch is rejected
- each RTDN type moves the row correctly; redelivered `messageId` is a no-op
- `SUBSCRIPTION_CANCELED` leaves `currentPeriodEnd` untouched and the user still PREMIUM
- unauthenticated RTDN push is rejected

Full suite must stay green: currently **48 suites / 501 tests**.

**Client** — `tsc --noEmit` at the **46-error baseline**, production bundle builds, en/hi parity equal.

**On device, installed from Play** — nothing below proves anything on a debug build:
1. Buy each of the four plans; entitlements and credits correct
2. Kill the app between purchase and verify; restore on next launch recovers it
3. Accelerated renewal extends access and grants the next period's credits
4. Cancel in Play → app shows cancelled, **premium features still work** until the end date
5. Refund in Console → access revoked immediately
6. Airplane mode mid-purchase → no crash, no lost purchase
7. A live Razorpay row still renders and cancels correctly

---

## 9. Risks

| Risk | Handling |
|---|---|
| **The AAB → upload → install loop**, 15–30 min per iteration | This, not the code, sets the calendar. Batch changes; do not iterate one fix at a time |
| **`versionCode 1` burns on first upload to any track** | Next upload must be `2`. Do not spend it on a knowingly incomplete build |
| **Acknowledge window** — 3 days or auto-refund | Server-side, in the verify handler, after commit |
| **Pending purchases are common in India** (UPI) | P2 in principle, but if UPI testing shows them frequently, promote to P1 |
| **`react-native-razorpay@2.3.1`** declares no AGP 8 namespace and pulls `react-native:+` | Stays for the consultation rail. Already fragile; watch it on the next RN bump |
| **App content must be complete before any track upload** | Phase 2 of §12 gates all device testing here |

---

## 10. Status — 2026-08-14

**P0 and P1 are code-complete and verified.** Server **50 suites / 532 tests**, `tsc` clean; client `tsc` at the **46-error baseline** with no errors in touched files, production bundle building, en/hi parity **667/667**.

Play Billing Library resolves to **9.1.0** via `react-native-iap` 16.3.1 → `openiap-google` 3.3.1 — confirmed from the Gradle dependency tree, not the README.

### Values to substitute once the Console products exist

| What | Where | Placeholder now |
|---|---|---|
| 4 × product id + base plan id | `src/services/subscription/billing/play-products.ts` | `vivamama_lite` / `lite-monthly`, `vivamama_monthly` / `monthly-auto`, `vivamama_quarterly` / `quarterly-auto`, `vivamama_half_yearly` / `half-yearly-auto` |
| `PLAY_DEVELOPER_SA_KEY_JSON` | Secret Manager → Cloud Run env | unset |
| `PLAY_PACKAGE_NAME` | Cloud Run env | defaults to `com.wellnessemporio.vivamama` |
| `PUBSUB_PUSH_SA_EMAIL` | Cloud Run env | unset — **RTDN returns 500 until set**, deliberately |
| `BILLING_MODE=PLAY` | Cloud Run env | `MANUAL` — the switch that moves new purchases onto Play |

Then run the migration (`POST /api/v1/admin/migrate/run-all`) so `add-play-product-ids` maps the catalog.

### Deferred to P2

Upgrade/downgrade via `linkedPurchaseToken`; pending-purchase UI (`PLAY_PURCHASE_PENDING` is returned distinctly by the server but the app currently shows a generic failure — worth promoting if UPI testing shows it often); paused subscriptions beyond the HALTED mapping.

### Two decisions worth re-reading before device testing

1. **`currentPeriodEnd` is copied from Google, never computed.** A test asserts the stored date is Play's `expiryTime` and explicitly *not* `plan.durationDays` from today.
2. **Acknowledge happens last, after the row commits, and its failure is not fatal.** Unacknowledged purchases auto-refund after three days, but losing an activation over a failed acknowledge is worse — the RTDN path re-attempts.
