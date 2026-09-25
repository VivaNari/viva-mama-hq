# Expert Video Consultation (Google Meet) — Implementation Plan

> Scope: `viva_nari_app` (React Native) + `vivamam_core_server` (Node/Express/Mongo).
> Goal: a patient books a doctor + date + preferred time window in-app, the coordinator confirms the exact
> 30-minute slot over WhatsApp, and the patient joins a Google Meet call from a dashboard banner once the
> link unlocks.

---

## 0. Where we are today

Two booking paths exist, and they are **not symmetric**.

|                        | Paid path                                                                                                                                                                                | Credit path                                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry point            | [`book-consultation.controller.ts:13`](../../mern/vivamam_core_server/src/api/v1/controllers/book-consultation/book-consultation.controller.ts#L13) → `createOrder` → Razorpay → `verifyPayment` | [`consultation.controller.ts:99`](../../mern/vivamam_core_server/src/api/v1/controllers/consultations/consultation.controller.ts#L99)                 |
| Creates consultation   | [`book-consultation-payment.service.ts:146`](../../mern/vivamam_core_server/src/services/book-consultation/book-consultation-payment.service.ts#L146)                                       | [`consultation.service.ts:126`](../../mern/vivamam_core_server/src/services/consultations/consultation.service.ts#L126)                               |
| WhatsApp to expert     | ✅ yes                                                                                                                                                                                    | ❌ **no — pre-existing bug**                                                                                                                        |
| Recipient number       | hardcoded `expert.whatsappMessageReceiver` in [`constants/expert.ts`](../../mern/vivamam_core_server/src/constants/expert.ts)                                                              | n/a                                                                                                                                                |

**Premium users booking with credits never trigger the expert WhatsApp message today.** The refactor below routes
both paths through one finalizer, which fixes this as a side effect.

Other facts that shape the plan:

- `google-auth-library@10.4.0` is already a dependency (Google sign-in) — no new auth library needed for Meet.
- Already on GCP with Cloud Run + Cloud Scheduler + OIDC (`SCHEDULER_SA_EMAIL`, `CLOUD_RUN_URL` in
  [`env.ts`](../../mern/vivamam_core_server/src/config/env.ts)), so service-account plumbing is familiar ground.
- The dashboard banner is [`ActiveConsultation.tsx`](src/components/ActiveConsultation.tsx), fed by
  `GET /pending-consultations`, rendered in [`DashboardMotherTab.tsx:192`](src/components/dashboard/DashboardMotherTab.tsx#L192).
- `getPendingConsultations` populates `consultatorId` with the **whole expert document** — once
  `contactWhatsappNumber` is added there it will leak to patient devices unless stripped (it already strips
  `translations` the same way).

---

## 1. The Google Meet link — developer configuration

### 1.1 The decision: Meet REST API v2 `spaces.create`, not the Calendar API

Use `POST https://meet.googleapis.com/v2/spaces` rather than creating a Calendar event with `conferenceData`.

1. **One call, one field.** Returns `meetingUri` immediately. No calendar event, no attendee list, no
   `conferenceDataVersion=1` dance, no calendar clutter for a room nobody owns.
2. **`config.accessType: "OPEN"`** — _"anyone with the join information can join without knocking."_ This is the
   decisive reason. Calendar-created conferences inherit the org's default access (normally `TRUSTED`), which drops
   an external patient into a lobby to wait for the doctor to admit them. The requirement is explicitly "works
   without any additional login" — only `OPEN` delivers that.
3. Meeting codes expire 365 days after last use — irrelevant for consults booked days ahead.

### 1.2 Workspace prerequisite — ✅ already satisfied

**This does not work with a personal @gmail.com account.** Service accounts cannot create Meet spaces as
themselves — the `meetings.space.created` scope is principal-scoped, so the service account must impersonate a real
Workspace user via domain-wide delegation.

**Verified 28 Jul 2026: `vivamama.in` is on Google Workspace Business Starter, Active, 6 licences, Flexible plan.**
No purchase required.

Business Starter is sufficient for `spaces.create`. The Meet API's edition gate applies only to **recordings and
transcripts** (Business Standard / Enterprise / Education Plus), which this feature does not use. The `spaces.create`
reference lists no edition requirement.

One Business Starter limit, noted for completeness: group calls with 3+ participants cap at 60 minutes (1:1 gets 24
hours). A doctor + patient call is 1:1 and consults are 30 minutes, so neither limit binds.

### 1.3 Setup checklist

**A. Google Workspace Admin (admin.google.com)** — mostly done

1. ~~Sign up Workspace on `vivamama.in`, verify domain ownership~~ — ✅ done, Business Starter active.
2. **Decide the impersonated account.** It becomes the _owner/organizer_ of every generated space.
   - _Recommended:_ create `consultations@vivamama.in` — costs one extra licence (~₹150–200/mo on the Flexible plan)
     but the meetings belong to a role account that survives staff changes.
   - _Free alternative:_ reuse an existing generic/support mailbox from the 6 assigned licences. Avoid a personal
     account — offboarding that person orphans every meeting.
3. Apps → Google Workspace → Google Meet → confirm Meet is ON for that user's OU.

**B. GCP**

> ⚠️ Project naming: the org is `vivamama.in` (ID `442725133108`) with projects `vivamama-prod-100`,
> `vivamama-uat-101`, `vivamama-dev-486004`. The Firebase project `viva-mama` (source of
> `VivaMamaServiceAccountKey.json`) is **separate and unrelated** — it serves FCM push only. Create the Meet SA in
> whichever project runs Cloud Run; confirm with `gcloud run services list --project=vivamama-prod-100`.

4. Enable the API: `gcloud services enable meet.googleapis.com --project=<PROJECT>`
5. Create a service account, e.g. `meet-link-creator@<PROJECT>.iam.gserviceaccount.com`. It needs **no IAM roles** —
   its power comes from the Workspace delegation, not GCP IAM.
6. Note its **numeric OAuth Client ID**:
   `gcloud iam service-accounts describe meet-link-creator@<PROJECT>.iam.gserviceaccount.com --project=<PROJECT> --format='value(oauth2ClientId)'`
7. Create a JSON key and push it **straight into Secret Manager** — never into the repo, and no Dockerfile change.
   It reaches Cloud Run as an env var via `--set-secrets` (see §1.3 D), so `src/config/firebase.ts` and the existing
   `COPY VivaMamaServiceAccountKey.json` line stay exactly as they are.

> With dev/uat/prod as separate projects, create **one SA per environment** and register each numeric client ID in the
> same domain-wide-delegation screen with the same scope. Multiple client IDs is normal and supported.

**C. Wire delegation together (Admin console)**

8. Security → Access and data control → API controls → **Domain-wide delegation** → Manage → Add new
   - Client ID: the numeric ID from step 6
   - OAuth scope: `https://www.googleapis.com/auth/meetings.space.created`
9. Wait ~5–10 minutes for propagation.

**D. Env vars — Cloud Run + local `.env`**

```
GOOGLE_MEET_ENABLED=true
GOOGLE_MEET_IMPERSONATED_USER=consultations@vivamama.in
GOOGLE_MEET_SA_KEY_JSON=<full JSON, from Secret Manager>
VIVAMAMA_SUPPORT_WHATSAPP=919599120017
```

**E. Smoke test before writing any app code**

```bash
node -e '
const {JWT} = require("google-auth-library");
const key = require("./meet-sa.json");
new JWT({
  email: key.client_email, key: key.private_key,
  scopes: ["https://www.googleapis.com/auth/meetings.space.created"],
  subject: "consultations@vivamama.in",
}).request({
  url: "https://meet.googleapis.com/v2/spaces",
  method: "POST",
  data: { config: { accessType: "OPEN", entryPointAccess: "ALL" } },
}).then(r => console.log(r.data)).catch(e => console.error(e.response?.data || e));
'
```

Expected: `{ name: "spaces/xxx", meetingUri: "https://meet.google.com/abc-defg-hij", meetingCode: "...", config: {...} }`

### 1.4 Caveat on "no additional login"

`accessType: OPEN` removes the **lobby**, not Google sign-in on the **Meet mobile app** — that app still requires a
signed-in Google account. In practice ~every Android user in this market has one, so it is a non-issue for them. For
the edge cases (iOS without the Meet app, no Google account), the same link opened in a **mobile browser** works as an
anonymous guest (Google enabled mobile-browser guest join in Jan 2024) — the user just types a name.

Therefore:

- Open the link with `Linking.openURL(meetingUri)` — signed-in Android users go straight into the call.
- Show a helper line under the Join button: _"If prompted, open in your browser and enter your name."_

### 1.5 Fallback — design for this from day one

`meeting_link` is **nullable**, and a Meet API failure must never roll back a booking. On failure: log it, save `null`,
still send the WhatsApp (with "Link to follow"), and let ops paste a link in manually.

This also means **the entire feature can ship before Workspace is purchased** — set `GOOGLE_MEET_ENABLED=false` and
links are pasted manually until the account is live. See §7.

### 1.6 Alternative if Workspace is rejected

Store a permanent per-expert Meet link (created manually once by each doctor) on the expert document and skip the API
entirely. Costs nothing, but every patient of that doctor shares one room and the lobby/knocking behaviour returns.
Acceptable as a stopgap, not as the destination.

---

## 2. WhatsApp template changes

Meta allows editing an approved template (it re-enters review, minutes to a few hours). Adding variables to
`expert_consultation_booking` counts as an edit.

**Recommended: create `expert_consultation_booking_v2` as a new template and switch the name in code.** The current
template keeps working if v2 is rejected.

GetGabs sends **positional** parameters — the order of the `parameters` array in
[`sendWhatsappMessageForExpertConsultation.ts:37`](../../mern/vivamam_core_server/src/services/getgabs/sendWhatsappMessageForExpertConsultation.ts#L37)
must match `{{1}}…{{n}}` exactly. That is the whole contract.

### 2.1 Template body (`expert_consultation_booking_v2`, category UTILITY, `en_US`)

```
New Vivamama Consultation Booking

Patient: {{1}}
Patient contact (for prescription): {{2}}
Expert: {{3}}
Booked on: {{4}}
Consultation date: {{5}}
Preferred slot: {{6}}
Payment: {{7}}
Join link: {{8}}
Booking ref: {{9}}

Please confirm a 30-minute time within this slot and share it back so it can be set in the app. The exact time will be shared with the patient over WhatsApp.
```

### 2.2 Parameter map

| #   | Variable                  | Example                            | Source                                    |
| --- | ------------------------- | ---------------------------------- | ----------------------------------------- |
| 1   | Patient name              | `Priya Sharma`                     | `user.name`                               |
| 2   | Patient WhatsApp / email  | `+919876543210`                    | `user.mobile_number \|\| user.email`      |
| 3   | Expert name               | `Dr. Anita Rao`                    | `expert.name`                             |
| 4   | Booking initiated on      | `28 Jul 2026, 4:12 PM`             | `consultation.createdAt` (IST)            |
| 5   | Consultation date         | `31 Jul 2026`                      | `preferred_consultation_date` (IST)       |
| 6   | Preferred slot            | `9:00 AM – 12:00 PM`               | `preferred_slot` label                    |
| 7   | Payment                   | `Credit (1 used, 2 left)` / `Paid ₹800` | `paymentMode` + balance              |
| 8   | Join link                 | `https://meet.google.com/abc-defg-hij` | `meeting_link`, or `Link to follow`   |
| 9   | Booking ref               | `68a1f...c92`                      | `consultation._id`                        |

Param 9 is what makes the ops loop work — the coordinator replies with the ref + confirmed time, and the exact
document to update is unambiguous.

### 2.3 Meta gotchas to respect

- Body must not start or end with a variable — ✅ it ends with the instruction sentence.
- No two adjacent variables — ✅ every one has a label before it.
- **Never send an empty string** for a parameter; Meta rejects the send. Substitute `—` or `Not provided`.

`sendWhatsappMessageForCareManager` and the OTP template are untouched.

---

## 3. Data model changes

### 3.1 `experts` — [`expert.schema.ts`](../../mern/vivamam_core_server/src/models/schema/expert.schema.ts)

```ts
// Where the booking notification goes. Today every expert points at the
// coordinator's number; when a doctor is ready to be notified directly, this
// is a DB edit, not a deploy.
contactWhatsappNumber: {
    type: String,
    required: false,
    default: null,   // falls back to the expert.whatsappMessageReceiver constant
},
```

Plus:

- mirror on `IExpert` in [`expert.types.ts:33`](../../mern/vivamam_core_server/src/types/expert.types.ts#L33)
- add to the create/update validator in `expert.validator.ts`
- migration step `add-expert-contact-whatsapp.step.ts`, following the shape of `add-expert-referral-codes.step.ts`,
  backfilling all experts to `"919599691619"`

Store **E.164 without the `+`** (`919599691619`) — matches what GetGabs already receives.

### 3.2 New enum — `src/constants/consultation-slots.ts`

```ts
export enum EPreferredSlot {
    MORNING = "MORNING", //  9:00 AM – 12:00 PM
    AFTERNOON = "AFTERNOON", // 12:01 PM –  3:00 PM
    EVENING = "EVENING", //  3:01 PM –  6:00 PM
}

export const PREFERRED_SLOT_LABELS: Record<EPreferredSlot, string> = {
    [EPreferredSlot.MORNING]: "9:00 AM – 12:00 PM",
    [EPreferredSlot.AFTERNOON]: "12:01 PM – 3:00 PM",
    [EPreferredSlot.EVENING]: "3:01 PM – 6:00 PM",
};
```

Store the **enum**, never the label — labels are display text and need Hindi.

### 3.3 `consultations` — [`consultation.schema.ts`](../../mern/vivamam_core_server/src/models/schema/consultation.schema.ts)

```ts
preferred_slot: {
    type: String,
    enum: [...Object.values(EPreferredSlot), null],
    default: null,          // null for care-manager callbacks and legacy rows
},
// The Meet space, generated once at booking. Nullable by design: a Meet API
// failure must never roll back a booking that was already paid for.
meeting_link:     { type: String, default: null },
meeting_space_id: { type: String, default: null },  // "spaces/xxx", for later revoke/inspect
// The exact 30-min start the coordinator agreed with the doctor, set manually
// for now. Until it is set, the Join button stays locked.
meeting_confirmed_at: { type: Date, default: null },
```

Mirror all four on `IConsultationRequest`.

### 3.4 `book_consultation_orders` — [`book-consultation-order.schema.ts`](../../mern/vivamam_core_server/src/models/schema/book-consultation-order.schema.ts)

Add `preferred_slot` (same enum). The slot is chosen at `createOrder` time, rides on the order through the Razorpay
round-trip, and is copied onto the consultation in `verifyPayment` — exactly how `preferred_consultation_date` already
travels.

---

## 4. Backend implementation

### 4.1 New — `src/services/google-meet/meet-space.service.ts`

```ts
createMeetSpace(): Promise<{ meetingUri: string; spaceName: string } | null>
```

- Lazily builds a cached `JWT` client (`subject: env.GOOGLE_MEET_IMPERSONATED_USER`, scope `meetings.space.created`).
- `POST https://meet.googleapis.com/v2/spaces` with `{ config: { accessType: "OPEN", entryPointAccess: "ALL" } }`.
- Returns `null` — **never throws** — when `GOOGLE_MEET_ENABLED=false` or on any API error. Logs loudly.

The nullable return is the entire safety design; every caller below depends on it.

### 4.2 New — `finalizeExpertBooking()` in `consultation.service.ts`

The single point both booking paths converge on, so paid and credit flows can never drift apart again.

```ts
private async finalizeExpertBooking(consultation, expert, user, paymentSummary) {
    // 1. Generate the Meet space (nullable).
    const space = await meetSpaceService.createMeetSpace();
    if (space) {
        await consultationModel.updateOne(
            { _id: consultation._id },
            { $set: { meeting_link: space.meetingUri, meeting_space_id: space.spaceName } },
        );
    }

    // 2. Notify the coordinator — best-effort, mirroring requestCallback's existing
    //    try/catch: a WhatsApp failure must not undo a booking already paid for.
    try {
        await sendWhatsappMessageForExpertConsultation({ ...9 params... });
    } catch (err) {
        console.error("WhatsApp notification failed (non-fatal)", err);
    }
}
```

Recipient: `expert.contactWhatsappNumber ?? expert.whatsappMessageReceiver`.

**Ordering matters:** generate the link _before_ sending WhatsApp so param 8 is real. Both run after the credit spend
/ payment verification, so the booking is already durable.

### 4.3 Wiring both paths

- **Credit path** — `bookExpertWithCredit(userId, expertId, date, preferredSlot)`: accept the slot, persist it, then
  call `finalizeExpertBooking`. This is where the missing-WhatsApp bug from §0 gets fixed.
- **Paid path** — `createOrder` stores `preferred_slot` on the order; `verifyPayment` copies it onto the consultation
  and replaces the inline WhatsApp block at
  [`book-consultation-payment.service.ts:158-169`](../../mern/vivamam_core_server/src/services/book-consultation/book-consultation-payment.service.ts#L158-L169)
  with a `finalizeExpertBooking` call.
- **Validators** — `bookWithCreditValidator` and the `createOrder` body check both require
  `preferredSlot ∈ EPreferredSlot`.

### 4.4 `getPendingConsultations` response

Three changes in the existing `.map()` at
[`consultation.controller.ts:156`](../../mern/vivamam_core_server/src/api/v1/controllers/consultations/consultation.controller.ts#L156):

1. **`delete consultator.contactWhatsappNumber`** alongside the existing `delete consultator.translations`. The
   coordinator's number must not ship to patient devices.
2. Add computed `joinUnlocksAt` = `meeting_confirmed_at − 5 min`, or `null`. Server-computed so the client does no
   timezone arithmetic.
3. Add `canJoinNow` = `meeting_link != null && now ≥ joinUnlocksAt && now ≤ meeting_confirmed_at + 45 min`. The client
   still re-evaluates on a timer for the live unlock, but this makes the first render correct.

Also **widen the filter**: today it is `requestStatus: PENDING` only. Keep that, and return consultations where
`preferred_consultation_date` is today-or-future **or** `meeting_confirmed_at` is within the last 45 minutes — the
banner's visibility rule moves server-side.

### 4.5 Admin endpoint for the confirmed time — recommended

Hand-editing Mongo works, but this is ~20 lines and removes the risk of a hand-typed `Date` landing in the wrong
timezone:

```
PATCH /admin/consultation/:id/confirm-time   { confirmedAt: "2026-07-31T10:30:00+05:30" }
```

Follows the existing `/admin/consultation/:id/*` pattern. It validates that the time falls inside the booked
`preferred_slot` and rejects it otherwise — that check alone justifies the endpoint. Optionally fires a push
notification to the patient (`sendPushNotification` is already wired): _"Your consultation is confirmed for 10:30 AM."_

---

## 5. App implementation

### 5.1 [`ExpertDetails.tsx`](src/screens/ExpertDetails.tsx) — slot picker + credit clarity

**Slot selector.** Three pill buttons below the date button. `selectedSlot` state; the Book button stays disabled
until _both_ date and slot are set (extend the existing `disabled` predicate at
[line 396](src/screens/ExpertDetails.tsx#L396)).

**Credit display.** Today the only signal is the `"Book with {{count}} free credit"` button label. Add a card above
the action row:

```
┌──────────────────────────────────────────┐
│ 🎟  Consultation credits                 │
│                                          │
│     2 available                          │
│     This booking uses 1 · 1 will remain  │
└──────────────────────────────────────────┘
```

At zero credits / free tier the same card reads `Pay ₹{{amount}} for this consultation`, so the user knows _why_ the
payment sheet is about to open. New i18n keys: `expertDetails.creditsAvailable`, `creditsUsage`, `payPerSession`.

**Post-booking confirmation.** Both `bookWithCredit` and `bookConsultation` currently show
`expertDetails.bookingSuccess`. Replace with the client's copy:

> **Booking confirmed** — We'll try to schedule within your preferred slot. We'll share the exact call timing with you
> over WhatsApp.

> ⚠️ A toast is short-lived for a message this important. Recommendation: a **confirmation modal with an OK button**
> instead of (or in addition to) the toast. Toast-only is what was specified and is acceptable — flagging it as a
> suggestion, decision pending. See §8.

Both booking calls send `preferredSlot`.

### 5.2 [`ActiveConsultation.tsx`](src/components/ActiveConsultation.tsx) — the banner

Grows from a one-line gradient strip into a card:

```
┌────────────────────────────────────────────┐
│ Upcoming consultation                      │
│ Dr. Anita Rao · 31 Jul 2026                │
│ Preferred slot: 9:00 AM – 12:00 PM         │
│ ✓ Confirmed for 10:30 AM     ← when set    │
│                                            │
│  [ Join now ]   ← disabled until T-5min    │
│  Opens 5 minutes before your call          │
│ ─────────────────────────────────────────  │
│ Need to reschedule or cancel?              │
│  [ 💬 Chat with us on WhatsApp ]           │
└────────────────────────────────────────────┘
```

Key behaviours:

- **Remove the early return at [line 12](src/components/ActiveConsultation.tsx#L12).**
  `preferred_consultation_date < new Date()` currently hides the banner from midnight on the consultation day — which
  would hide it during exactly the window the Join button is meant to be live. Visibility is now server-driven (§4.4).
- **Join button state machine:**
  - no `meeting_confirmed_at` → disabled, subtitle _"We'll confirm your exact time over WhatsApp"_
  - confirmed, before T−5 min → disabled, subtitle _"Join opens at 10:25 AM"_
  - within window → **enabled**, `Linking.openURL(meeting_link)`
  - `meeting_link == null` but confirmed → _"Joining link coming shortly"_, no button
- **The unlock must be live.** A `setInterval(…, 30_000)` re-evaluating against `Date.now()`, cleared on unmount —
  otherwise a user sitting on the dashboard at 10:24 never sees the button enable.
- **Care-manager consultations** (`consultationType === CARE_MANAGER`) render the old simple strip; none of this
  applies to them.
- **WhatsApp button:** `Linking.openURL('https://wa.me/919599120017?text=' + encodeURIComponent(prefill))` where
  `prefill` is _"Hi, I'd like to modify my consultation booking (Ref: &lt;id&gt;) with Dr. X on 31 Jul."_ — pre-filling
  the ref saves the support agent a round-trip. The number belongs in `src/constants/` next to the other URLs, not
  inline.

### 5.3 Types & i18n

- `IUserActiveConsultations` in [`consultation.types.ts`](src/types/consultation.types.ts) gains `preferred_slot`,
  `meeting_link`, `meeting_confirmed_at`, `joinUnlocksAt`, `canJoinNow`.
- New `PreferredSlot` enum + label map app-side (labels via i18n, not hardcoded).
- All new strings into **both** `en.json` and `hi.json` — these are static UI text, which is exactly what gets
  translated. Slot labels included. Expert names and other backend content stay untouched.

---

## 6. Ops runbook

1. Patient books → WhatsApp lands on **9599691619** with all 9 fields, including the Meet link and booking ref.
2. Coordinator calls/messages the doctor, agrees a 30-minute start inside the preferred slot.
3. Coordinator sends back: `<booking ref> → 31 Jul, 10:30 AM`.
4. `PATCH /admin/consultation/:id/confirm-time` (or edit `meeting_confirmed_at` in Mongo — **store the UTC instant;
   10:30 AM IST is `04:30:00Z`**. This is the single easiest thing to get wrong by hand, and the reason §4.5 exists).
5. Patient's banner flips to "Confirmed for 10:30 AM"; Join unlocks at 10:25.
6. After the call, the doctor's prescription goes to the patient's WhatsApp/email manually — param 2 in the template
   is there precisely so the coordinator has it without a lookup.

---

## 7. Sequencing

> Workspace already exists (§1.2), so the two phases below can now ship together. They are kept separate because the
> `GOOGLE_MEET_ENABLED` flag remains the kill switch if the Meet API misbehaves in production — the booking flow stays
> fully functional with it off.

### Phase 1 — the flow

Schema changes + migration · slot picker · credit card · confirmation copy · banner redesign · WhatsApp v2 template ·
`finalizeExpertBooking` (fixes the credit-path WhatsApp gap) · admin confirm-time endpoint.

Works with `GOOGLE_MEET_ENABLED=false` and links pasted manually — useful for testing the whole loop before touching
GCP.

### Phase 2 — link generation

GCP steps in §1.3 B, then flip `GOOGLE_MEET_ENABLED=true`. Zero app changes, zero schema changes — the field was
nullable from day one.

### Phase 3 — nice-to-haves

Push notification on time-confirm · auto-mark `COMPLETED` after the call window (a Cloud Scheduler job, matching the
existing cron pattern) · in-app reschedule/cancel instead of via WhatsApp.

---

## 8. Decisions — all resolved 28 Jul 2026

1. **Google Workspace** — ✅ already owned. Business Starter, Active, 6 licences. No purchase needed. Meet API
   verified working end to end against `consultations@vivamama.in` with `accessType: OPEN` confirmed in the response.
2. **Confirmation UI** — **modal**, not toast. The "exact timings over WhatsApp" note is too important to slide away
   after three seconds. Built as `BookingConfirmedModal`, shared by all three booking routes.
3. **Slot availability** — a slot is bookable only if its **start is at least 2 hours away**. This naturally rules out
   elapsed same-day windows and also stops a 2:58 PM booking into the 3:01 PM slot, which would leave no time to reach
   the consultant. Enforced in the app (greyed pills) and re-checked server-side.
4. **Care managers** — get the **identical flow**: slot picker, Meet link, confirmed time, same banner. Still
   credit-only and PREMIUM-gated, so there is no pay-per-session branch on that side.
5. **Notification routing** — `contactWhatsappNumber` added to **both** `experts` and `care_managers`, every row
   backfilled to `919599691619`. Care managers keep their own `phoneNumber` untouched as a separate contact detail.

---

## 9. What was built — deviations from the plan above

Implemented 28 Jul 2026. Three things ended up different from §2–§5 and are worth knowing:

- **One WhatsApp sender, not two.** `sendWhatsappMessageForExpertConsultation` and
  `sendWhatsappMessageForCareManager` were deleted and replaced by a single
  `sendWhatsappMessageForConsultationBooking(template, params)`. Both templates carry the identical nine parameters,
  so two near-duplicate files would have been two places to get the positional order wrong.
- **One booking sheet for both care-manager entry points.** `CareManagerCard` and `VivaBuddyRequestCall` had
  copy-pasted booking logic, and picking a date fired the request immediately — nowhere to insert a slot step. Both
  now render a shared `ConsultationBookingSheet` (date + slot + credit summary + confirm).
- **Slot maths lives in a tested module.** `constants/consultation-slots.ts` server-side and
  `constants/consultationSlots.ts` app-side, mirrored deliberately. Covered by `__tests__/consultationSlots.test.ts`
  (11 cases), which pins `TZ=UTC` because Cloud Run does — the timezone bugs here are the ones that put a patient on
  a call five and a half hours late.

**Still manual, by design:** the exact time is set through `PATCH /admin/consultation/:id/confirm-time`. The endpoint
rejects a time outside the booked slot, which is the guard that catches a hand-typed `10:30` parsed as UTC.

**Not built:** in-app reschedule/cancel (WhatsApp deep link instead, as specified) and the Phase 3 items in §7.

## References

- [Meet API — meeting spaces overview](https://developers.google.com/workspace/meet/api/guides/meeting-spaces-overview)
- [Meet API — configure meeting spaces and members](https://developers.google.com/workspace/meet/api/guides/meeting-spaces-configuration)
- [Google Workspace — control API access with domain-wide delegation](https://support.google.com/a/answer/162106?hl=en)
- [Google Meet guest access without a Google account](https://videocalling.app/blog/google-meet-without-gmail-account)
