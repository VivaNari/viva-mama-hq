---
title: Monorepo structure
section: Reference
description: What lives where, and why the tooling is split the way it is.
---

## Layout

```text
viva-mama-hq/
├─ apps/
│  ├─ admin/              React + Vite console      (@vivamama/admin)
│  └─ mobile/             React Native app          (@vivamama/mobile)
├─ services/
│  ├─ backend/            Node/TS core API          (@vivamama/backend)
│  └─ chatbot/            Python RAG chatbot        (vivamama-chatbot)
├─ packages/
│  └─ contracts/          Shared API + domain types (@vivamama/contracts)
├─ docs/
│  ├─ architecture.md     System diagrams
│  └─ site/               This documentation site
├─ ops/                   OTel collector config
├─ .github/               Workflows, templates, CODEOWNERS
├─ docker-compose.yml     Full local stack
├─ turbo.json             Task pipeline
├─ pnpm-workspace.yaml    JS/TS workspace globs
└─ Makefile               Polyglot one-command helpers
```

> ⚠️ **Known issue** — the layout tree in the root `README.md` and the structure table in
> `CONTRIBUTING.md` both **omit `apps/admin`**, and `README.md` also omits `docs/site`.
> Both should be updated.

## Workspaces

`pnpm-workspace.yaml` globs `apps/*`, `services/*` and `packages/*`.

| Path | Package | Version | Builds to |
| --- | --- | --- | --- |
| `packages/contracts` | `@vivamama/contracts` | 0.1.0 | `dist/` |
| `services/backend` | `@vivamama/backend` | 1.0.0 | `build/` |
| `services/chatbot` | `vivamama-chatbot` | 0.1.0 | — (Python) |
| `apps/admin` | `@vivamama/admin` | 3.0.0 | `dist/` |
| `apps/mobile` | `@vivamama/mobile` | 1.0.0 | APK/IPA |

`docs/site` is deliberately **outside** the workspace globs. It's documentation, not a
shipped package — keeping it out means it never enters Turbo's graph, the release
pipeline, or changesets. It has its own `pnpm install`.

## Dependency direction

`packages/contracts` is the shared vocabulary. Backend, admin and mobile all depend on
it; it depends on none of them. A breaking change there fans out to all three clients at
once, which is why it has its own CODEOWNERS entry.

```text
contracts  ──►  backend
           ──►  admin
           ──►  mobile
```

## Why this tooling

**pnpm workspaces** — one lockfile for all JS/TS dependencies. `node-linker=hoisted` is
non-negotiable: React Native's Metro resolver and Gradle/CocoaPods autolinking both break
on pnpm's default symlinked store.

**Turborepo** — one task graph across the whole repo, with caching and `--affected`
filtering. The Python service participates through a thin `package.json` that shells out
to `uv`.

**Changesets** — versioning for the published packages (`backend`, `chatbot`,
`contracts`). The mobile app is versioned through its app-store process and is excluded.

## Per-package lint overrides

The repo ships a shared baseline — root `eslint.config.mjs`, `.prettierrc.json`,
`ruff.toml` — with **two intentional exceptions**, kept to avoid reformatting ~800
inherited files:

- `apps/mobile` keeps the React Native ESLint preset (`@react-native/eslint-config`).
- `services/backend` keeps its own flat config and a **4-space** Prettier profile.

New code follows the root config. Don't reformat unrelated files in a feature PR — it
buries the real diff.

## Deeper reading

- [`docs/architecture.md`](https://github.com/VivaNari/viva-mama-hq/blob/main/docs/architecture.md) — system diagrams
- `services/backend/PROJECT_OVERVIEW.md`
- `apps/mobile/PROJECT_OVERVIEW.md`
- `apps/admin/README.md` · `packages/contracts/README.md`

Next: [Scripts & commands →](/scripts)
