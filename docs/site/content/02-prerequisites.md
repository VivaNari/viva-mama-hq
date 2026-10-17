---
title: Prerequisites
section: Getting started
description: The tools you need installed, and the exact versions this repo expects.
---

Not every tool is needed for every task. The **Required for** column tells you what you can
skip.

| Tool | Version | Required for |
| --- | --- | --- |
| **Node.js** | `>=20` | Everything JS/TS |
| **pnpm** | `8.9.0` (pinned) | Everything JS/TS |
| **Git** | any recent | Everything |
| **Python** | `>=3.10, <3.13` | `services/chatbot` only |
| **uv** | any recent | `services/chatbot` only |
| **Docker** + Compose | any recent | The one-command stack (optional) |
| **JDK** | 17 | Android builds only |
| **Android SDK** | — | Android builds only |
| **Xcode** + CocoaPods | — | iOS builds only (macOS) |

Versions come from `package.json` (`engines`, `packageManager`) and
`services/chatbot/pyproject.toml` (`requires-python`).

## Node.js

The repo requires **Node 20 or newer**. Check:

```bash
node --version   # must print v20.x or higher
```

If you need to manage multiple versions, [`nvm`](https://github.com/nvm-sh/nvm) or
[`fnm`](https://github.com/Schniz/fnm) both work:

```bash
nvm install 20 && nvm use 20
```

> 🚧 **Needs filling in** — there is no `.nvmrc` or `.node-version` file in the repo, so
> version managers won't switch automatically. Adding one pinned to Node 20 would remove a
> whole class of "works on my machine" bugs.

## pnpm

The package manager is **pinned to pnpm 8.9.0** via the `packageManager` field. Don't
install it globally with npm — use Corepack, which reads that pin and installs the exact
version:

```bash
corepack enable
corepack prepare pnpm@8.9.0 --activate
pnpm --version   # 8.9.0
```

Using a different major version of pnpm can produce a lockfile diff that fails CI, because
CI installs with `--frozen-lockfile`.

## Python and uv

Only needed if you're working on the RAG chatbot.

The constraint is `>=3.10,<3.13` — note the **upper bound**. Python 3.13 will fail to
resolve dependencies.

```bash
python3 --version        # 3.10, 3.11 or 3.12
pip install uv
uv --version
```

`uv` handles the virtualenv and the lockfile (`services/chatbot/uv.lock`); you don't need
to create a venv by hand.

## Docker

Optional but the fastest path to a working stack — it brings up MongoDB, Redis, the
backend, the chatbot and the OTel collector in one command.

```bash
docker --version
docker compose version
```

## Mobile toolchain

Only needed to build the React Native app onto a device or simulator. You can run the
Metro bundler without it.

- **Android** — JDK 17 and the Android SDK. The repo's Gradle config expects a hoisted
  `node_modules` (see [Install dependencies](/install)).
- **iOS** — Xcode and CocoaPods, macOS only.

Follow the [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment)
for your platform, then come back here.

## Check

```bash
node --version && pnpm --version && git --version
```

All three should print without error. Next: [Clone the repository →](/clone)
