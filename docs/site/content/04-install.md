---
title: Install dependencies
section: Getting started
description: Installing the JS/TS workspaces and, optionally, the Python service.
---

## JavaScript and TypeScript

One command from the repo root installs **all four** JS/TS workspaces — mobile, admin,
backend and contracts — from a single lockfile:

```bash
pnpm install
```

This takes a few minutes on a cold cache. React Native's dependency graph is large.

### Why `node-linker=hoisted`

The repo's `.npmrc` sets:

```ini
node-linker=hoisted
strict-peer-dependencies=false
auto-install-peers=true
prefer-frozen-lockfile=true
```

That first line matters more than it looks. pnpm's default layout is a symlinked store,
and **React Native's Metro bundler and native autolinking both break on it** — Gradle and
CocoaPods can't follow the symlinks. Hoisting produces a flat `node_modules` like npm's.

The practical consequence: **dependencies land in the workspace-root `node_modules`, not
in each package's own.** Several build files account for this explicitly — for example
`apps/mobile/android/app/build.gradle` points `reactNativeDir` up four levels to the root.
If you see a path in a config file reaching further up than seems necessary, this is why.

`strict-peer-dependencies=false` is there because RN's peer graph routinely conflicts;
installs warn rather than fail.

## Python (chatbot only)

Skip this unless you're working on `services/chatbot`.

```bash
cd services/chatbot
uv sync
cd -
```

`uv sync` creates the virtualenv and installs from `uv.lock`. It does not need an
activated venv — prefix commands with `uv run` instead:

```bash
cd services/chatbot
uv run python --version
```

## Both at once

The Makefile wraps both steps:

```bash
make setup     # pnpm install + uv sync
```

Run `make help` to list every target.

## Check

```bash
pnpm --filter @vivamama/contracts build
```

The shared contracts package is the fastest thing to build and has no external
dependencies, so it's a good signal that the workspace wiring is correct. It should
finish in a few seconds and produce `packages/contracts/dist`.

Next: [Environment & config →](/environment)
