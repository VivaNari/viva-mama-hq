# Parity audit — individual repos vs `vivamama_hq`

Generated 2026-09-03. Compares every tracked file in each source repo (at its
current feature-branch head) against the corresponding directory in this
monorepo's working tree.

**Question this answers:** does the monorepo contain what the individual repos
contain, given that the individual repos run correctly today?

**Short answer, re-checked 2026-09-05:** the *application code* is at parity,
and — after two passes that specifically hunted for gitignored-but-essential
files (§1.5, §1.6) — so is everything the running app actually reads from disk.
A fresh hash-by-hash re-comparison on 2026-09-05 (workflows and `.md` files
excluded, per standing instruction that those are non-functional) found only
14 backend / 3 chatbot / 6 admin / 7 mobile files differing, all listed in §3
with a reason — everything else (over 1,250 files) is byte-identical to source.
The one remaining gap is the *deployment automation*: no CI/CD workflow from any
source repo exists here (§1.1).

## Method

- Source side: `git ls-tree -r --name-only <branch>` at each repo's head.
- Monorepo side: files that exist on disk and are not git-ignored.
- Content compared by hash. For the chatbot, the source was put through the
  same `ruff check --fix` + `ruff format` this repo applies, so formatting is
  not counted as a difference.

| Component | Source branch | Files (src) | Files (hq) | Missing | Extra | Differ |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `services/backend` | `feature/first-pilot-changes-play-billing` | 525 | 515 | 12 | 2 | 13 |
| `services/chatbot` | `feature/chatbot-optimization` | 144 | 134 | 16 | 6 | 4 |
| `apps/mobile` | `fix/first-pilot-changes-v2` | 389 | 389 | 1 | 1 | 5 |
| `apps/admin` | `feature/admin-panel` | 221 | 217 | 4 | 0 | 6 |

---

## 1. Gaps that need action

### 1.1 All six CI/CD workflows are absent — ✅ PORTED 2026-09-06

Not one deployment workflow from any source repo exists here. The June migration
consolidated CI at the repo root and dropped the per-service `.github/`
directories; the September resync did not restore them.

| Source repo | Workflow | What it does |
| --- | --- | --- |
| backend | `.github/workflows/deploy.yaml` | Deploy to Cloud Run (UAT) |
| backend | `.github/workflows/build-docker-image.yaml` | Build + push the API image |
| backend | `.github/workflows/ci.yaml` | Install, tests & audit |
| chatbot | `.github/workflows/deploy-cloud-run.yaml` | Deploy to UAT Cloud Run |
| chatbot | `.github/workflows/build-docker-image.yaml` | Build image on a `[self-hosted, rag-builder]` runner |
| mobile | `.github/workflows/android-release.yml` | Android release build |

What this repo has instead — three workflows written during the June migration,
covering different ground entirely:

- `ci.yml` — lint / typecheck / build / test via Turbo, with path filters
- `release.yml` — Changesets version PR
- `security.yml` — gitleaks, CodeQL, dependency review

**Nothing here builds an image, pushes to Artifact Registry, or deploys.**

They also cannot be copied across unchanged. They assume the repository root
*is* the service root, whereas here:

- the backend image builds from the **repo root** context so the
  `@vivamama/contracts` workspace dependency resolves;
- every path, trigger and `working-directory` needs a `services/…` prefix;
- deploys should be filtered by which service actually changed, or every push
  redeploys everything.

Related: `vivamama-devops` (Terraform/Ansible for prod and UAT) is still a
separate repo. These workflows are the other half of that same deployment story,
so the two are best planned together.

**Resolution (2026-09-06).** All six were ported, rewritten for the workspace,
plus one net-new workflow for admin (which never had CI of its own):

| New file | Ported from | Key adaptation |
| --- | --- | --- |
| `.github/actions/gcp-auth/action.yml` | — (new) | Composite action replacing the auth + setup-gcloud + configure-docker preamble repeated in all four GCP workflows |
| `.github/workflows/backend-build.yml` | backend `build-docker-image.yaml` | `docker build -f services/backend/Dockerfile .` from the **repo root** so `@vivamama/contracts` resolves; dropped `--build-arg NODE_ENV=production` (this Dockerfile declares no such ARG — it was a silent no-op) |
| `.github/workflows/backend-deploy.yml` | backend `deploy.yaml` | Adds `--set-secrets=FIREBASE_SA_KEY_JSON=…` on every deploy, so the §1.3b credential cannot be lost when the service is recreated |
| `.github/workflows/chatbot-build.yml` | chatbot `build-docker-image.yaml` | `defaults.run.working-directory: services/chatbot` so every ported step body resolves unchanged; added `paths:` filter so non-chatbot pushes cannot trigger a multi-hour embedding run |
| `.github/workflows/chatbot-deploy.yml` | chatbot `deploy-cloud-run.yaml` | Structural port; only the secret rename below |
| `.github/workflows/mobile-release.yml` | mobile `android-release.yml` | `pnpm install --frozen-lockfile` at the repo root instead of `npm ci`; every `android/…` path prefixed `apps/mobile/android/…`; added `paths:` filter and a fail-fast test step |
| `.github/workflows/admin-deploy.yml` | — (new) | Firebase Hosting deploy + per-PR preview channels |

Also folded the backend `ci.yaml`'s audit/license steps into `security.yml` as a
non-blocking `dependency-audit` job (its test step was already covered by
`ci.yml`'s Turbo run). `better-npm-audit` was swapped for native `pnpm audit`,
since the former parses `npm audit --json` against a `package-lock.json` this
repo does not have.

Two secret names differed between the backend and chatbot repos for the same
value and are now canonical: `SHARED_ARTIFACT_REGISTRY_PROJECT_ID` →
`SHARED_ARTIFACT_PROJECT_ID`, and `UAT_PROJECT_ID` → `UAT_GCP_PROJECT_ID`. The
non-secret constants `GCP_REGION` (`asia-south1`) and `GAR_REPO`
(`vivamama-repo`) read from repo Variables with the literal as fallback, so they
work with no setup and can still be overridden centrally.

⚠️ Two things must happen before these can actually run:

1. **Create the secrets** (nothing exists in this repo yet): `UAT_GCP_SA_KEY`,
   `SHARED_BUILD_SA_KEY`, `SHARED_ARTIFACT_PROJECT_ID`, `UAT_GCP_PROJECT_ID`,
   `BACKEND_DATABASE_VM_IP`, `KEYSTORE_BASE64`, `GOOGLE_SERVICES_JSON`,
   `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`, `SLACK_WEBHOOK_URL`, and
   the new `FIREBASE_SERVICE_ACCOUNT_ADMIN`. The Cloud Run runtime secrets
   (`FIREBASE_SA_KEY_JSON`, `MONGODB_PASSWORD`, `REDIS_PASSWORD`,
   `GROQ_API_KEY`, `RAG_API_KEY`) stay in **GCP Secret Manager**, not GitHub.
2. **Re-register the self-hosted runner.** `vivamama-devops`'
   `deploy-runner.yaml` / `destroy-runner.yaml` still default `github_repo` to
   `rag_chatbot`. Until that points at this monorepo, `chatbot-build.yml` will
   queue forever with no matching `[self-hosted, rag-builder]` runner. That repo
   was deliberately left untouched in this pass.

### 1.2 `services/chatbot/lactmed.json` — ✅ RESOLVED 2026-09-03

9.6 MB curated NCBI/NIH LactMed dataset, loaded at runtime by
`app/lactmed/lookup.py` (`parents[2] / "lactmed.json"`). It had been purged as
bulk data alongside the research-PDF corpus, but unlike the corpus it is read by
the code. Failure was silent — `_get_data()` logs the error and returns empty
dicts, so every lactation drug-safety query quietly returned nothing.

**Fixed:** the file was restored from the source repo (byte-identical: 1,940
drugs, 38,859 aliases) and verified by exercising the real module —
`"can I take paracetamol when nursing my baby?"` correctly resolves through the
alias table to Acetaminophen.

**Second bug found while fixing it, also fixed here.** Neither this repo's
Dockerfile *nor the source repo's* copied `lactmed.json` into the image. The
runtime stage copied only `app/`, `ingest_data.py` and `.local_vector_store`, so
the loader's `/app/lactmed.json` never existed. The feature therefore worked on
developer machines and silently did nothing in every deployed container.

Added to `services/chatbot/Dockerfile`:

```dockerfile
COPY lactmed.json ./lactmed.json
```

Verified with a real `docker build` against this context: the file lands at
`/app/lactmed.json` (9,985,753 bytes), and `docker build --check` reports no
warnings.

> **This bug is still live in `NexaNeura/rag_chatbot`.** The same one-line fix
> should be applied there, or its deployed containers will keep returning
> nothing for lactation queries.

### 1.3 `VivaMamaServiceAccountKey.json` — correctly absent, but the documented
### replacement was broken — ✅ FIXED 2026-09-03

The key is **deliberately** not here and must stay that way: it is a live
GCP/Firebase private key for project `viva-mama`. It is purged from history (0
occurrences), blocked by `.gitignore` (`**/*ServiceAccountKey*.json`), and no
code references it.

The monorepo replaces it with Application Default Credentials
(`src/config/firebase.ts` → `admin.credential.applicationDefault()`):

- **Cloud Run / GCP** — the attached runtime service account is used
  automatically. No key, no env var.
- **Local / Docker** — set `GOOGLE_APPLICATION_CREDENTIALS` to a key file you
  mount at runtime. The root `docker-compose.yml` has a commented volume mount.

**The gap:** `firebase.ts`, `README.md` and the root `.env.example` all told you
to look in `services/backend/.env.example` — and that file had **never existed**
in this repo (it was not on `main`, and was never added). So
`cp services/backend/.env.example services/backend/.env` failed, and the
documented way to configure Firebase locally led nowhere.

**Fixed:** created `services/backend/.env.example` covering all 52 environment
variables the backend reads, with `GOOGLE_APPLICATION_CREDENTIALS` documented
against both the local and Cloud Run paths. Verified: every `process.env.*` the
code reads is now documented, and gitleaks reports no leaks in the file.

> ### ⚠️ Security note about the source repo
>
> `NexaNeura/backend_core_vivanari`'s Dockerfile bakes the live key into the
> image, in **both** stages:
>
> ```dockerfile
> COPY VivaMamaServiceAccountKey.json ./            # builder
> COPY --chown=nodejs:nodejs VivaMamaServiceAccountKey.json ./   # runtime
> ```
>
> Anyone who can pull that image can extract the private key. The monorepo's ADC
> approach removes this, but **the exposure is live in the source repo and in
> every image already published from it.** Rotating the key (already on the June
> action list) is what actually closes it.

### 1.3b Firebase credentials via Secret Manager — ✅ IMPLEMENTED 2026-09-03

ADC alone was not viable here. `admin.credential.applicationDefault()`
authenticates as whatever identity the runtime carries, and on Cloud Run that is
`cloud-run-app-sa`, whose complete role set across the devops repo is:

```
roles/aiplatform.user          roles/run.admin
roles/iam.serviceAccountUser   roles/run.invoker
roles/secretmanager.secretAccessor
```

No FCM role. A grep of the whole devops repo for `firebase|fcm|cloudmessaging`
returns nothing. The backend calls `admin.messaging().send()` in four places, so
on ADC alone every push notification would fail *at send time* — long after boot
looked healthy.

**Implemented** the same pattern the codebase already uses for
`GOOGLE_MEET_SA_KEY_JSON` and `PLAY_DEVELOPER_SA_KEY_JSON`: the key JSON lives in
Secret Manager and is injected as an env var.

`services/backend/src/config/firebase.ts` now resolves credentials in order:

1. `FIREBASE_SA_KEY_JSON` — full key JSON from Secret Manager. Authenticates as
   the Firebase account regardless of the runtime identity.
2. Application Default Credentials — used when that is empty.

Which path was taken is **logged at startup**, because the failure mode is
otherwise invisible until the first notification silently fails. A malformed
secret logs loudly and degrades to ADC rather than taking the API down.

Verified by exercising all three paths against the real key: valid JSON logs
`firebase-adminsdk-fbsvc@viva-mama.iam.gserviceaccount.com`, malformed JSON logs
the error and falls back, unset uses ADC. Backend suite: **643/643 pass**.

**devops changes (uncommitted, in `vivamama-devops`):** `prod/terraform/main.tf`
and `uat/terraform/main.tf` each gain a `secretmanager.secretAccessor` grant for
`FIREBASE_SA_KEY_JSON`, the container `env` block that injects it, and the
matching `depends_on` entry. `terraform fmt -check` passes on both.

**Still to do by hand** — the secret itself is created out-of-band in this setup
(Terraform only grants access), so for each project:

```bash
gcloud secrets create FIREBASE_SA_KEY_JSON --replication-policy=automatic
gcloud secrets versions add FIREBASE_SA_KEY_JSON --data-file=serviceAccountKey.json
```

Use a **freshly rotated** key — the existing one is compromised (see §1.3).

The cleaner long-term end state is still to grant
`roles/firebasemessaging.admin` to `cloud-run-app-sa` and drop the key entirely;
the code already supports that by leaving `FIREBASE_SA_KEY_JSON` unset.

### 1.4 `services/backend/.github/copilot-instructions.md` — minor

Editor guidance for contributors, dropped with the rest of `.github/`. Restore
it if your team uses it.

---

## 1.5 Gitignored-but-essential files — ✅ RESTORED 2026-09-03

**This category was missed by the first version of this audit, and the miss was
structural.** Sections 1-4 compare *tracked* files. These files are **gitignored
in the source repos**, so they are tracked nowhere, and a tracked-file comparison
can never see them — yet the app does not build without them.

An earlier check for "untracked files in the source repos" reported *clean*,
which was misleading: it looked for untracked-and-**not**-ignored files. The
important ones are untracked **and** ignored.

| File | Why it matters |
| --- | --- |
| `apps/mobile/android/app/google-services.json` | `android/app/build.gradle` applies `com.google.gms.google-services`. That plugin **fails the build** when the file is absent — the Android app cannot compile at all. |
| `apps/mobile/android/app/viva_nari.keystore` | The **release signing key**. `signingConfigs.release` does `storeFile file('viva_nari.keystore')`. Without it no Play Store build can be signed. |
| `apps/mobile/.env` | `@env` values baked in at build time (BASE_API_URL, GOOGLE_CLIENT_ID, RAZORPAY_API_KEY). |
| `services/backend/.env` | Mongo, JWT, Twilio, Razorpay, Play, GetGabs, Meet. |
| `services/chatbot/.env` | Mongo URI, internal API key, Vertex project. |
| `apps/admin/.env` | `VITE_SERVER_URL`. |

All six were copied from the source working folders, byte-identical, and verified
to be **gitignored in the monorepo** — so they cannot be committed. `git status`
does not list them; `gitleaks --no-git` reports 13 findings, all inside these six
ignored files and none in anything committable.

> Note on the earlier claim that "no release/upload keystore was present"
> (§ June notes). That was true of the *git history*. The keystore exists on disk
> and is required for release builds. History and working tree are different
> questions, and only the first had been checked.

**Deliberately NOT copied**, though also gitignored-and-present in the source:

- `services/backend/exports/user_data_export*.{csv,json}` (~400 KB) — exported
  **user data**. Should not be propagated; delete from the source too.
- `apps/mobile/.claude/settings.local.json` — per-developer editor state.
- `.husky/_/*` — regenerated by `husky install`; the monorepo does not use husky.
- The chatbot corpus under `data/` — see §2.

**Ongoing risk:** because these files are gitignored everywhere, nothing in CI or
git will ever tell you they are missing. Anyone cloning the monorepo fresh gets a
mobile app that will not build. This belongs in the setup documentation, and is
the strongest argument for finishing the `.env.example` files and writing a
short "first clone" checklist.

### 1.6 `services/chatbot/.local_vector_store/` — ✅ RESOLVED 2026-09-04

The prebuilt FAISS index (91 MB: `faiss_index/index.faiss`, `faiss_index/index.pkl`,
`metadata.json`). Gitignored in both the source repo and here
(`services/chatbot/.gitignore:2` and root `.gitignore:55`), so — like §1.5 — it
was invisible to a tracked-file comparison and was missing from the monorepo
working tree. The user found it manually while working in the folder and copied
it across before this was re-audited; **verified byte-identical to the source
repo by MD5** (`index.faiss`, `index.pkl`, `metadata.json` all match).

**This one is more severe than the others in §1.5**, which degrade silently.
Without it, the chatbot does not silently serve without-RAG answers — it fails
to start. `get_shared_retriever()` (`app/rag/retriever.py:930-939`) calls
`load_index()` during app warmup and **raises `RuntimeError`** if it returns
false, specifically so "startup warmup and `/readyz` surface the failure instead
of silently serving no-RAG." A container without this directory would fail its
readiness probe and never take traffic.

Not to be confused with `data/` (4.8 MB, source PDFs/markdown) or `lactmed_data/`
(236 MB, raw NCBI crawl) — both also gitignored-and-present in the source repo,
both re-confirmed absent here, and both correctly absent: neither is read by
anything under `app/` at runtime. `data/` is read only by `ingest_data.py`
(`DATA_DIR = os.environ.get("INGEST_DATA_DIR", "data")`, the offline script that
*produces* `.local_vector_store`); `lactmed_data/` is the raw crawl that
produced `lactmed.json` (§1.2) and isn't referenced anywhere in the app code.
These are safe to leave out, and re-generating `.local_vector_store` from
scratch means running `python ingest_data.py` against `data/` — worth knowing if
this copy is ever lost.

**A second, exhaustive sweep for this same blind-spot class was run against all
four components on 2026-09-04** (`git ls-files --others --ignored
--exclude-standard` in each source repo, filtered to drop build tool caches —
`node_modules`, `.gradle`, `.cxx`, `app_venv`, `__pycache__`, etc.). Besides
`.local_vector_store`, it turned up nothing not already covered in §1.5 or §2:
backend and admin have only their already-documented `.env` / `.husky/_/*` /
`user_data_export*`; mobile's 1,652 gitignored files under `android/app/` are
all `android/app/.cxx` (native-build intermediates, regenerated by Gradle) aside
from the already-restored `google-services.json` and `viva_nari.keystore`. No
source repo has advanced past its 2026-09-03 head, so the tracked-file
comparisons in §3/§4 are still current as of this pass.

## 2. Deliberately absent — no action needed

| File | Component | Why |
| --- | --- | --- |
| `VivaMamaServiceAccountKey.json` | backend | **Live GCP private key.** Must never be committed. Supplied at runtime via ADC — see §1.3. |
| `.env` | chatbot | **Live secrets** (Mongo URI, API key, Vertex project). |
| `'./logs',/app.log`, `error.log` | backend | Committed application logs; may contain request PII/PHI. |
| `Archive.zip` | chatbot | Unaudited code archive. |
| `scratch.ts`, `.DS_Store` | backend | Developer scratch / OS cruft. |
| `docker-compose.yml` / `.yaml` | backend, chatbot | Superseded by the root `docker-compose.yml`, which runs the whole stack. |
| `eslint.config.cjs`, `.eslintignore` | backend | Superseded by the root `eslint.config.mjs`. |
| `yarn.lock`, `package-lock.json` | admin | This is a pnpm workspace with one lockfile. The repo carried both. |
| `vercel.json` | admin | One deploy target chosen (Firebase Hosting). |
| `.firebase/hosting.*.cache` | admin | Deploy artifact. |
| 9 × `__pycache__/*.pyc` | chatbot | Build artifacts. (Note: 70 older `.pyc` files *are* still tracked here from June — a pre-existing inconsistency worth cleaning.) |

---

## 3. Files that differ — all deliberate monorepo adaptations

Every content difference below is an intentional change, not drift.

### `services/backend` — 14 files

| File | Why it differs |
| --- | --- |
| `src/config/firebase.ts` | **Security.** Resolves credentials via `FIREBASE_SA_KEY_JSON` (Secret Manager) or ADC, instead of importing a committed key file. Must not be reverted — see §1.3b. |
| `src/config/env.ts` | Purely additive: one new line reading `FIREBASE_SA_KEY_JSON` (added 2026-09-03 alongside firebase.ts, undocumented here until 2026-09-05). Nothing else in the file changed. |
| `Dockerfile` | Root-context pnpm build so `@vivamama/contracts` resolves; bakes no key. |
| `package.json` | `@vivamama/backend`, Apache-2.0, `contracts` workspace dep, `typecheck` script, no `husky` prepare. |
| `src/utils/logger/transports/index.ts` | pino transport return-type fix so `tsc` passes. |
| 9 controllers / routes | Express 5 types `req.params` as `string \| string[]`; casts added so `tsc --noEmit` passes. Affects `admin`, `referral-admin`, `care-manager`, `chat-flow`, `consultation`, `expert`, `support`, `users`, `expert.route`. |

### `apps/mobile` — 7 files

| File | Why it differs |
| --- | --- |
| `src/constants/endpoints.ts` | **Security.** `BASE_API_URL` read from env; the source hard-codes the production Cloud Run URL. |
| `metro.config.js` | Monorepo-aware `watchFolders` + `nodeModulesPaths`. Required under pnpm. |
| `package.json` | `@vivamama/mobile`; flat-config-disabled lint script; `react-native-reanimated` pinned to exact `4.2.1` (2026-09-05 — see below). |
| `.eslintrc.js` | Inherited-debt rules downgraded to warnings. |
| `README.md` | Monorepo paths and commands. |
| `android/settings.gradle`, `android/app/build.gradle` | **Fixed 2026-09-05.** Both hard-coded `@react-native/gradle-plugin` and `react-native` at a path only correct for a standalone repo (`apps/mobile/node_modules/...`); under pnpm's `node-linker=hoisted` those packages live at the workspace root instead. Repointed to the correct relative depth (3-4 `../` more than the original). Verified with a real `./gradlew :app:assembleDebug` that got past both the plugin-resolution and `reactNativeDir` failure points. |

**Also found and fixed 2026-09-05, not a path issue:** `package.json`'s `"react-native-reanimated": "^4.2.1"` was resolving to `4.4.1` here — newer than what the source repo's `package-lock.json` actually pins (`4.2.1`) — because no lockfile pin survived the migration to carry that resolution over. Reanimated's own `compatibility.json` restricts `4.4.x` to RN `0.83`–`0.86`; this app is on RN `0.81.1`, so the Gradle build failed a hard version-compatibility assertion (`assertMinimalReactNativeVersionTask`). Pinned to the exact `4.2.1` the source repo actually uses; confirmed compatible per Reanimated's own table (`4.2.x` supports `0.80`–`0.84`).

`android/gradlew.bat` initially appeared to differ — it is byte-identical. The
source repo's `.gitattributes` normalises CRLF on store, so the blob hashes
differ while the files do not.

### `apps/admin` — 6 files

| File | Why it differs |
| --- | --- |
| `src/api/admin.ts` | Imports paths from `@vivamama/contracts` instead of hard-coding four API routes. |
| `vite.config.ts` | Aliases `@vivamama/contracts` to its TypeScript source — the package compiles to CommonJS for the Node services, which Rollup cannot statically read. |
| `package.json` | `@vivamama/admin`, Apache-2.0 (the `licence` key was misspelled), `typecheck` script, contracts dep, yarn-specific scripts removed; `react`/`react-dom` pinned to exact `19.1.0` (2026-09-04 — fixed a hoisted-workspace version mismatch where `react-dom` alone floated to `19.2.8`). |
| `chart.tsx`, `label/styles.tsx`, `theme/core/components.tsx` | `Number(theme.shape.borderRadius)` — MUI 7.3 widened the type to `number \| string`. The source pins 7.0.1 via npm/yarn locks, which pnpm cannot consume in a workspace. |

### `services/chatbot` — 3 files (after identical Ruff normalisation)

| File | Why it differs |
| --- | --- |
| `app/chains/chat_pipeline_mcp.py` | Removed a duplicate `from app.llm.groq_client import get_llm` that shadowed the Vertex factory and would have made `LLM_PROVIDER` a no-op. Plus removal of dead `rag_query` / `all_matches` stores that fail this repo's `ruff check`. |
| `app/mcp/context_server.py` | Import written multi-line vs single-line. Cosmetic. |
| `app/rag/loaders.py` | A dead `last_exception` store, removed by June's Ruff pass. |

The other 34 changed Python files are **formatting only** — identical once the
source is run through this repo's `ruff check --fix` + `ruff format`. Re-verified
2026-09-05 with `ruff.toml` at the correct project root (my first attempt at
this re-check ran ruff one directory too deep, which changes its import-sort
first-party detection and produced 12 false positives — corrected before
reporting).

`.env.example` also differs, harmlessly: the monorepo's copy documents the
current Vertex-AI-default config; the source repo's own `.env.example` is
stale (still documents the old Groq-only setup) **and has a real-looking Groq
API key hardcoded in plaintext.** Not a monorepo issue, but worth rotating that
key and scrubbing the source repo's file independently of this migration.

---

## 4. Extra files in the monorepo — all intentional

`services/backend/README.md`, `services/backend/src/shared/contracts.ts`,
`services/chatbot/{package.json, pyproject.toml, uv.lock, README.md, data/.gitkeep, data/SOURCES.md}`,
`apps/mobile/.env.example`. These are monorepo scaffolding added in June:
Turbo task shims, canonical Python dependency manifests, and corpus
documentation.

---

## 5. Suggested order of work

1. ~~**Add `lactmed.json`**~~ — ✅ done, plus the Dockerfile `COPY` it always
   needed. Apply the same Dockerfile fix to the source repo.
2. ~~**Port the six workflows**~~ — ✅ done 2026-09-06 (§1.1), plus a net-new
   admin deploy. Still needs the repo secrets created and the self-hosted runner
   re-registered from `vivamama-devops`.
3. ~~**Backend `.env.example`**~~ — ✅ created; the documented Firebase setup
   path now works.
4. **Rotate the GCP service-account key.** It is baked into published images
   from the source repo (§1.3), so it is exposed regardless of this repo.
5. **Restore `copilot-instructions.md`** if your team uses it.
6. ~~**Decide on the 14 pre-existing mobile test failures.**~~ — ✅ fixed
   2026-09-06. All 9 suites / 45 tests now pass. Every fix was confined to test
   files, Jest config and one snapshot; no application source was touched. See
   §6.

   Note: a `typecheck` script still cannot be added to `apps/mobile`.
   `tsc --noEmit` reports ~40 pre-existing errors under `apps/mobile/src`
   (stale fixtures in `src/data`, `IContent` vs `IUserContent` drift, two
   missing type names in `vivaAi.types.ts`), so wiring one up would fail CI
   without changing app source.
7. **Run a real Android build.** Never validated under `node-linker=hoisted`,
   and the resync adds three native modules.
8. **Clean the 70 tracked `.pyc` files** the root `.gitignore` already excludes.

## 6. Mobile test suite — ✅ FIXED 2026-09-06

`apps/mobile` had 14 failing tests across 7 suites. They were **not** migration
damage: every one reproduced identically in the standalone `viva_nari_app`
source repo, whose Jest config and test files are byte-identical to this repo's.
They were pre-existing bugs that had simply never been fixed upstream, and they
mattered here only because this repo's CI actually runs the suite.

All 9 suites / 45 tests now pass. **No application source changed** — every fix
is in a test file, Jest config/setup, or a snapshot (`git diff --stat` over
`apps/mobile/src` is empty).

| File changed | Cause | Fix |
| --- | --- | --- |
| `jest.setup.js` | Neither setup file ever initialised i18next, so `useTranslation()` echoed raw keys and no copy assertion could match | Import `./src/i18n` (module-scope `init()`) |
| `jest.setup.beforeEnv.js` | `react-native-iap` pulls in `react-native-nitro-modules`, which needs a native TurboModule binding Jest has not got | Mock the 8 named exports `playBilling.ts` actually uses |
| `__tests__/onboardingFlowConfig.test.ts` | Expected `chat.completeMessageOnboarding`, a key that exists nowhere | Expect `chat.onboardingComplete`, what `flowTypeResolver.ts` returns |
| `__tests__/Landing.login.test.tsx` | Expected `"Welcome, Mama"` (comma) and `/postpartum care/i`; the screen now gates both login paths behind a disclaimer modal, and Google behind two consent checkboxes | Corrected both literals to match `en.json`; tests now walk the disclaimer + consent flow |
| `__tests__/LoginwithPhone.test.tsx` | Rendered bare although the screen calls `useNavigation()`; Send OTP is disabled until two consent boxes are ticked; `verifyPhoneOTP` now takes a 4th `consents` argument | Wrap in `NavigationContainer`, tick both boxes, assert the 4-argument call |
| `__tests__/articlecard_onboarding_contexts.test.tsx` | `ArticleCard` reads `useSubscriptionContext()`; fixture still used the old `{id,title,content}` shape rather than `IUserContent` | Stub the context; fixture switched to `_id`/`featuredTitle`/`featuredImage`. Dropped the body-text assertion — the card renders the title only |
| `__tests__/Products.test.tsx` | Replaced the **whole** `@react-navigation/native` module with a `useNavigation`-only stub, so `bottom-tabs` (via `useScreenEdges`) got `undefined` for `createScreenFactory` and the suite could not even load; also missing Language and Subscription contexts | Spread `jest.requireActual` into the mock; stub both contexts |
| `__tests__/__snapshots__/more_component_snapshots_and_decode_extra.test.tsx.snap` | `GradientButtonWithSlightRadius` was refactored off `react-native-linear-gradient` after the snapshot was taken | Regenerated with `jest -u` |

The recurring theme is drift: the app grew consent gating, a paywall context and
a language context, and the tests were never updated to match. Each fix asserts
the component's *current* contract rather than working around it.
