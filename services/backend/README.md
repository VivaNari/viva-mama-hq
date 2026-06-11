# @vivamama/backend

VivaMama **core API** — a Node.js + TypeScript + **Express 5** service backed by
**MongoDB** (Mongoose) and **Redis**. It powers onboarding, guided check-ins, the
**Viva Recovery Score**, the recommendation engine, payments, chat (SSE), and
expert consultations.

> Deep architecture map: [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md).

## Tech stack

Express 5 · Mongoose 8 · ioredis · socket.io + SSE · JWT + Google Sign-In ·
Razorpay · Twilio/GetGabs · Firebase Admin (FCM) · Joi · Pino · node-cron ·
Jest + Supertest · k6.

## Prerequisites

- Node.js ≥ 20 and **pnpm** (`corepack enable`)
- MongoDB and Redis (local installs, or `docker compose up mongo redis` from the repo root)
- Install deps once from the **repo root**: `pnpm install`

## Setup

```bash
cp services/backend/.env.example services/backend/.env   # then fill in values
```

See [`.env.example`](./.env.example) for every variable. Firebase credentials use
**Application Default Credentials** — set `GOOGLE_APPLICATION_CREDENTIALS` to a
mounted key path (never commit the key) or rely on the GCP runtime service account.

## Run

```bash
# from the repo root
pnpm --filter @vivamama/backend dev      # ts-node + nodemon (hot reload)
pnpm --filter @vivamama/backend build    # tsc -> build/
pnpm --filter @vivamama/backend start    # run compiled build/index.js
```

Health check: `GET http://localhost:4000/health`. API is versioned under `/api/v1`.

## Test, lint, typecheck

```bash
pnpm --filter @vivamama/backend test       # Jest (NODE_ENV=test)
pnpm --filter @vivamama/backend lint
pnpm --filter @vivamama/backend typecheck
pnpm --filter @vivamama/backend k6:login   # k6 load tests (k6 required)
```

## Docker

Built as part of the full stack from the repo root (the image builds from the
**repository root** context so the `@vivamama/contracts` workspace dependency
resolves):

```bash
docker compose up --build backend
```

## Shared contract

Shared endpoint paths and domain types come from
[`@vivamama/contracts`](../../packages/contracts) (re-exported locally at
`src/shared/contracts.ts`). Prefer it over redefining DTOs.
