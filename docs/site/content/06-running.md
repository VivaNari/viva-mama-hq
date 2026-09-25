---
title: Running locally
section: Getting started
description: The Docker stack, and how to run each service on its own.
---

Two ways to run: the whole stack in Docker, or individual services on your host. Most
day-to-day work uses Docker for the databases and a host process for whatever you're
editing.

## Everything at once

```bash
cp .env.example .env        # compose-level port overrides
docker compose up --build
```

This brings up five containers:

| Service | URL | Notes |
| --- | --- | --- |
| Backend | http://localhost:4000 | health check at `/health` |
| Chatbot | http://localhost:8001 | FastAPI; docs at `/docs` |
| MongoDB | `localhost:27017` | volume `mongo_data` |
| Redis | `localhost:6379` | volume `redis_data` |
| OTel collector | `localhost:4318` | OTLP/HTTP receiver |

Every port is overridable from the root `.env` — `BACKEND_PORT`, `CHATBOT_PORT`,
`MONGO_PORT`, `REDIS_PORT`, `OTEL_COLLECTOR_PORT` — which is the escape hatch if something
already owns `27017` on your machine.

The two clients are **not** in the stack. Run them separately, below.

```bash
make up      # docker compose up --build
make logs    # tail the logs
make down    # stop and remove volumes
```

Note that `make down` and `pnpm stack:down` both pass `-v`, which **deletes the database
volumes**. Use `docker compose stop` to pause without losing data.

## One service at a time

### Backend — port 4000

```bash
pnpm --filter @vivamama/backend dev
```

Runs `nodemon` + `ts-node` against `src/index.ts`, reloading on change. Needs MongoDB and
Redis reachable — easiest is `docker compose up mongo redis`.

Verify: <code>curl http://localhost:4000/health</code>

### Admin console — port 3039

```bash
pnpm --filter @vivamama/admin dev
```

Vite dev server with HMR. The port is set in `apps/admin/vite.config.ts`, and it expects
the backend at `VITE_SERVER_URL` (defaults to `http://localhost:4000`).

### Chatbot — port 8001

```bash
cd services/chatbot
uv run uvicorn app.api.main:app --reload --port 8001
```

Interactive API docs at http://localhost:8001/docs.

The RAG index is **not** committed. Retrieval returns nothing until you build it:

```bash
make ingest      # cd services/chatbot && uv run python ingest_data.py
```

> 🚧 **Needs filling in** — ingestion reads from `services/chatbot/data/raw`, which is
> git-ignored (see `data/SOURCES.md`). You need the knowledge corpus to build an index.
> Ask a maintainer. The service starts without it; answers just won't be grounded.
>
> First run also downloads the `BAAI/bge-m3` embedding model — roughly **2.3 GB**.

### Mobile — Metro on 8081

```bash
pnpm --filter @vivamama/mobile start          # Metro bundler
pnpm --filter @vivamama/mobile android        # build & install on Android
pnpm --filter @vivamama/mobile ios            # macOS only
```

> ⚠️ **Known issue** — `apps/mobile` has **no `dev` script**, so the root `pnpm dev`
> (which runs `turbo run dev`) silently skips the mobile app. Use `start` as above.

## Running several at once

```bash
pnpm dev      # turbo run dev, across every workspace that defines a dev script
```

Today that means **backend and admin** — contracts has no `dev` task and mobile has no
`dev` script.

## Check

With the stack up:

```bash
curl -s http://localhost:4000/health && curl -s http://localhost:8001/docs -o /dev/null -w '%{http_code}\n'
```

Next: [Building & testing →](/build-test)
