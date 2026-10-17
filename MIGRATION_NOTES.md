# Migration Notes — consolidating VivaMama into an open-source monorepo

This document summarizes how three private repositories were merged into this
public monorepo, the decisions made, **what must be reviewed/rotated before going
public**, and the known gaps.

## Source repositories

| Original repo (GitHub `NexaNeura/…`) | Now at | Commits preserved |
| --- | --- | --- |
| `app_customer_viva_nari` | `apps/mobile` (`@vivamama/mobile`) | 97 (main) |
| `backend_core_vivanari` | `services/backend` (`@vivamama/backend`) | 182 (main) |
| `rag_chatbot` | `services/chatbot` (`@vivamama/chatbot`) | 15 (main) |

Merged history: **298 commits** (97 + 182 + 15 + 1 root + 3 merge commits).

## Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Monorepo manager (JS/TS) | **pnpm workspaces + Turborepo** | One lockfile; Turbo task graph + caching + `--affected` CI filtering. `node-linker=hoisted` keeps React Native working. |
| Python tooling | **uv** + **Ruff** | Fast, lockfile-based deps; Ruff does lint **and** (Black-compatible) formatting. Wired into Turbo via a thin `package.json`. |
| Versioning | **Changesets** | Per-package semver + changelogs for published workspaces. |
| Layout | `apps/` · `services/` · `packages/` | Conventional polyglot monorepo separation (client / deployable services / shared libs). |
| Shared code | `@vivamama/contracts` | Canonical API endpoint registry + domain types; starter extraction consumed by the backend. |
| License | **Apache-2.0** *(provisional — see below)* | Patent grant + NOTICE; strong for institutional review. |
| Git history | **Preserved, scrubbed** | `git filter-repo` per repo to purge secrets/large/copyright blobs and re-root paths, then merged with `--allow-unrelated-histories`. |
| Chatbot corpus | **Excluded + documented** | 651 MB of third-party copyrighted PDFs cannot be redistributed publicly. |

### ⚠️ License is provisional

Apache-2.0 was applied as the working default because the choice was left **TBD**.
It is trivial to switch to MIT before first publish. **Please confirm** the license;
update `LICENSE`, `NOTICE`, the `license` field in each `package.json`/`pyproject.toml`,
and the README badge if you change it.

No copyleft (GPL/AGPL) dependency was observed, so Apache-2.0 does not conflict with
the dependency tree. CI runs a license report (`license-checker`) to catch
regressions. **The one real conflict is the chatbot knowledge corpus** — those PDFs
are third-party copyrighted works and are *not* covered by our license; they were
removed and documented in [`services/chatbot/data/SOURCES.md`](./services/chatbot/data/SOURCES.md).

## How the history was rewritten

1. Each repo was cloned (`--no-checkout`) into a scratch area.
2. `git filter-repo --invert-paths` purged sensitive/large/junk paths (see below),
   then `--to-subdirectory-filter` re-rooted everything under its monorepo prefix.
3. A fresh repo was initialized; the three rewritten histories were merged with
   `git merge --allow-unrelated-histories`.
4. A final `git filter-repo` pass over the merged repo **redacted** hard-coded
   secret values that lived inside otherwise-kept files (a historical Dockerfile)
   and removed a committed build artifact.
5. **Gate:** `gitleaks` was run over the full history and the working tree — both
   report **no leaks**. CI re-runs gitleaks on every push/PR.

The `.git` directory shrank from ~305 MB (across the three repos) to ~17 MB.

---

## 🔐 Security audit

### A. Removed from git history (purged)

| Item | Why |
| --- | --- |
| `VivaMamaServiceAccountKey.json` | **Live GCP/Firebase service-account private key** (project `viva-mama`). |
| `services/chatbot/.env` **and** `.env.example` | Contained a **real Groq API key** (`gsk_XrXx…`), an internal `API_KEY`, and Mongo URIs. |
| `services/backend/.env` and `src/.env` | Mongo URI, Twilio SID/token, `JWT_SECRET`, `CRYPTO_PASSWORD`, Razorpay key+secret, LLM key. |
| Hard-coded `ENV` secrets in `services/backend/Dockerfile` (2 historical commits) | **Redacted** in history: `MONGO_URI`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `JWT_SECRET`, `CRYPTO_PASSWORD`, `RAZORPAY_API_KEY`, `RAZORPAY_SECRET_KEY`. |
| `apps/mobile/android/app/google-services.json` (+ `src/…`) | Firebase Android config (API keys / project metadata). |
| `apps/mobile/.../index.android.bundle` (2.87 MB) | Committed Metro **build artifact** with baked-in `@env` values. |
| `be.zip`, `Archive.zip` | Code archives that may embed secrets (see "needs review"). |
| `services/chatbot/data/**` (~651 MB) | Third-party **copyrighted** research PDFs / journal zips. |
| `'./logs',/app.log`, `error.log` (backend) | **Committed application logs** in a malformed directory — may contain request PII/PHI. |
| `apppp.txt`, assorted `.DS_Store` | Developer scratch / OS cruft. |

### B. ⚠️ Needs YOUR action before publishing

1. **Rotate every exposed credential — they are still in the ORIGINAL private repos'
   history.** Scrubbing this new repo does **not** un-leak anything already pushed to
   `github.com/NexaNeura/*`. Rotate at the provider:
   - GCP/Firebase service-account key for project `viva-mama` (disable the leaked key).
   - Groq API key (`gsk_XrXx…`).
   - MongoDB credentials, `JWT_SECRET`, `CRYPTO_PASSWORD`.
   - Twilio Account SID + Auth Token.
   - Razorpay key + secret (incl. the `rzp_test_…` test keys found in the Dockerfile).
   - The backend↔chatbot `LLM_API_KEY` / chatbot `API_KEY`.
2. **Lock down or purge the three original private repos** (or rewrite their history
   too) so the secrets aren't recoverable from them.
3. **Review `be.zip` / `Archive.zip`** — they were removed without a full content
   audit. Backed up locally (see below) if you want to inspect for PHI/user data
   before deciding they're safe to have ever existed.
4. **Internal references still in source/docs** — decide whether to keep them public:
   - `PROJECT_OVERVIEW.md` (backend & mobile) reference the Cloud Run URL
     `https://nodejs-api-…run.app` and `asia-south1`. (The mobile **app code** no
     longer hard-codes it — it now reads `BASE_API_URL` from env.)
   - `GOOGLE_CLIENT_ID` and a Twilio sender number appeared in the historical
     Dockerfile; the OAuth client ID is public by nature, the phone number is
     low-sensitivity, but review if you'd rather scrub them.
5. **Confirm the license** (Apache-2.0 vs MIT) — see above.
6. **`android/app/debug.keystore` was kept** — it's the standard, non-sensitive
   Android **debug** signing key (cannot sign Play Store releases). Confirm you're
   comfortable shipping it (common for RN repos). No **release/upload** keystore was
   present in history (good).

### C. On-disk only — never tracked (so not in history)

`backend/.env`, `mobile/.env`, `chatbot/.env`, and `VivaMamaServiceAccountKey.json`
existed only on the working disk. Each package now has a placeholder `.env.example`.

### D. Local backup (contains secrets — do not publish)

A pre-migration backup was written to (outside this repo):

```
../_vivamama_premigration_backup_20260611/
  ├─ app_customer_viva_nari.git.tar.gz   # original history
  ├─ backend_core_vivanari.git.tar.gz
  ├─ rag_chatbot.git.tar.gz
  ├─ backend.env / mobile.env / chatbot.env
  └─ VivaMamaServiceAccountKey.json
```

Keep it private; delete it once you've rotated everything and confirmed the
migration.

---

## Known gaps / follow-ups

These were intentionally **not** done in this pass and are safe follow-ups:

- **Docker images were not built in this environment** (no Docker daemon available).
  The backend image builds from the **repo-root context** with pnpm so the
  `@vivamama/contracts` workspace dependency resolves; the chatbot image is
  self-contained. Both are constructed per standard recipes and are exercised by CI
  / `docker compose up` — validate there.
- **Chatbot heavy deps** (PyTorch, FAISS) were not installed here; Python **lint**
  was verified with `uvx ruff`. Run `uv sync` + `pytest` in CI / locally.
- **Mobile native build** (Android/iOS) was not run (needs the platform toolchains).
  A monorepo-aware `metro.config.js` was added; verify an on-device build.
- **`@vivamama/contracts` is a starter extraction.** Inline types still live in
  `services/backend/src/types` and `apps/mobile/src/constants/endpoints.ts`;
  de-duplicating them onto the shared package is a follow-up.
- **Python dependency manifests are dual**: `pyproject.toml` + `uv.lock` (canonical)
  and `requirements.txt` (for the Docker image's CPU-only PyTorch wheels). Keep in
  sync via `uv export`.
- **Lint passes on a pragmatic baseline.** To avoid rewriting ~800 inherited
  files, real problems are errors but inherited-debt rules are **warnings**
  (`backend` 0 errors / 38 warnings, `mobile` 0 errors / 50 warnings). The backend
  uses the root ESLint config; the RN app keeps its framework preset (those rules
  downgraded) plus the RN ESLint plugins it needs under pnpm; Ruff is scoped to
  pyflakes + import order (`F`, `I`) and the chatbot was auto-fixed clean.
  Tightening to full strictness/formatting is a tracked follow-up.
- **Mobile `tsc` is not gated yet** — the RN app has ~20 pre-existing type errors
  (mock data, type-def typos, legacy `Services copy.tsx` / `ChatWithVivaAIOld.tsx`).
  It builds via Metro/Babel (no type-check); re-enabling strict `tsc` is a follow-up.
- **Backend type fixes applied.** Minimal, runtime-preserving fixes were needed for
  the backend to compile cleanly under `tsc` (Express 5 `req.params`/`req.query`
  string casts in 5 controllers; a pino transport return type). Their original CI
  ran tests but never `tsc`, so these errors pre-dated the migration.
- **Inherited tech debt** otherwise left as-is: removed accidental backend deps
  (`npm`, `i`, `http`); dual implementations remain (`weekly-checkin` v0/v1,
  `ChatWithVivaAIOld`, `Services copy.tsx`).
- **Verified locally:** `pnpm install`, `turbo build` + `typecheck` (contracts +
  backend), `turbo lint` (all 4), `ruff check` (chatbot), and `gitleaks` (history +
  tree, 0 leaks). **Not run here:** Docker image builds (no daemon) and the test
  suites (need service containers / a Groq key) — both are wired into CI.
- **The chatbot answers from the LLM's own knowledge until a corpus is ingested**
  (see `data/SOURCES.md`).

---

# Second consolidation — September 2026

The June migration was a snapshot. By September the three source repos had moved
~130 commits ahead of it, and a fourth repo — the admin console — had never been
imported at all. This pass brings all four current.

## What changed

| Component | Source branch | Graft commit | Commits replayed |
| --- | --- | --- | --- |
| `services/backend` | `feature/first-pilot-changes-play-billing` | `4be0b5c` | 50 |
| `apps/admin` *(new)* | `feature/admin-panel` | — full history | 58 |
| `services/chatbot` | `feature/chatbot-optimization` | `04dd43f` | 18 |
| `apps/mobile` | `fix/first-pilot-changes-v2` | `1559b50` | 38 |

Imports came from the current **feature-branch heads**, not `main` — that is where
the work actually lives, and the admin console is non-functional without the
backend's `/api/v1/admin/*` routes, which exist only on that branch.

## Why a rebase, not a merge

The monorepo was already published, with open Dependabot branches on `main`, so
rewriting or force-pushing history was not an option. A plain merge was not an
option either: June rewrote every source SHA with `git filter-repo`, so re-merging
the sources would have replayed all 294 already-imported commits under fresh SHAs.

Instead each source was re-scrubbed and re-rooted with the same `filter-repo`
recipe, and only the post-graft commits were replayed with
`git rebase --onto`. The rewrite proved deterministic: re-deriving the mobile
graft produced `82b16d6`, byte-identical to the SHA June's migration produced, and
`git merge-base --is-ancestor` confirms it sits on `main`.

## Purged again

The same classes of thing June removed had reaccumulated in the source repos:

| Item | Where |
| --- | --- |
| `VivaMamaServiceAccountKey.json` — **live GCP key, tracked at HEAD** | backend |
| `.env`, `src/.env` | backend |
| `.env` — **tracked at HEAD** (Mongo URI, API key, Vertex project) | chatbot |
| `data/**`, `lactmed.json`, `lactmed_data/` — ~260 MB third-party PDFs | chatbot |
| `android/app/google-services.json` (+ `src/`) | mobile |
| `index.android.bundle` — committed Metro artifact | mobile |
| `yarn.lock` + `package-lock.json` — repo carried both; monorepo is pnpm-only | admin |
| `.firebase/hosting.*.cache` — deploy artifact | admin |
| `be.zip`, `apppp.txt`, `scratch.ts`, `'./logs',/*`, `.DS_Store` | backend |

Pack sizes after: chatbot **261.80 MiB → 264.30 KiB**, admin 17.1 → 14.6 MB.

**These credentials are still live in the source repos' history — rotate them at
the provider.** Scrubbing this repo does not un-leak them.

## Adaptations preserved through the replay

Deliberate June decisions that replayed commits would otherwise have reverted:

- `services/backend/src/config/firebase.ts` — Application Default Credentials, not
  a committed key file. **Security-critical**; no replayed commit touches it.
- `services/backend/Dockerfile` — root-context pnpm build, bakes no key.
- `apps/mobile/metro.config.js` — monorepo-aware `watchFolders` / `nodeModulesPaths`.
- `apps/mobile/src/constants/endpoints.ts` — `BASE_API_URL` from env. Replayed
  commits repeatedly reintroduced the literal Cloud Run URL; each was rejected.
- `@vivamama/*` package names, Apache-2.0 license fields, ESLint severity baselines.

## Bugs found and fixed during the merge

- **A duplicate `get_llm` import** (`services/chatbot/app/chains/`). Merging import
  blocks left both `from app.llm.factory import get_llm` and
  `from app.llm.groq_client import get_llm`; the second wins in Python, which would
  have silently routed every call to Groq and made `LLM_PROVIDER` a no-op. Caught by
  Ruff's `F811`, not by review.
- **Seven Express 5 type errors** in the incoming admin/referral/consultation
  handlers — `req.params` is `string | string[]`. These predate the monorepo: the
  source repo's CI runs tests but never `tsc`.
- **A gitleaks false positive**: `scripts/diagnose-play-api.ts` documents what each
  Play Developer API status code means, and its plain-English description of a 401
  reads to the `generic-api-key` heuristic as a high-entropy value following a
  `key ...:` label. The script holds no credential — it loads the service-account
  JSON from the environment and never prints it. Added `.gitleaks.toml` (the repo's
  first) with an allowlist scoped to that single path and phrase, so it cannot mask
  a real leak elsewhere.

## Follow-ups still open

- **`apps/mobile` has not been built.** Three new native modules
  (`react-native-iap`, `react-native-nitro-modules`, `react-native-webview`) land on
  a `node-linker=hoisted` layout that June never validated with a device build.
  Static checks pass; that proves nothing about autolinking. **Run a real Android
  build before trusting this.**
- **Two admin screens still read fixtures** — `apps/admin/src/pages/content.tsx` and
  `src/sections/mothers/view/mothers-view.tsx` import from `src/_mock`.
  Consultations, moderation and auth are wired to the API.
- **The monorepo tracks 70 `.pyc` files** under `services/chatbot` that the root
  `.gitignore` already excludes — missed in June, untouched here.
- **`ruff.toml` targets `py310`** while the chatbot Dockerfile now builds on 3.12.
  Harmless (`pyproject` allows `>=3.10,<3.13`) but inconsistent.
- **The chatbot image now bakes a ~2.3 GB embedding model.** Good for cold starts,
  but it changes `docker compose up` and CI build times materially.
- **`vivamama-devops` is still a separate repo** — 144 commits of Terraform/Ansible,
  and the natural next member of this monorepo. Excluded here because its GCP
  project configuration was not audited.
