# Contributing to VivaMama

Thanks for helping improve VivaMama! This guide covers local setup, our branching
and commit conventions, and what we expect in a pull request.

By participating you agree to our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Prerequisites

- **Node.js ≥ 20** + **pnpm** (`corepack enable`)
- **Python ≥ 3.10** + **uv** (`pip install uv`) — for `services/chatbot`
- **Docker** (optional) for running the full stack

## Local setup

```bash
git clone https://github.com/NexaNeura/vivamama.git
cd vivamama
pnpm install                       # all JS/TS workspaces
cd services/chatbot && uv sync && cd -   # Python service (optional)
```

Copy the per-package env templates and fill them in (never commit real secrets):

```bash
cp services/backend/.env.example services/backend/.env
cp services/chatbot/.env.example services/chatbot/.env
cp apps/mobile/.env.example      apps/mobile/.env
```

Run the stack: `docker compose up --build` (backend + chatbot + Mongo + Redis), or a
single package via `pnpm --filter <name> dev`. See each package's README.

## Project structure

| Path | Package | Stack |
| --- | --- | --- |
| `apps/mobile` | `@vivamama/mobile` | React Native + TS |
| `services/backend` | `@vivamama/backend` | Node + TS (Express) |
| `services/chatbot` | `@vivamama/chatbot` | Python (FastAPI) |
| `packages/contracts` | `@vivamama/contracts` | Shared TS library |

## Branching strategy

We use **trunk-based development**:

- `main` is always releasable and protected (PR + green CI required).
- Branch off `main` with a short-lived, descriptive branch:
  - `feat/<short-description>` · `fix/<short-description>` · `chore/…` · `docs/…`
- Rebase on `main` and open a PR early. Keep PRs small and focused.

## Commits — Conventional Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(optional scope): <summary>

feat(backend): add weekly check-in v1 validation
fix(mobile): prevent duplicate chat messages on reconnect
docs(contracts): document the endpoint registry
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`, `revert`. Use a package scope (`backend`, `mobile`, `chatbot`, `contracts`)
where it helps.

## Changesets (versioning)

If your change affects the behaviour of a **published** package
(`backend`, `chatbot`, `contracts`), add a changeset:

```bash
pnpm changeset
```

Pick the package(s) and bump type (semver) and write a short, user-facing note.
Commit the generated file in `.changeset/`. The mobile app is versioned through its
app-store process and is excluded.

## Before you push — quality gates

Run the same checks CI runs, scoped to what you changed:

```bash
pnpm lint            # ESLint (JS/TS) + Ruff (Python)
pnpm typecheck       # tsc --noEmit across TS packages
pnpm test            # unit tests
pnpm format          # Prettier (JS/TS/JSON/MD) — Ruff formats Python
```

Turbo only runs work for affected packages, so this is fast.

### Linting & formatting conventions

The repo ships a shared baseline (root `eslint.config.mjs`, `.prettierrc.json`,
`ruff.toml`). Two **intentional per-package overrides** exist, to avoid reformatting
~800 inherited files and to respect framework norms:

- `apps/mobile` keeps the React Native ESLint preset (`@react-native/eslint-config`).
- `services/backend` keeps its own ESLint flat config and a 4-space Prettier profile.

New code and the shared packages follow the root config. Don't reformat unrelated
files in a feature PR.

## Pull requests

A good PR:

1. Targets `main`, is rebased, and has a clear title (Conventional Commit style).
2. Fills out the PR template — what changed, why, how to test, screenshots for UI.
3. Is **green in CI** (lint, typecheck, tests for affected packages; secret scan).
4. Includes a changeset when it changes a published package's behaviour.
5. Updates docs/READMEs and `.env.example` when config or behaviour changes.
6. Contains **no secrets** — use `.env`/`.env.example`. CI runs gitleaks on every PR.

Maintainers squash-merge; keep the PR description accurate as it becomes the
changelog context.

## Reporting bugs / requesting features

Use the [issue templates](./.github/ISSUE_TEMPLATE). For security issues, **do not**
open a public issue — follow [`SECURITY.md`](./SECURITY.md).
