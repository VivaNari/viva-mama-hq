# Viva Nari App — Project Overview

> **VivaMama** (Viva Nari) mobile app — a postpartum/maternal health companion for mothers.
> Frontend for the [`vivamam_core_server`](../../mern/vivamam_core_server) backend.
> This document maps the codebase for fast navigation.

## What it is

A **React Native 0.81 + TypeScript** app (React 19) for Android & iOS. It helps mothers:
- Onboard (questionnaire + subscription).
- Do guided **check-ins** (weekly check-in, mood log, sleep log, feeding/vaccination logs).
- See their **Viva Recovery Score** and trends on a dashboard.
- Chat with **Viva AI** (LLM, streamed over SSE).
- Browse **content/articles**, **products**, and **experts**; book expert consultations.
- Participate in the **Viva Club** community.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | React Native 0.81, React 19, TypeScript |
| Navigation | React Navigation 7 (native-stack + bottom-tabs) |
| State | React Context (`AuthContext`, `CounterContext`) + `useReducer` (chat, subscription) |
| Local storage | AsyncStorage (token, onboarding status); SQLite (`react-native-sqlite-storage`) for chat history |
| Networking | Axios (+ `axios-retry`) with an interceptor; `react-native-sse` for streamed chat |
| Auth | Google Sign-In (`@react-native-google-signin`), phone OTP, JWT (`jwt-decode`) |
| Push | Firebase Cloud Messaging (`@react-native-firebase/messaging`) |
| Payments | Razorpay (`react-native-razorpay`) |
| UI | Linear gradients, vector icons (Lucide / Material), bottom sheets (`@gorhom/bottom-sheet`), reanimated, gifted-charts, toast, splash screen |
| Env | `react-native-dotenv` (`@env`) |
| Testing | Jest + `@testing-library/react-native` (`__tests__/`) |

## Entry points

- [`index.js`](index.js) — RN registration + FCM background handler.
- [`App.tsx`](App.tsx) — initializes SQLite, syncs user data if logged in, hides splash, wires providers (SafeArea → GestureHandler → BottomSheetModal → **AuthProvider** → CounterProvider → BottomSheetProvider → RootNavigator), mounts Toast.
- [`src/navigators/RootNavigator.tsx`](src/navigators/RootNavigator.tsx) — top-level auth gating + FCM notification routing.

## Navigation structure

`RootNavigator` swaps between three stacks based on auth + onboarding state ([`AuthContext`](src/context/AuthContext.tsx) `isFullyOnboarded()`):

- **AuthStack** — Landing, Login with phone (OTP), Google sign-in.
- **OnboardingStack** — questionnaire steps + subscription selection.
- **AppStack** ([`stacks/AppStack.tsx`](src/navigators/stacks/AppStack.tsx)) — the main app, containing:
  - **DashboardTabs** (bottom tabs): **Dashboard** (Home), **Viva AI** (chat), **Experts**, **Products**, **Contents**.
  - Stacked screens: Recommendations & details, Full Report, Products & details, Article/Content screens, Viva Club (posts, details, create post), Expert details, Subscription, Profile/Edit/Add Partner, Notifications, Support, About screens, Feeding Log, Vaccination Log, Consultation Rating, Bookmarked Messages.

`RootNavigator` also handles **FCM notifications** — deep-links to chat flows (mood/sleep log), article details, consultation rating, or daily Viva interaction depending on `type`/`flowSlug`/`consultationId` in the payload.

## Directory structure (`src/`)

```
api/           Axios call wrappers (one file per endpoint) + apiClientInterceptor + authToken
components/     Reusable UI, grouped by feature (dashboard, onboarding, subscriptions,
               experts, products, recommendations, community, vivaClub, chatBubble, bottomSheet)
constants/     endpoints.ts (all API URLs), chat, fonts, subscription
context/        AuthContext (auth + onboarding state), CounterContext
data/           Static/seed/config data for UI (phq questions, profile forms, etc.)
db/             sqlite.ts — local chat history store
hooks/          useChat* (session/messages/actions), useGuidedFlow, usePayment, useSubscription, useFirstTimeCheck
navigators/     RootNavigator + stacks/ + tabs/
public/         assets/ (colors, fonts, images) + styles/ (per-feature StyleSheets)
reducers/       chatReducer, subscriptionReducer
screens/        Full screens (one per route)
types/          TypeScript types / .d.ts declarations
utils/          JWT decode, FCM token, syncUserData, date/IST, logger, message/payment helpers
```

## Key flows

- **Auth** ([`context/AuthContext.tsx`](src/context/AuthContext.tsx)): Google or phone-OTP login → JWT stored in AsyncStorage → `syncUserData` populates local state → onboarding status drives which stack shows. Tracks consent versions (`CURRENT_VERSIONS`). Manages FCM token registration/refresh to backend.
- **Chat / Viva AI** ([`screens/ChatWithVivaAI.tsx`](src/screens/ChatWithVivaAI.tsx), `hooks/useChat*`, `reducers/chatReducer.ts`): messages streamed via SSE (`CHAT_SESSION_URL`), persisted to SQLite; supports guided flows (`useGuidedFlow`) and message bookmarking.
- **Check-ins**: guided question/answer flows started/answered via `GUIDED_FLOW_START`/`GUIDED_FLOW_ANSWER` and `CHECKIN_SESSION_URL` (SSE).
- **Dashboard** ([`screens/Dashboard.tsx`](src/screens/Dashboard.tsx)): shows Viva Recovery Score (`dashboard/viva-score`), recommendations, mother/infant tabs.
- **Payments / Subscription** (`hooks/usePayment`, `useSubscription`): Razorpay create/verify orders for subscription and consultation booking.

## API configuration

All endpoints live in [`src/constants/endpoints.ts`](src/constants/endpoints.ts). Base URL is hardcoded to the Cloud Run backend (`https://nodejs-api-323430318910.asia-south1.run.app`); a localhost line is commented for dev. API version path is `/api/v1`. Auth token attached by `api/apiClientInterceptor.ts`.

## Scripts (`package.json`)

- `npm start` — Metro bundler
- `npm run android` / `npm run ios` — run on device/emulator
- `npm test` — Jest
- `npm run lint`
- `npm run assemble-release` — Gradle release build (Android)

## Notes / conventions

- Requires Node >= 20. Env vars via `@env` (see `.env`, `src/types/env.d.ts`).
- Styles are centralized per feature under `public/styles/`; colors in `public/assets/colors.ts`; fonts Lexend / YsabeauInfant.
- Two chat screens exist — `ChatWithVivaAI.tsx` (current) and `ChatWithVivaAIOld.tsx` (legacy).
- `Services copy.tsx` is the active "Services" screen (legacy filename).
