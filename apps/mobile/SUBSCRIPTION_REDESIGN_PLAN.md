# Subscription Redesign — Implementation Plan

> Scope: `viva_nari_app` (React Native) + `vivamam_core_server` (Node/Express/Mongo).
> Greenfield — no production users, no legacy data to migrate. Existing test users can be dropped.

---

## 0. Where we are today

The current "subscription" is an onboarding checkbox, not an entitlement system.

- `user.subscription` is a flat sub-doc — `{ plan, status, billingCycle, expiryDate }`
  ([`user.schema.ts:182-199`](../../mern/vivamam_core_server/src/models/schema/user.schema.ts#L182-L199)) — written in
  [`payment.service.ts`](../../mern/vivamam_core_server/src/services/payments/payment.service.ts) and **never read for
  access control anywhere**.
- **Zero enforcement.** `grep -rn "subscription"` across the server returns only the write sites, the schema, and the
  onboarding flag. Every feature route is guarded by `authMiddleware()` alone. A "free" user today has identical access
  to a paying one.
- Plans are **hardcoded in the app** ([`servicesData.ts`](src/data/servicesData.ts)): `Viva Basic` ₹0 /
  `Viva Signature` ₹999–₹10999, monthly/yearly. Changing a price today requires an app-store release.
- Billing is one-time Razorpay Orders: `POST /orders/create` → `RazorpayCheckout.open()` → `POST /orders/verify`
  (HMAC check) → set `subscription.status = 'active'`. No mandate, no webhook, no renewal, no cancellation path.
- Consultations are pay-per-session (`expert.remuneration` → its own order flow in
  [`book-consultation-payment.service.ts`](../../mern/vivamam_core_server/src/services/book-consultation/book-consultation-payment.service.ts)).
  Care-manager callbacks (`POST /callback-request`) are **free and unlimited** for everyone.
- Content and product access is a plain category + week query with no tier awareness at all
  ([`content.controller.ts:25-31`](../../mern/vivamam_core_server/src/api/v1/controllers/contents/content.controller.ts#L25-L31),
  [`product.controller.ts:26-32`](../../mern/vivamam_core_server/src/api/v1/controllers/products/product.controller.ts#L26-L32)).

Consequence: this is not "add a paywall to an existing tier system" — the tier system has to be built from nothing.
The good news is there is no legacy behaviour to preserve.

---

## 1. Two billing flows behind one env toggle

This is the central architectural decision, and it drives everything below.

### 1.1 The two modes

|              | **`MANUAL`** (ship first)                  | **`AUTOPAY`** (ship later)                                          |
| ------------ | ------------------------------------------ | ------------------------------------------------------------------- |
| Trial start  | No payment details collected               | Card saved + Razorpay mandate created                               |
| During trial | Full trial entitlements, 7 days            | Same                                                                |
| Day 7        | Tier flips to `FREE`, hard paywall appears | Razorpay auto-debits; tier flips to `PREMIUM`                       |
| Renewal      | User re-purchases manually each term       | Auto-charged each term until cancelled                              |
| Razorpay API | Orders (one-time) — already integrated     | Subscriptions / Recurring — new work                                |
| Needs        | Nothing new                                | Play Billing policy review, Razorpay recurring activation, webhooks |

`AUTOPAY` is what the requirement describes ("enter the card details / set up autopay … after 7 days automatically
deduct"). `MANUAL` is what you ship now to avoid the Play Store work.

### 1.2 Where the toggle lives — **server-side only**

```
# vivamam_core_server .env
BILLING_MODE=MANUAL        # MANUAL | AUTOPAY
```

Added to [`env.ts`](../../mern/vivamam_core_server/src/config/env.ts) alongside the existing
`RAZORPAY_API_KEY` / `RAZORPAY_SECRET_KEY`.

**The app must not have its own copy of this flag.** The app currently reads `RAZORPAY_API_KEY` from `@env`
([`env.d.ts`](src/types/env.d.ts), [`usePayment.ts:3`](src/hooks/usePayment.ts#L3)) — that pattern must not be repeated
here. If the mode were an app-side build constant, flipping it would need a store release and a staged rollout where
old and new clients disagree with the server. Instead the server returns it:

```jsonc
GET /api/v1/subscription/me
{ "billingMode": "MANUAL", "tier": "TRIAL", ... }
```

and the app renders the trial CTA, the checkout step and the "what happens on day 7" copy from that value. One env flip,
zero releases, no client/server disagreement.

### 1.3 The mode is stamped on the subscription row, not read live

**This is the subtle correctness requirement.** When you flip `BILLING_MODE=AUTOPAY`, users who started a `MANUAL`
trial have no mandate on file. If the day-7 lifecycle job read `env.BILLING_MODE`, it would try to auto-charge them and
fail — or worse, mark them `PREMIUM` without payment.

So `subscriptions.billingMode` is written **at row creation** from the env value, and every downstream decision
(lifecycle job, expiry handling, cancel semantics, app copy) reads the **row**, never the env. The env var only decides
what happens to _new_ subscriptions from this moment on. Existing rows keep the contract they were sold under.

### 1.4 The provider seam

All billing goes through one interface, so the state machine, entitlements, credits and every app screen sit _above_ it
and do not change when you switch modes.

```ts
// src/services/subscription/billing/billing.provider.ts
interface BillingProvider {
  startTrial(user, plan): Promise<TrialHandle>; // MANUAL: no-op. AUTOPAY: create mandate
  createCheckout(user, plan): Promise<CheckoutPayload>; // MANUAL: order. AUTOPAY: subscription
  verify(payload): Promise<VerifiedActivation>;
  cancel(subscription): Promise<void>;
  handleWebhook?(event): Promise<void>; // AUTOPAY only
}
```

- `RazorpayOrdersProvider` — Phase 1, wraps the existing
  [`payment.service.ts`](../../mern/vivamam_core_server/src/services/payments/payment.service.ts) logic.
- `RazorpaySubscriptionsProvider` — Phase 6, same interface.

Selected once at startup from `env.BILLING_MODE`, and per-row by `subscription.billingMode` when acting on an existing
subscription. Budget ~3 days for the `AUTOPAY` provider _if_ the seam exists; a rewrite if it does not.

> **Flag for the business, independent of this plan:** Google Play requires Play Billing for in-app digital goods. AI
> chat, content and community are digital; consultations may qualify for the real-world-services exemption. Shipping
> Razorpay for the subscription itself carries takedown risk under either mode. Worth a policy review before launch.

---

## 2. Target model

### 2.1 Tiers

Four states, resolved server-side on every request:

| Tier      | How reached                                                      | Duration                    |
| --------- | ---------------------------------------------------------------- | --------------------------- |
| `FREE`    | Default after onboarding; also the fallback when trial/paid ends | Indefinite                  |
| `TRIAL`   | User taps "Start 7-day free trial"                               | 7 days, once per user, ever |
| `PREMIUM` | Paid order verified (`MANUAL`) or mandate charged (`AUTOPAY`)    | Plan term                   |
| `EXPIRED` | Trial or term elapsed                                            | → behaves exactly as `FREE` |

`TRIAL` is **not** the same as `PREMIUM`. The requirement caps the trial at _check-in once_ and _5–6 contents_, and
consultations stay pay-per-session — so entitlements must be a per-tier matrix, never an `isPremium` boolean. Getting
this wrong is the single most likely source of rework.

### 2.2 Plans

| Code          | Term     | Price  | Total credits | Expert | Care manager |
| ------------- | -------- | ------ | ------------- | ------ | ------------ |
| `MONTHLY`     | 1 month  | ₹1,499 | 2             | 1      | 1            |
| `QUARTERLY`   | 3 months | ₹2,499 | 6             | 3      | 3            |
| `HALF_YEARLY` | 6 months | ₹3,999 | 12            | 6      | 6            |

No annual plan. Credits are granted **in full at activation**, usable at any pace (no per-month cap), and expire with
the term. Half go to user-chosen expert consultations, half to care-manager (postpartum counsellor) callbacks — two
separate buckets, since they are different fulfilment paths
([`consultation.schema.ts`](../../mern/vivamam_core_server/src/models/schema/consultation.schema.ts) already
discriminates `consultatorId` on `consultationType`).

Prices, terms and credit splits live in a **`subscription_plans` collection**, not in code and not in the app.

### 2.3 Entitlement matrix

This table is the specification. It becomes `entitlement.config.ts` verbatim, and the test suite is generated from it.

| Capability                 | `FREE`                                     | `TRIAL`                          | `PREMIUM`          |
| -------------------------- | ------------------------------------------ | -------------------------------- | ------------------ |
| `ai.chat`                  | 3 user messages / day, resets midnight IST | Unlimited                        | Unlimited          |
| `checkin.weekly`           | Locked                                     | 1 total                          | Unlimited          |
| `content.globalHealth`     | Unlimited                                  | Unlimited                        | Unlimited          |
| `content.weeklyRecovery`   | 1 — the item matching her current week     | Up to 6 (weeks 1–6)              | All for her week   |
| `products.view`            | First 2 unlocked, rest locked + blurred    | All                              | All                |
| `community.read`           | Full                                       | Full                             | Full               |
| `community.post`           | Full, 150-char cap                         | Full, 500-char cap               | Full, 500-char cap |
| `moodLog`                  | Full                                       | Full                             | Full               |
| `consultation.expert`      | Pay per session (₹ `remuneration`)         | Pay per session — same as `FREE` | Credits, then pay  |
| `consultation.careManager` | Locked                                     | Locked                           | Credits            |

Judgement calls, each a one-line config change if product disagrees:

- **Char caps** — free 150 / premium 500 (today the app hardcodes 250 for everyone in
  [`CreatePost.tsx:112`](src/screens/CreatePost.tsx#L112)). Numbers are a product call; the mechanism is what matters.
- **Trial consultation** — settled: "doctor consultation as per the one time consultation" means the trial keeps the
  existing **pay-per-session** flow, exactly as `FREE`. No credits are granted at trial start
  (`trial.credits = { expert: 0, careManager: 0 }`). Credits exist only under `PREMIUM`, which means the credit ledger
  has no writer until a paid activation — see §5.6.
- **Care manager on free** — locked. It is currently free and unlimited for everyone, which would undercut the
  premium credit bucket entirely.
- **Check-in on free** — locked. The Viva Recovery Score is the core premium loop; giving it away leaves the paywall
  with little to sell.

---

## 3. Collection audit

Every collection in [`src/models/schema/`](../../mern/vivamam_core_server/src/models/schema/), and what it needs.

### 3.1 `content` — **changes required**

Two independent problems, both in
[`content.schema.ts`](../../mern/vivamam_core_server/src/models/schema/content.schema.ts).

**(a) `category` must become an array.** Today:

```ts
category: { type: String, enum: Object.values(EUserCategory), required: true, default: null }
```

A single `EUserCategory` (`PP` / `NP` / `NN`). An article relevant to both postpartum and pregnant women has to be
duplicated as two documents that then drift apart. Change to:

```ts
category: {
    type: [String],
    enum: Object.values(EUserCategory),
    required: true,
    validate: (v: string[]) => v.length > 0,   // default [] would silently match nothing
    default: undefined,
}
```

**The query sites need no change.** `content.controller.ts:27` filters `{ category: user.user_category }`; against an
array field Mongo's implicit `$in` semantics match any document whose array _contains_ that value. Same for
[`weeklyContentNotification.ts:27`](../../mern/vivamam_core_server/src/cron-jobs/weeklyContentNotification.ts#L27).
What does change:

| Site                                                                                                        | Change                                                                                     |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [`content.types.ts:22`](../../mern/vivamam_core_server/src/types/content.types.ts#L22)                      | `category: EUserCategory` → `EUserCategory[]`                                              |
| [`content.validator.ts`](../../mern/vivamam_core_server/src/api/v1/validators/content/content.validator.ts) | `Joi.string().valid(...)` → `Joi.array().items(Joi.string().valid(...)).min(1).required()` |
| App content types / any admin create form                                                                   | Accept and send an array                                                                   |
| Migration step                                                                                              | Wrap existing strings — see below                                                          |

Add an index to match the new access query: `{ category: 1, contentGroup: 1, validWeekStart: 1, validWeekEnd: 1 }`.

Migration, using the existing [`src/services/migration/steps/`](../../mern/vivamam_core_server/src/services/migration/steps/)
pattern (`category-to-array.step.ts`), idempotent so a re-run is harmless:

```js
db.contents.updateMany({ category: { $type: "string" } }, [
  { $set: { category: ["$category"] } },
]);
```

**(b) New fields for the free tier.** The requirement splits free content into "global health videos" (always visible)
and "the week-matched recovery article" (e.g. _"Week 1 After Birth: Understanding Your Body, Hormones, and Recovery
Choices"_). There is no field that distinguishes these today.

```ts
contentGroup: {
    type: String,
    enum: ["GLOBAL_HEALTH", "WEEKLY_RECOVERY"],
    required: true,
}
sortOrder: { type: Number, default: 0 }   // deterministic free/trial slice
```

Optional but recommended: `isFreeOverride: { type: Boolean, default: false }` — lets content-ops promote a specific
premium article as a free teaser without a code change.

Backfill: rows whose `contentBody` contains a `VIDEO` body → `GLOBAL_HEALTH`, everything else → null,
then hand-correct. **This is a content-ops prerequisite** — the free tier cannot ship until the catalog is tagged and
weeks 1–6 of recovery content exist.

### 3.2 `product` — **changes recommended**

[`product.schema.ts`](../../mern/vivamam_core_server/src/models/schema/product.schema.ts) has the identical
single-category problem (`userCategory: { type: String, enum: ... }`) with the identical duplicate-document cost. Same
fix, same migration shape, same no-op at the query site
([`product.controller.ts:28`](../../mern/vivamam_core_server/src/api/v1/controllers/products/product.controller.ts#L28)).
Do both in one pass or the two catalogs diverge in shape.

```ts
userCategory: { type: [String], enum: Object.values(EUserCategory), required: true, default: undefined }
sortOrder:    { type: Number, default: 0 }    // NEW — required, see below
```

`sortOrder` is **not optional here**. "Show 2–3 products and blur others" needs a stable definition of _which_ 2–3.
Without an explicit ordering field the free slice comes from Mongo's natural order, which changes on document rewrite —
so the unlocked products would silently shuffle between two loads of the same screen.

### 3.3 `user` — **changes required**

Replace the flat `subscription` sub-doc
([`user.schema.ts:182-199`](../../mern/vivamam_core_server/src/models/schema/user.schema.ts#L182-L199)) with a
denormalized read snapshot, so the hot path never joins:

```ts
subscription: {
  tier             'FREE' | 'TRIAL' | 'PREMIUM'   default 'FREE'
  status           string | null
  planCode         string | null
  subscription_id  ObjectId | null
  trialEndAt       Date | null
  currentPeriodEnd Date | null
  hasUsedTrial     Boolean  default false      // trial is once per user, forever
}
```

`SubscriptionService` is the only writer. `is_onboarded.is_subscription_completed` keeps its name and its role as the
onboarding gate, but now means "the user made a tier choice" — set on _either_ branch (start trial **or** continue
free). Note [`weekly-checkin.service.ts:727-734`](../../mern/vivamam_core_server/src/services/weekly-checkin-v1/weekly-checkin.service.ts#L727-L734)
also writes this shape and must be updated in the same commit.

### 3.4 `payment_order` — **changes required**

[`payment-order.schema.ts`](../../mern/vivamam_core_server/src/models/schema/payment-order.schema.ts) is untyped enough
to be ambiguous once consultations and subscriptions both flow through it:

```ts
purpose:          'SUBSCRIPTION' | 'CONSULTATION'   required
planCode:         String | null                     // replaces the free-text `plan`
subscription_id:  ObjectId | null
billingMode:      'MANUAL' | 'AUTOPAY'
```

Keep `billingCycle` only if something still reads it; otherwise drop — `planCode` now carries the term.

### 3.5 `consultation` — **changes required**

Refunding a credit when a consultation is marked `UNHANDLED` requires knowing it was booked with one:

```ts
paymentMode:      'CREDIT' | 'PAID'   required
credit_ledger_id: ObjectId | null     // the CONSUME row to reverse
```

### 3.6 No change

| Collection                                                                                     | Why                                                                                                   |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `expert`                                                                                       | `remuneration` stays — it is the pay-per-session price for free users and out-of-credit premium users |
| `care_manager`                                                                                 | Fulfilment only; gating lives in the credit ledger                                                    |
| `vivaClubPost` / `vivaClubComment`                                                             | Char cap is a runtime check against the tier, not stored state                                        |
| `mood_log`                                                                                     | Ungated at every tier, by design                                                                      |
| `consultation_review`, `book_consultation_order`                                               | Unaffected                                                                                            |
| `conversation`, `message`, `flow*`, `recommendation*`, `support`, `otp`, `ai_message_bookmark` | Unaffected                                                                                            |

### 3.7 New collections

**`subscription_plans`** — the catalog.

```
code            'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY'
displayName     string
amountPaise     number          // 149900 / 249900 / 399900
durationDays    number          // 30 / 90 / 180
credits         { expert: number, careManager: number }
razorpayPlanId  string | null   // AUTOPAY only; null under MANUAL
isActive        boolean
sortOrder       number
translations    Mixed           // follows the existing i18n bundle convention
```

**`subscriptions`** — one row per lifecycle, history preserved. Carries the `AUTOPAY` fields from day one (nullable) so
flipping the toggle needs no migration.

```
user_id                 ObjectId (indexed)
planCode                string | null   // null while trialing
tier                    'TRIAL' | 'PREMIUM'
status                  'trialing' | 'active' | 'expired' | 'cancelled' | 'halted'
billingMode             'MANUAL' | 'AUTOPAY'    // stamped at creation — see §1.3
trialStartAt/trialEndAt         Date | null
currentPeriodStart/currentPeriodEnd  Date | null
provider                'razorpay_orders' | 'razorpay_subscriptions'
providerOrderId         string | null
providerSubscriptionId  string | null   // AUTOPAY
mandateStatus           string | null   // AUTOPAY
cancelledAt             Date | null
```

Compound index `{ user_id: 1, status: 1 }`. At most one non-terminal row per user — enforce with a partial unique index.

**`consultation_credits`** — an append-only **ledger**, not a counter.

```
user_id         ObjectId (indexed)
subscription_id ObjectId
type            'EXPERT' | 'CARE_MANAGER'
delta           number          // +3 on grant, -1 on consume, +1 on refund
balanceAfter    number
reason          'GRANT' | 'CONSUME' | 'REFUND' | 'EXPIRE'
consultation_id ObjectId | null
expiresAt       Date
```

A ledger rather than a `creditsRemaining` field because consultations get cancelled and marked `UNHANDLED`, and those
credits must come back auditably. Balance = latest row's `balanceAfter`, guarded on write.

**`usage_counters`** — quota windows.

```
user_id     ObjectId
key         'ai.message' | 'checkin.start'
windowKey   string          // '2026-07-22' (IST day) or 'sub:<id>'
count       number
expiresAt   Date            // TTL index — self-cleaning
```

Unique on `{ user_id, key, windowKey }`. Increment via a single atomic `findOneAndUpdate({...}, { $inc }, { upsert })`
so a double-tapped send cannot yield a 4th free message. Redis (`ioredis`, already wired in
[`redis.config.ts`](../../mern/vivamam_core_server/src/config/redis.config.ts)) is available if this gets hot, but
Mongo + TTL is durable and matches existing patterns — start there.

**`webhook_events`** — `AUTOPAY` only, but create it with the seam. `{ providerEventId (unique), type, payload,
processedAt }`. Razorpay retries; without an idempotency table a retried `subscription.charged` grants credits twice.

---

## 4. Server — the entitlement layer

New `src/services/entitlements/`, following the existing routes → validators → controllers → services layering.

- **`entitlement.config.ts`** — §2.3 as data. One file, no logic. The single source of truth.
- **`entitlement.service.ts`**
  - `resolveTier(user)` — **evaluates dates lazily**. A row still marked `active` whose `currentPeriodEnd` has passed
    resolves to `EXPIRED`. Never trust the cron to have run; the cron is for notifications and cleanup, not correctness.
  - `getEntitlements(userId)` → `{ tier, billingMode, limits, usage, credits, trialEndAt, currentPeriodEnd }`
  - `assertCapability(userId, cap)` / `consumeQuota(userId, key)`
  - `grantCredits` / `consumeCredit` / `refundCredit`
- **`subscription.service.ts`** — the state machine: `startTrial`, `activatePaid`, `expire`, `cancel`. Owns credit
  grants and the user-snapshot sync. Branches on the **row's** `billingMode`, never on env (§1.3).
- **`billing/`** — the §1.4 seam.
- **`middlewares/entitlement.middleware.ts`** — `requireCapability('checkin.weekly')`, `enforceQuota('ai.message')`.
  Composes with `authMiddleware()` exactly like `requestValidator` does.

**Denial response contract** — every gate returns the same machine-readable shape so the app has one handler:

```json
HTTP 402
{ "success": false, "code": "QUOTA_EXCEEDED",
  "data": { "capability": "ai.chat", "tier": "FREE", "limit": 3, "used": 3,
            "resetAt": "2026-07-23T18:30:00Z", "upsell": "PREMIUM" } }
```

`LOCKED_FEATURE` for hard locks, `NO_CREDITS` for exhausted credits. Never a bare 403 — the app must know _what_ to
offer and _when_ it resets.

### New endpoints

| Route                                       | Purpose                                                                                                   |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/subscription/me`               | Tier, `billingMode`, status, dates, credit balances, **the full resolved limit set**, today's usage       |
| `GET /api/v1/subscription/plans`            | Localized catalog from `subscription_plans`                                                               |
| `POST /api/v1/subscription/trial/start`     | Idempotent; 409 if `hasUsedTrial`. Under `AUTOPAY` returns a mandate payload; under `MANUAL` returns `{}` |
| `POST /api/v1/subscription/free/select`     | Replaces `/subscribe/select-free-plan`                                                                    |
| `POST /api/v1/subscription/checkout/create` | Takes `planCode` — **never a client-supplied amount**                                                     |
| `POST /api/v1/subscription/checkout/verify` | HMAC verify → activate → grant credits                                                                    |
| `POST /api/v1/subscription/cancel`          | Sets `cancelledAt`; access runs to `currentPeriodEnd`. Under `AUTOPAY` also cancels the mandate           |
| `POST /api/v1/webhooks/razorpay`            | `AUTOPAY` only. Signature-verified, idempotent on `providerEventId`                                       |

> **Security fix to land with this work:** > [`payment.service.ts:createOrder`](../../mern/vivamam_core_server/src/services/payments/payment.service.ts#L24-L40)
> takes `amount` straight from the request body — a client can order a ₹1,499 plan for ₹1. The new endpoint must derive
> the amount from `planCode` server-side. The same bug exists in the consultation order flow (`amount:
expert?.remuneration` sent from [`ExpertDetails.tsx:56`](src/screens/ExpertDetails.tsx#L56)) — fix both.

---

## 5. Server — enforcement points

Every one of these is a concrete, already-identified call site.

1. **AI chat** — [`chat-flow.controller.ts`](../../mern/vivamam_core_server/src/api/v1/controllers/chat-system/chat-flow.controller.ts)
   `saveResponse`, the `flowType === CHATBOT` branch, before `chatFlowAIService.saveResponse`. Increment on the **user
   turn**, not the LLM response. The SSE connect path (`handleSseConnection`, chatbot branch) should also emit remaining
   quota so the app can render the counter without a second call.

2. **Weekly check-in** — [`weekly-checkin-v1.routes.ts`](../../mern/vivamam_core_server/src/api/v1/routes/weekly-checkin-v1.routes.ts)
   `POST /chat/checkin/start`. Counter `checkin.start`, window = subscription period for `TRIAL`.
   ⚠️ The legacy [`weeklyCheckin.routes.ts`](../../mern/vivamam_core_server/src/api/v1/routes/weeklyCheckin.routes.ts) is a
   second, ungated path to the same feature. Since there is no production data — **delete it** rather than gate it twice.

3. **Content** — [`content.controller.ts:getContents`](../../mern/vivamam_core_server/src/api/v1/controllers/contents/content.controller.ts).
   Rewrite the query against the new `contentGroup`: `GLOBAL_HEALTH` (always, unlimited) ∪ `WEEKLY_RECOVERY` matched on
   `current_weekdays.weeks`, sliced by the tier's limit ordered by `{ sortOrder, _id }`. Locked items return
   `{ _id, featuredTitle, featuredImage, isLocked: true }` with **`contentBody` stripped**. `getContentById` must
   re-check — the ID is guessable, and today that handler does no ownership or tier check at all.

4. **Products** — [`product.controller.ts:getProducts`](../../mern/vivamam_core_server/src/api/v1/controllers/products/product.controller.ts).
   First 2 by `{ sortOrder, _id }` unlocked for `FREE`; the rest get `isLocked: true` with **`productAffiliateLink`
   removed**. Blurring in the UI while shipping the link in the payload is not a paywall. `getProductById` re-checks.

5. **Community** — [`vivaClub.service.ts`](../../mern/vivamam_core_server/src/services/vivaClub/vivaClub.service.ts)
   `createPost` and `addComment`: reject over the tier's char cap with `QUOTA_EXCEEDED`. Server-side, because
   `maxLength` on a `TextInput` is a suggestion.

6. **Consultations** — **credits are a `PREMIUM`-only mechanism.** `FREE` and `TRIAL` both use the existing
   pay-per-session flow unchanged, so the only gate those two tiers need is on the care-manager path.

   - New `POST /consultations/book-with-credit` — checks the `EXPERT` balance, consumes atomically, creates the
     `consultation` row with `paymentMode: 'CREDIT'` and fires the existing WhatsApp notify, skipping Razorpay entirely.
     Rejects `NO_CREDITS` for `FREE` and `TRIAL`, which have a zero balance by construction. The existing paid path
     ([`book-consultation-payment.service.ts`](../../mern/vivamam_core_server/src/services/book-consultation/book-consultation-payment.service.ts))
     stays as-is and serves `FREE`, `TRIAL`, and premium users who are out of credits.
   - [`consultation.controller.ts:requestCallback`](../../mern/vivamam_core_server/src/api/v1/controllers/consultations/consultation.controller.ts#L16)
     (care manager) — consume a `CARE_MANAGER` credit; `LOCKED_FEATURE` on both `FREE` and `TRIAL`. This is the one
     consultation route that changes behaviour for non-premium users, since it is free and unlimited for everyone today.
   - Consumption guarded on `balanceAfter >= 1` in the same atomic write. A double-tapped "Book" must not burn two credits.
   - `completeConsultation` marking `UNHANDLED` → refund via `credit_ledger_id`.

7. **Mood log** — no gate, all tiers. Documented explicitly so nobody adds one later.

---

## 6. Server — lifecycle jobs

The repo already runs Cloud Scheduler → HTTP cron endpoints
([`cron-jobs/`](../../mern/vivamam_core_server/src/cron-jobs/),
[`cloudScheduler.middleware.ts`](../../mern/vivamam_core_server/src/middlewares/cloudScheduler.middleware.ts)). Add one job:

**`subscription-lifecycle`** (daily, ~02:00 IST) — branching on each row's `billingMode`:

| Row state                        | `MANUAL`                                | `AUTOPAY`                                                                                              |
| -------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `trialing` past `trialEndAt`     | → `expired`, snapshot → `FREE`, paywall | Charge via provider → `active`, grant credits (webhook is the primary path; the job is the reconciler) |
| `active` past `currentPeriodEnd` | → `expired`, snapshot → `FREE`          | Renew; on failure → `halted`, then `expired` after the retry window                                    |

Both modes: expire unconsumed credits past `expiresAt` (ledger row, `reason: 'EXPIRE'`), and push reminders via the
existing `sendPushNotification` — trial day 5, trial day 7, renewal T-3 and T-1, with mode-appropriate copy ("your trial
ends" vs "you will be charged ₹X").

Correctness never depends on this job — `resolveTier` evaluates dates on read (§4). The job exists for notifications,
for the denormalized snapshot, and under `AUTOPAY` as the reconciler behind the webhook.

---

## 7. App changes

### 7.1 New plumbing

- **`SubscriptionContext`** + `useEntitlements()` — fetches `/subscription/me` on login, on app foreground, and after
  any payment; caches to the existing SQLite layer ([`src/db/`](src/db/)) for offline. Sits beside
  [`AuthContext`](src/context/AuthContext.tsx).
- **`useCapability('ai.chat')`** → `{ allowed, limit, used, resetAt, tier }`, and a declarative `<Gate>` wrapper.
- **`<PaywallSheet />`** — one component, every entry point. `@gorhom/bottom-sheet` and
  [`AppBottomSheet.tsx`](src/components/bottomSheet/AppBottomSheet.tsx) already exist.
- **`<LockedOverlay />`** — blur + "Unlock to see more". `@react-native-community/blur` is already a dependency.
- **Central 402 handling** in [`apiClientInterceptor.ts`](src/api/apiClientInterceptor.ts) — on `QUOTA_EXCEEDED` /
  `LOCKED_FEATURE`, open the paywall with the server-supplied context. Mirrors the existing 401 handler in
  [`authEventHandler.ts`](src/api/authEventHandler.ts).

**Two principles the app must hold to:**

1. **No hardcoded limits.** Every number (3 messages, 2 products, 150 chars) comes from `/subscription/me`. Tuning the
   funnel must not require a store release.
2. **No hardcoded billing mode.** The trial CTA, whether a card sheet opens, and the day-7 copy all branch on
   `billingMode` from the server (§1.2).

### 7.2 Screens

| Screen                                                                                                             | Change                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Paywall ([`SubscriptionDetails.tsx`](src/components/subscriptions/SubscriptionDetails.tsx))                        | Rebuild: server catalog replaces [`servicesData.ts`](src/data/servicesData.ts); 3 term cards (1/3/6 mo) replace the monthly-yearly [`BillingToggle`](src/components/subscriptions/BillingToggle.tsx); "Start 7-day free trial" primary + "Continue with the free app" secondary; `FEATURES_MATRIX` reworked to Free vs Premium |
| Trial start flow                                                                                                   | **`MANUAL`**: tap → trial active, no checkout. **`AUTOPAY`**: tap → Razorpay mandate sheet → "You won't be charged until <date>, cancel anytime". One component, branched on `billingMode`                                                                                                                                     |
| [`OnboardingStack.tsx`](src/navigators/stacks/OnboardingStack.tsx)                                                 | The `Services` step becomes the trial-or-free choice; `completeSubscription()` fires on **either** branch so the gate opens regardless                                                                                                                                                                                         |
| [`ChatWithVivaAI.tsx`](src/screens/ChatWithVivaAI.tsx)                                                             | "2 of 3 free questions left today"; inline upsell bubble at 0; input disabled with a CTA                                                                                                                                                                                                                                       |
| [`Products.tsx`](src/screens/Products.tsx) / [`ProductDetails.tsx`](src/screens/ProductDetails.tsx)                | Blur locked cards, "Unlock to see more products", block navigation into locked details                                                                                                                                                                                                                                         |
| [`ArticleContent.tsx`](src/screens/ArticleContent.tsx), [`CategoryArticles.tsx`](src/screens/CategoryArticles.tsx) | Global-health videos always open; locked recovery content shows a lock badge → paywall                                                                                                                                                                                                                                         |
| [`CreatePost.tsx`](src/screens/CreatePost.tsx)                                                                     | Char cap from entitlements (not the hardcoded 250); "Subscribe to write more" at the limit                                                                                                                                                                                                                                     |
| [`Dashboard.tsx`](src/screens/Dashboard.tsx)                                                                       | Check-in CTA gated on free; trial-days-remaining banner; premium credit balance                                                                                                                                                                                                                                                |
| [`ExpertDetails.tsx`](src/screens/ExpertDetails.tsx)                                                               | "Book with 1 free credit" only when the balance is > 0 (premium); `FREE` and `TRIAL` see the existing pay flow untouched                                                                                                                                                                                                       |
| [`MyProfile.tsx`](src/screens/MyProfile.tsx)                                                                       | Manage subscription: plan, renewal date, credit balances, cancel. Under `AUTOPAY` also "autopay on / next charge ₹X on <date>"                                                                                                                                                                                                 |
| Care manager ([`VivaBuddyRequestCall.tsx`](src/components/VivaBuddyRequestCall.tsx))                               | Credit-gated; locked on free                                                                                                                                                                                                                                                                                                   |

### 7.3 i18n

All new UI strings into `en.json` + `hi.json`. Per project convention, **only static UI text is translated** — plan
names and prices come from the server's `translations` bundle and must not be translated client-side.

---

## 8. Phasing

| Phase  | Deliverable                                                                                                                             | Why this order                                                                             |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **P0** | Schema changes (§3) + migrations: `category` → array on content and product, `contentGroup`/`sortOrder`, user snapshot, new collections | Pure data work, no behaviour change. Unblocks content-ops tagging, which is the long pole  |
| **P1** | Entitlement service, `/subscription/me` — **no enforcement**                                                                            | Ships dark. The app can read tiers before anything is gated                                |
| **P2** | Plans catalog, trial start, checkout → activate, lifecycle cron, cancel — **`MANUAL` only**                                             | Billing works end to end while everyone is still effectively premium                       |
| **P3** | Server enforcement: AI quota → content → products → community → check-in                                                                | Highest-value gates first. Server-side before client-side, always                          |
| **P4** | App: paywall rebuild, gating UI, 402 handling, onboarding branch                                                                        | The client can now only _reflect_ the truth the server already enforces                    |
| **P5** | Credits: grant, consume, refund, book-with-credit, care-manager gating                                                                  | Depends on P2 activation and P3 patterns                                                   |
| **P6** | Analytics: paywall impressions, trial starts, day-7 conversion, per-capability denial counts                                            | You cannot tune the free tier without this                                                 |
| **P7** | **`AUTOPAY`**: `RazorpaySubscriptionsProvider`, mandate creation, webhook handler, `razorpayPlanId` on plans                            | Deferred by choice. Nothing above changes — only the provider is added and the env flipped |

Also in P0/P2, adjacent and cheap: fix the client-supplied `amount` on both order endpoints (§4), and delete the legacy
check-in route (§5.2).

---

## 9. Testing

Jest + Supertest are already set up (`__tests__/`).

- **Matrix tests** — table-driven straight off §2.3: every (tier × capability) pair, allowed and denied. Generated from
  `entitlement.config.ts` so the config and the tests cannot drift.
- **Both billing modes** — the trial → day 7 transition asserted twice: `MANUAL` lands on `FREE`, `AUTOPAY` lands on
  `PREMIUM`. Plus the §1.3 case: a `MANUAL` row must stay `MANUAL` after the env flips to `AUTOPAY`.
- **Concurrency** — 10 parallel AI sends on a free user yield exactly 3 successes; 5 parallel "book with credit" on a
  1-credit balance yield exactly 1. These are the bugs that cost real money.
- **Webhook idempotency** — the same `subscription.charged` event delivered 3× grants credits once.
- **Trial grants nothing** — `startTrial` writes no `GRANT` rows; a trial user hitting `book-with-credit` gets
  `NO_CREDITS`, and the pay-per-session route still works for them. Credits appear only after a paid activation.
- **Clock** — faked-time tests for trial expiry, period expiry, credit expiry, and the IST daily reset boundary.
- **Redaction** — assert locked products carry no `productAffiliateLink` and locked content no `contentBody`, in both
  the list and by-ID responses.
- **Category array** — a content doc with `category: ["PP","NP"]` is returned to both a PP and an NP user; the
  migration is idempotent across two runs.
- **Lifecycle** — trial → expired → subscribe → active → cancel → runs to period end → expired.

---

## 10. Open items

1. **Content catalog** (§3.1) — weeks 1–6 recovery content and the `GLOBAL_HEALTH` video set must exist and be tagged
   with `contentGroup`. This gates P3 and is content-ops work, not engineering. Start it at P0.
2. **Play Billing policy** (§1.4) — review before store submission. Applies under both modes.
3. **Product category array** (§3.2) — confirm you want products changed in the same pass as content. Recommended;
   doing it later means a second migration and a second app-side type change.
4. **Numbers to confirm** — free char cap (150?), premium cap (500?), free product count (2 or 3?), and trial content
   cap (5 or 6?). All one-line config changes. _(Trial consultations are settled: pay-per-session, no credits — §2.3.)_
5. **Timezone** — no timezone is stored on `user`. Daily AI reset is planned at midnight **IST**, correct for an
   India-only launch. Revisit before any international rollout.
6. **Credit rollover** — planned as expiring with the term, no carry-over on renewal. Confirm.
7. **`AUTOPAY` prerequisites** — Razorpay recurring/mandate activation on the merchant account is an approval process
   with lead time. Worth starting the paperwork during P0 even though the code lands at P7.
