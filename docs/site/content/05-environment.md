---
title: Environment & config
section: Getting started
description: Creating the .env files each service reads, and the one template that is missing.
---

Every service reads its own `.env`. **None of them are committed** — the repo ships
`.env.example` templates instead, and `.gitignore` blocks real `.env` files at every level.

## The templates that exist

```bash
cp .env.example                  .env                        # compose ports only
cp apps/admin/.env.example       apps/admin/.env
cp apps/mobile/.env.example      apps/mobile/.env
cp services/chatbot/.env.example services/chatbot/.env
```

## The one that doesn't

> ⚠️ **Known issue — this will block you.** `README.md` and `CONTRIBUTING.md` both tell
> you to run `cp services/backend/.env.example services/backend/.env`. **That file is not
> in the repository.** `services/backend/.gitignore` line 2 is `.env.*`, and unlike the
> root `.gitignore` it has no `!.env.example` negation — so the template is ignored and
> was never committed. A fresh clone cannot configure the backend.
>
> **Fix:** add `!.env.example` to `services/backend/.gitignore` and commit the template.
> Until then, ask a maintainer for a copy, or build one from the reference below.

### Backend variables

The backend reads **55** environment variables. Grouped by concern:

| Group | Variables |
| --- | --- |
| Runtime | `NODE_ENV`, `PORT`, `SERVICE_NAME`, `SERVICE_VERSION`, `DEPLOYMENT_ENV` |
| Data stores | `MONGO_URI`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| Crypto | `JWT_SECRET`, `CRYPTO_PASSWORD` |
| Firebase / Google | `FIREBASE_SA_KEY_JSON`, `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLIENT_ID` |
| Google Meet | `GOOGLE_MEET_ENABLED`, `GOOGLE_MEET_SA_KEY_JSON`, `GOOGLE_MEET_IMPERSONATED_USER` |
| Messaging | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_WHATSAPP_PHONE_NUMBER`, `GETGABS_API_KEY`, `GETGABS_SENDER`, `GETGABS_CAMPAIGN_ID` |
| Payments | `BILLING_MODE`, `RAZORPAY_API_KEY`, `RAZORPAY_SECRET_KEY`, `RAZORPAY_WEBHOOK_SECRET`, `PLAY_DEVELOPER_SA_KEY_JSON`, `PLAY_PACKAGE_NAME` |
| Chatbot link | `LLM_SERVER_URL`, `LLM_API_KEY` |
| Logging | `LOG_LEVEL`, `LOG_PRETTY_PRINT`, `LOG_TO_FILE`, `LOG_FILE_PATH`, `LOG_RESPONSE_BODY`, `ENABLE_PII_REDACTION` |
| Telemetry | `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_AUTH_MODE`, `OTEL_COLLECTOR_AUDIENCE`, `OTEL_TRACES_ENABLED`, `OTEL_METRICS_ENABLED`, `OTEL_DIAG_LOG_LEVEL` |
| Jobs | `ENABLE_IN_PROCESS_CRON`, `CRON_DEV_SECRET`, `SCHEDULER_SA_EMAIL`, `PUBSUB_PUSH_SA_EMAIL`, `CLOUD_RUN_URL` |
| Admin & misc | `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `BECKN_BPP_CALLER_URL`, `PURGE_CONFIRM`, `PURGE_ALLOW_PROD` |

A minimal local `services/backend/.env` to get the server booting against the Docker
stack:

```bash
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://localhost:27017/viva_mama
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=dev-only-not-a-real-secret
CRYPTO_PASSWORD=dev-only-not-a-real-secret
LOG_LEVEL=debug
LOG_PRETTY_PRINT=true
OTEL_ENABLED=false
```

> 🚧 **Needs filling in** — this minimum is inferred from `src/config/env.ts`, which
> applies defaults rather than validating a required set. Endpoints that touch payments,
> SMS/WhatsApp, Firebase auth or Google Meet will fail until you supply real credentials
> for those groups. A maintainer should confirm the true minimum.

## Generating secrets

Never invent a weak value for a secret, even locally — local `.env` files get copied.

```bash
openssl rand -hex 32
```

The chatbot's `.env.example` recommends exactly this for its `API_KEY`.

## What must never go in a client bundle

`apps/mobile/.env` is compiled **into the app binary**. Treat everything in it as public.
The template says so explicitly, and it matters most for payments:

- ✅ `RAZORPAY_API_KEY` — the publishable key id (`rzp_test_…` / `rzp_live_…`)
- ❌ `RAZORPAY_SECRET_KEY` — **backend only.** Order creation and signature verification
  are signed server-side. Shipping the secret would expose the payment account.

The same applies to `apps/admin` — Vite inlines every `VITE_`-prefixed variable into the
built JavaScript.

## Firebase files

Two credential files are git-ignored and must be downloaded from the Firebase console by
hand:

```text
apps/mobile/android/app/google-services.json
apps/mobile/ios/<App>/GoogleService-Info.plist
```

> 🚧 **Needs filling in** — you need access to the Firebase project to obtain these. Ask a
> maintainer. The mobile app will not build without them.

## Check

```bash
ls -a services/backend/.env services/chatbot/.env apps/admin/.env
```

Next: [Running locally →](/running)
