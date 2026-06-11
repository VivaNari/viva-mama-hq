# @vivamama/mobile

VivaMama (**Viva Nari**) mobile app — a **React Native 0.81 + TypeScript** (React 19)
companion for mothers: onboarding, guided check-ins, the **Viva Recovery Score**
dashboard, **Viva AI** chat (SSE), content/products/experts, consultations, and the
**Viva Club** community.

> Deep architecture map: [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md).

## Tech stack

React Native 0.81 · React 19 · React Navigation 7 · Axios + SSE · AsyncStorage +
SQLite · Google Sign-In + phone OTP + JWT · Firebase Cloud Messaging · Razorpay ·
Reanimated · Jest + Testing Library.

## Prerequisites

- Node ≥ 20, **pnpm** (`corepack enable`), and a full
  [React Native environment](https://reactnative.dev/docs/set-up-your-environment)
  (Android Studio / Xcode, JDK, CocoaPods).
- Install JS deps once from the **repo root**: `pnpm install`.

> This app lives in a pnpm monorepo. We use `node-linker=hoisted` (`.npmrc`) and a
> monorepo-aware [`metro.config.js`](./metro.config.js) so Metro resolves the
> hoisted root `node_modules` and watches `packages/*`.

## Setup

```bash
cp apps/mobile/.env.example apps/mobile/.env     # then fill in values

# Firebase config files are NOT committed — add them manually:
#   android/app/google-services.json
#   ios/<App>/GoogleService-Info.plist

# iOS only: install pods
cd apps/mobile/ios && bundle install && bundle exec pod install && cd -
```

All env vars are documented in [`.env.example`](./.env.example). Values are bundled
into the app at build time — **never put server secrets here**.

## Run

```bash
pnpm --filter @vivamama/mobile start                 # Metro
pnpm --filter @vivamama/mobile android               # build & run on Android
pnpm --filter @vivamama/mobile ios                   # build & run on iOS
```

## Test, lint, typecheck

```bash
pnpm --filter @vivamama/mobile test
pnpm --filter @vivamama/mobile lint
pnpm --filter @vivamama/mobile typecheck
```

## Release (Android)

```bash
pnpm --filter @vivamama/mobile assemble-release      # ./gradlew assembleRelease
```

> Signing: the committed `android/app/debug.keystore` is the standard,
> non-sensitive Android **debug** key. Release/upload keystores must be kept
> private and supplied out-of-band — never commit them.
