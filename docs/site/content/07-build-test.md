---
title: Building & testing
section: Getting started
description: The quality gates CI runs, and how to run them locally first.
---

All four gates run from the repo root and fan out through Turbo, which only rebuilds
what changed.

```bash
pnpm lint          # ESLint across TS workspaces
pnpm typecheck     # tsc --noEmit
pnpm test          # unit tests
pnpm build         # compile every buildable package
pnpm format        # Prettier, writes in place
pnpm format:check  # Prettier, read-only — this is what CI runs
```

Run these before pushing. CI runs the same set, and a PR cannot merge until they pass.

## The Turbo task graph

`turbo.json` declares `build`, `typecheck`, `lint`, `test` and `dev`. Every one except
`dev` and `clean` declares `dependsOn: ["^build"]` — dependencies build first. In
practice: touching `packages/contracts` rebuilds it before the backend type-checks
against it.

Caching is on for everything except `dev` and `clean`, so a second run with no changes is
close to instant. Cached outputs are `dist/`, `build/`, `lib/` and `coverage/`.

To bypass the cache:

```bash
pnpm build -- --force
```

## Python

The Python service sits outside Turbo's graph and has its own root-level scripts:

```bash
pnpm py:lint      # ruff check
pnpm py:format    # ruff format
pnpm py:test      # pytest
```

Or directly:

```bash
cd services/chatbot
uv run pytest -q
uv run ruff check .
```

## Scoping to one package

```bash
pnpm --filter @vivamama/backend test
pnpm --filter @vivamama/admin build
pnpm --filter @vivamama/contracts typecheck
```

`--filter` accepts the package name from its `package.json`, not the directory path.

## Build outputs

| Package | Output |
| --- | --- |
| `@vivamama/contracts` | `packages/contracts/dist` |
| `@vivamama/admin` | `apps/admin/dist` |
| `@vivamama/backend` | `services/backend/build` |

> ⚠️ **Known issue** — the backend compiles to `build/` (`tsconfig.json` `outDir`, and
> `start` runs `node build/index.js`), but its `clean` script is `rimraf dist`. So
> `pnpm clean` never removes the backend's actual output. Remove `services/backend/build`
> by hand, or fix the script to match.

## Mobile release build

```bash
pnpm --filter @vivamama/mobile assemble-release
```

Runs `./gradlew assembleRelease`. Only release builds compile with Hermes — which is why
a wrong `hermesCommand` path in `android/app/build.gradle` fails here and nowhere else.

## Check

```bash
pnpm typecheck && pnpm test
```

Both green means your environment matches CI. Next: [Monorepo structure →](/structure)
