# VivaMama Core Server — Project Overview

> Backend API for **VivaMama** (aka Viva Nari), a postpartum/maternal health platform for mothers.
> This document is a high-level map of the codebase so it can be navigated quickly.

## What it is

A **Node.js + TypeScript + Express 5** REST API backed by **MongoDB (Mongoose)** and **Redis**.
It powers the [`viva_nari_app`](../../react_native/viva_nari_app) React Native mobile app.

The core product loop:
1. A mother onboards (questionnaire + subscription).
2. She does periodic **check-ins** via a guided chat flow (weekly check-in, mood log, sleep log, etc.).
3. The **Score Engine** turns her answers into a **Viva Recovery Score** across 3 categories — **physical**, **lactation**, **emotional**.
4. The **Recommendation Engine** maps that score (week + zone + weakest category) to personalized recommendations, tips, content, and products.
5. Results are stored as **recommendation history** and surfaced on the app dashboard.
6. An **LLM-backed chat** ("Viva AI") and **expert consultations** provide further support.

## Tech stack

| Concern | Choice |
|---|---|
| Runtime / language | Node.js, TypeScript (CommonJS), `ts-node` + `nodemon` in dev |
| Web framework | Express 5 |
| Database | MongoDB via Mongoose 8 (`mongoose-sequence` for auto-increment IDs) |
| Cache / pubsub | Redis via `ioredis` (publisher/subscriber services) |
| Realtime | `socket.io`, plus Server-Sent Events (SSE) for chat streaming |
| Auth | JWT (`jsonwebtoken`); Google Sign-In (`google-auth-library`); phone OTP |
| Payments | Razorpay |
| Messaging | Twilio (SMS) + GetGabs (WhatsApp); Firebase Admin (FCM push) |
| Validation | Joi (via `requestValidator` middleware) |
| Logging | Pino (`pino-http`), correlation IDs, PII redaction |
| Scheduling | `node-cron` |
| Testing | Jest + Supertest (`__tests__/`); k6 load tests (`load-tests/`) |
| Lint/format | ESLint (airbnb-typescript) + Prettier, Husky + lint-staged |

## Entry points

- [`src/index.ts`](src/index.ts) — boots the server: connects DB, initializes Redis subscriber, starts cron jobs, listens on `env.PORT`.
- [`src/app.ts`](src/app.ts) — Express app: CORS, JSON, correlation-id + request-logger middleware, mounts routers, error handler. Health check at `/health`.
- [`src/api/v1/routes/index.ts`](src/api/v1/routes/index.ts) — aggregates all feature routers under `/api/v1`.

## Directory structure (`src/`)

Layered architecture — **routes → validators → controllers → services → models**.

```
api/v1/
  routes/        Express routers, one folder/file per feature
  controllers/   Request handlers (thin); call services
  validators/    Joi schemas used by requestValidator middleware
config/          db.ts, env.ts, firebase.ts, redis.config.ts
constants/       App constants (chat slugs, score text, taglines, messages, etc.)
cron-jobs/       Scheduled jobs (see below)
handlers/        Cross-service orchestration (score-recommendation.handler.ts)
middlewares/     auth, correlationId, errorHandler, requestLogger, requestValidator
models/          Mongoose models + models/schema/ for the schema definitions
services/        Business logic, one folder per domain
types/           Shared TypeScript types
utils/           Helpers: logger (pino), JWT, push notifications, date math, session mgmt
```

## Key domains / features (services & routes)

- **Users & auth** — Google auth, phone OTP (Twilio/GetGabs), JWT issuance, FCM token, consent tracking (privacy policy / terms versions), onboarding data. `users/`, `childs/`.
- **Weekly check-in** — guided questionnaire flows. Two generations live side by side: `weeklyCheckin/` (legacy) and `weekly-checkin-v1/` (newer, with validation service). Streams via SSE.
- **Chat system / flows** — generic guided-flow engine: `flowDefinition`, `flowNodeCategory`, `flowInstance`, `flowResponse` models; `chat-system/` services including `chat-flow-ai.service.ts` (LLM). Drives mood-log / sleep-log / daily-interaction style conversations.
- **Score engine** — `score-engine/scoreEngine.service.ts`: computes the Viva Recovery Score (physical / lactation / emotional categories, raw + weighted, zones, weakest category).
- **Recommendations** — `recommendations/`: recommendation engine maps score → recommendation; `recommendation-history` persists results. Orchestrated by [`handlers/score-recommendation.handler.ts`](src/handlers/score-recommendation.handler.ts).
- **Content** — articles/educational content (`contents/`).
- **Products** — recommended products catalog (`products/`).
- **Experts & consultations** — expert directory (`expert/`), book consultation w/ Razorpay payment (`book-consultation/`), consultations lifecycle (`consultations/`), consultation reviews (`consultation-reviews/`), care managers (`care-manager/`, WhatsApp callbacks via GetGabs).
- **Payments** — Razorpay order create/verify, subscription plans (`payments/`).
- **VivaClub** — community feature: posts + comments + likes (`vivaClub/`, mounted at `/api/v1/viva-club`).
- **AI message bookmarks** — save/recall Viva AI messages (`ai-message-bookmark/`).
- **Support** — support ticket creation (`support/`).
- **LLM** — `services/llm/llm.service.ts` talks to an external LLM server (`LLM_SERVER_URL` / `LLM_API_KEY`).
- **Redis pub/sub** — `redis/redis-publisher.service.ts` & `redis-subscriber.service.ts` decouple score calculation from recommendation/notification side effects.

## Cron jobs ([`src/cron-jobs/`](src/cron-jobs/))

Registered in [`cron-jobs/index.ts`](src/cron-jobs/index.ts):
- **`logsReminders`** — daily 10:00 AM, reminders to log.
- **`dailyVivaInteraction`** — daily 9:00 AM, daily Viva AI nudge.
- **`weeklyContentNotification`** — Sundays 10:00 AM, push weekly content.
- Several other jobs exist but are currently commented out (postpartum-week calculation, start/continue conversation, due-days calculator). Run manually via `npm run cron:core-job`.

## Environment ([`src/config/env.ts`](src/config/env.ts))

Reads from `.env`. Notable vars: `MONGO_URI`, `PORT`, `JWT_SECRET`, `CRYPTO_PASSWORD`, `GOOGLE_CLIENT_ID`, Redis config, `TWILIO_*`, `GETGABS_*`, `RAZORPAY_API_KEY`/`RAZORPAY_SECRET_KEY`, `LLM_SERVER_URL`/`LLM_API_KEY`, logging (`LOG_LEVEL`, `ENABLE_PII_REDACTION`, etc.). Firebase service account at `VivaMamaServiceAccountKey.json`.

## Scripts (`package.json`)

- `npm run dev` — nodemon + ts-node (`src/index.ts`)
- `npm run build` / `npm start` — tsc to `build/`, run compiled
- `npm test` — Jest (`NODE_ENV=test`)
- `npm run lint` / `lint:fix` / `format`
- `npm run k6:login | k6:checkin | k6:products | k6:vivaclub` — k6 load tests
- `npm run cron:core-job` — run the week/due-days cron manually

## Deploy

Dockerized (`Dockerfile`, `docker-compose.yml`). Deployed to Google Cloud Run (app talks to `https://nodejs-api-323430318910.asia-south1.run.app`).

## Conventions / notes

- API is versioned under `/api/v1`.
- Auth via `authMiddleware()` (token from header or query param — query is used for SSE streams).
- Joi validators run via `requestValidator` middleware before controllers.
- Mongoose models split into `models/*.model.ts` (model) and `models/schema/*.schema.ts` (schema).
- Numeric `user_id` / `child_id` are auto-incremented alongside Mongo `_id`.
- Two parallel "weekly-checkin" implementations exist — prefer `weekly-checkin-v1` for new work.
