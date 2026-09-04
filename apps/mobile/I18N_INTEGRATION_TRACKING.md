# i18n (Hindi) — Frontend Integration Tracking

Tracks the frontend work that connects the app to the backend's Hindi (`hi`)
localization (see `vivamam_core_server/I18N_FRONTEND_INTEGRATION.md` for the API
contract).

## Goal

Move language selection from the post-onboarding dashboard popup to a dedicated
screen shown **before onboarding**, persist the choice **both locally
(AsyncStorage) and on the backend** (`PUT /user/update-user-data` with
`preferred_language`), and make every content request return the selected
language.

## Why "before onboarding"

`preferred_language` is consumed server-side by three things that cannot be
fixed retroactively, so it must be set as early as possible:

- the guided onboarding chat (runs during onboarding),
- push notifications,
- the recommendation snapshot (frozen in the language used at check-in time).

## Decisions (locked in)

- **Pre-login Landing toggle (scenario 1):** deferred to a later phase. Core
  flow works without it. Reconciliation on login is still built so it slots in
  later.
- **`LanguageSelectorModal`:** retired in favor of a single full screen
  (`LanguageSelection`), one code path everywhere.
- **Interceptor `lang` injection:** enabled — every backend request carries
  `?lang=<active>` for instant content correctness; persisted
  `preferred_language` covers server-initiated cases (push, SSE, snapshot).

## Where the screen appears (by scenario)

| Scenario | Placement | Persist |
|---|---|---|
| New user, logged in, not onboarded | First route of OnboardingStack (gate) | local + backend |
| Existing user who never chose | Gate in AppStack before dashboard | local + backend |
| Changing language later | Settings → Language row (settings mode) | local + backend |
| New user before login (deferred) | Landing toggle | local, synced after login |

## Task checklist

- [x] `updatePreferredLanguage(code)` API (`src/api/updateuserData.ts`)
- [x] `LanguageContext`: push to backend on change + reconcile on login
- [x] `apiClientInterceptor`: inject `lang` query param on backend requests
- [x] `LanguageSelection` screen (modes: `gate` | `settings`)
- [x] OnboardingStack: register screen + gate before onboarding chat
- [x] AppStack: register screen + replace `LanguageGate` popup
- [x] MyProfile: language row navigates to screen; retire modal
- [x] Locale keys for the screen (`en.json`, `hi.json`)
- [x] Remove `LanguageGate.tsx` and `LanguageSelectorModal.tsx`
- [x] SSE URLs (`CHAT_SESSION_URL`, `CHECKIN_SESSION_URL`): append `&lang=` so
      streamed onboarding/check-in questions are localized (bypass axios)

## Status

Core integration complete. `tsc` introduces no new errors from these changes
(pre-existing errors in `vivaClubData.ts`, `FLExpertCategoryItem.tsx`, and the
`SubscriptionDetails` screen-prop typing are unrelated).

### Remaining / deferred

- Pre-login Landing language toggle (scenario 1) — deferred to a later phase;
  reconciliation on login is already in place to support it.
- Manual QA: new-user onboarding gate, existing-user dashboard gate, settings
  change, and verifying `?lang=hi` reaches experts/products/contents responses.

## Notes

- Provider order is `AuthProvider > LanguageProvider`, so `LanguageContext`
  consumes `useAuth()` for the token.
- SSE (guided chat) is not routed through axios, so it relies on the persisted
  `preferred_language`, not the interceptor.
