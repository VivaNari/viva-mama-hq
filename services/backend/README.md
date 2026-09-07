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

## Logging and OpenTelemetry

Logging is pino. Import the root logger and derive a child for your module — the child's
`component`/`module` bindings become attributes on the exported OTel log records:

```ts
import logger, { createModuleLogger } from "../utils/logger";

const log = createModuleLogger(logger, "subscription.service");
log.info({ userId }, "Subscription renewed");
```

Do **not** put request context (`correlationId`, `requestId`) or trace ids into child
bindings. pino freezes child bindings at creation time, so a logger built at module scope
would capture an empty context once and repeat it forever. Request context is added per
record by the `mixin` in `src/utils/logger/pino.config.ts`, and `trace_id`/`span_id` by
`@opentelemetry/instrumentation-pino`. Both work automatically.

Log records are exported over OTLP/HTTP to a collector that runs as its own Cloud Run
service. This is **additive**: stdout still goes to Cloud Logging, so nothing is lost if
the collector is unreachable. With `OTEL_EXPORTER_OTLP_ENDPOINT` unset, telemetry silently
no-ops — which is the intended state locally and in CI.

`src/telemetry.ts` must stay the **first import in `src/index.ts`**. The SDK patches
modules as they are required, and `./app` transitively loads express, mongoose, ioredis
and axios.

To see what the backend actually emits:

```bash
docker compose up otel-collector          # prints received records to stdout

OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 OTEL_AUTH_MODE=none \
OTEL_TRACES_ENABLED=true pnpm --filter @vivamama/backend diagnose:otel
```

`diagnose:otel-http` does the same for the HTTP path (spans, correlation-id unification,
error recording). Set `OTEL_DIAG_LOG_LEVEL=debug` to surface exporter failures — a 403
against the real collector means the runtime service account is missing
`roles/run.invoker` on it.

Spans are opt-in via `OTEL_TRACES_ENABLED`; log records export either way, just without a
`trace_id`. See `services/backend/.env.example` for every key.

Tracing coverage comes from `@opentelemetry/auto-instrumentations-node`, so `express`,
`mongoose`, `ioredis` and `http` are instrumented with no code change — and adding a new
library later gets you spans for free. Coverage is retunable **from the environment, with
no redeploy of application code**:

```bash
OTEL_NODE_DISABLED_INSTRUMENTATIONS=dns,net,router          # blocklist
OTEL_NODE_ENABLED_INSTRUMENTATIONS=http,express,mongoose    # allowlist (wins)
```

`src/telemetry.ts` seeds the blocklist with **`dns,net,router`** when the variable is
absent. `dns` and `net` emit a span per DNS lookup and per TCP connect — against Mongo,
Redis, Firebase and Twilio that is large, permanent volume for little insight. `router`
duplicates every Express 5 route span, because Express 5 delegates routing to the
standalone `router` package that `instrumentation-express` already covers; disabling it
took a single request's trace from 6 spans to 4.

> Setting either variable to an **empty string is not the same as leaving it unset** — the
> default is only applied when the variable is absent, so an empty value turns the noisy
> instrumentations back on.

Two consequences worth knowing:

- With `OTEL_TRACES_ENABLED=false` only the pino instrumentation loads, not all 39. The
  bundle costs roughly 100 ms of cold start, which matters here because Cloud Run scales
  this service to zero.
- Disabling `router` also drops the `middleware - errorHandler` span, since
  `instrumentation-express` does not wrap 4-argument error middleware. The error itself is
  still fully captured — [errorHandler.middleware.ts](src/middlewares/errorHandler.middleware.ts)
  calls `recordException` and sets the server span to `ERROR`.

**Do not enable `dbStatementSerializer` on the mongoose instrumentation.** It attaches raw
query text to spans, and your queries carry user ids, phone numbers and health data. Span
attributes do **not** pass through the pino redaction in `src/utils/logger/redaction.ts` —
`ENABLE_PII_REDACTION` has no effect on them. The default is off; leave it off.

> **Before upgrading pino past v10:** `@opentelemetry/instrumentation-pino` declares
> support for `>=5.14.0 <11`. Outside that range it does not warn or error — it simply
> stops patching, and log export goes quiet. The `^10.1.0` range in `package.json` cannot
> reach v11 on its own, so this only matters for a deliberate major bump. Check the
> instrumentation's supported range first, and re-run `diagnose:otel` afterwards.

## Shared contract

Shared endpoint paths and domain types come from
[`@vivamama/contracts`](../../packages/contracts) (re-exported locally at
`src/shared/contracts.ts`). Prefer it over redefining DTOs.
