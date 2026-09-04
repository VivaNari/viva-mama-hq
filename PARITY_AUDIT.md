# Parity audit — individual repos vs `vivamama_hq`

Generated 2026-09-03. Compares every tracked file in each source repo (at its
current feature-branch head) against the corresponding directory in this
monorepo's working tree.

**Question this answers:** does the monorepo contain what the individual repos
contain, given that the individual repos run correctly today?

**Short answer:** the *application code* is at parity. The *deployment
automation* is not here at all, and one chatbot data file is missing that the
code loads at runtime.

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

### 1.1 All six CI/CD workflows are absent — **highest impact**

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

### `services/backend` — 13 files

| File | Why it differs |
| --- | --- |
| `src/config/firebase.ts` | **Security.** Uses Application Default Credentials instead of importing a committed key file. Must not be reverted. |
| `Dockerfile` | Root-context pnpm build so `@vivamama/contracts` resolves; bakes no key. |
| `package.json` | `@vivamama/backend`, Apache-2.0, `contracts` workspace dep, `typecheck` script, no `husky` prepare. |
| `src/utils/logger/transports/index.ts` | pino transport return-type fix so `tsc` passes. |
| 9 controllers / routes | Express 5 types `req.params` as `string \| string[]`; casts added so `tsc --noEmit` passes. Affects `admin`, `referral-admin`, `care-manager`, `chat-flow`, `consultation`, `expert`, `support`, `users`, `expert.route`. |

### `apps/mobile` — 5 files

| File | Why it differs |
| --- | --- |
| `src/constants/endpoints.ts` | **Security.** `BASE_API_URL` read from env; the source hard-codes the production Cloud Run URL. |
| `metro.config.js` | Monorepo-aware `watchFolders` + `nodeModulesPaths`. Required under pnpm. |
| `package.json` | `@vivamama/mobile`; flat-config-disabled lint script. |
| `.eslintrc.js` | Inherited-debt rules downgraded to warnings. |
| `README.md` | Monorepo paths and commands. |

`android/gradlew.bat` initially appeared to differ — it is byte-identical. The
source repo's `.gitattributes` normalises CRLF on store, so the blob hashes
differ while the files do not.

### `apps/admin` — 6 files

| File | Why it differs |
| --- | --- |
| `src/api/admin.ts` | Imports paths from `@vivamama/contracts` instead of hard-coding four API routes. |
| `vite.config.ts` | Aliases `@vivamama/contracts` to its TypeScript source — the package compiles to CommonJS for the Node services, which Rollup cannot statically read. |
| `package.json` | `@vivamama/admin`, Apache-2.0 (the `licence` key was misspelled), `typecheck` script, contracts dep, yarn-specific scripts removed. |
| `chart.tsx`, `label/styles.tsx`, `theme/core/components.tsx` | `Number(theme.shape.borderRadius)` — MUI 7.3 widened the type to `number \| string`. The source pins 7.0.1 via npm/yarn locks, which pnpm cannot consume in a workspace. |

### `services/chatbot` — 3 files (after identical Ruff normalisation)

| File | Why it differs |
| --- | --- |
| `app/chains/chat_pipeline_mcp.py` | Removed a duplicate `from app.llm.groq_client import get_llm` that shadowed the Vertex factory and would have made `LLM_PROVIDER` a no-op. Plus removal of dead `rag_query` / `all_matches` stores that fail this repo's `ruff check`. |
| `app/mcp/context_server.py` | Import written multi-line vs single-line. Cosmetic. |
| `app/rag/loaders.py` | A dead `last_exception` store, removed by June's Ruff pass. |

The other 34 changed Python files are **formatting only** — identical once the
source is run through this repo's `ruff check --fix` + `ruff format`.

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
2. **Port the six workflows**, rewritten for the workspace: path-filtered
   per-service deploys, root build context for the backend image, and secrets
   re-pointed. Plan alongside `vivamama-devops`.
3. ~~**Backend `.env.example`**~~ — ✅ created; the documented Firebase setup
   path now works.
4. **Rotate the GCP service-account key.** It is baked into published images
   from the source repo (§1.3), so it is exposed regardless of this repo.
5. **Restore `copilot-instructions.md`** if your team uses it.
6. **Decide on the 14 pre-existing mobile test failures.** They fail identically
   in the source repo, but this repo's CI actually runs them, so they will fail
   the pipeline here.
7. **Run a real Android build.** Never validated under `node-linker=hoisted`,
   and the resync adds three native modules.
8. **Clean the 70 tracked `.pyc` files** the root `.gitignore` already excludes.
