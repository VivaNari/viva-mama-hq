---
title: Scripts & commands
section: Reference
description: Root scripts, Makefile targets, and how to scope work to one package.
---

## Root scripts

| Command | What it does |
| --- | --- |
| `pnpm build` | `turbo run build` across every buildable package |
| `pnpm dev` | `turbo run dev` — backend + admin (see note below) |
| `pnpm lint` | `turbo run lint` |
| `pnpm typecheck` | `turbo run typecheck` |
| `pnpm test` | `turbo run test` |
| `pnpm clean` | `turbo run clean`, then clears `node_modules/.cache` and `.turbo` |
| `pnpm format` | Prettier, writes in place |
| `pnpm format:check` | Prettier, read-only — the CI variant |
| `pnpm py:lint` | `ruff check` on the chatbot |
| `pnpm py:format` | `ruff format` on the chatbot |
| `pnpm py:test` | `pytest` on the chatbot |
| `pnpm stack:up` | `docker compose up --build` |
| `pnpm stack:down` | `docker compose down -v` — **deletes volumes** |
| `pnpm changeset` | Record a version bump |
| `pnpm version-packages` | Apply pending changesets |

## Makefile

```bash
make help      # lists every target with its description
```

| Target | Equivalent |
| --- | --- |
| `make setup` | `pnpm install` + `uv sync` |
| `make install` | `pnpm install` |
| `make up` / `down` / `logs` | Docker stack lifecycle |
| `make dev` | `pnpm dev` |
| `make lint` / `typecheck` / `test` / `build` | the pnpm equivalents |
| `make format` | Prettier **and** `ruff format` |
| `make clean` | build outputs, plus Python caches and the local vector store |
| `make ingest` | build the chatbot's FAISS index |

`make format` and `make clean` do strictly more than their pnpm counterparts — they cover
the Python side too.

## Scoping with `--filter`

```bash
pnpm --filter @vivamama/backend  dev
pnpm --filter @vivamama/admin    build
pnpm --filter @vivamama/mobile   start
pnpm --filter @vivamama/contracts typecheck
```

Use the package **name**, not the directory.

## Backend operational scripts

`services/backend` carries ~35 additional scripts. They fall into three groups:

**Diagnostics** — safe to run, read-only:

```bash
pnpm --filter @vivamama/backend diagnose:otel
pnpm --filter @vivamama/backend diagnose:play-api
pnpm --filter @vivamama/backend diagnose:consultation-reminders
```

**Migrations** — `migrate:*`, one-off data transformations:

```bash
pnpm --filter @vivamama/backend migrate:user-role
pnpm --filter @vivamama/backend migrate:seed-subscription-plans
```

**Destructive** — require explicit confirmation via env vars:

```bash
pnpm --filter @vivamama/backend purge:user-data     # gated by PURGE_CONFIRM / PURGE_ALLOW_PROD
```

> ⚠️ These run against whatever `MONGO_URI` points at. Check your `.env` before running
> any `migrate:*` or `purge:*` script — there is no dry-run mode.

## Load tests

k6 must be installed separately.

```bash
pnpm --filter @vivamama/backend k6:login
pnpm --filter @vivamama/backend k6:products
```

Next: [Troubleshooting →](/troubleshooting)
