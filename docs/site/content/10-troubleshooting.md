---
title: Troubleshooting
section: Help
description: Failure modes specific to this repo's setup, and what actually fixes them.
---

## `cp: services/backend/.env.example: No such file or directory`

**Expected.** That template is not in the repository — `services/backend/.gitignore`
ignores `.env.*` with no `!.env.example` negation, so it was never committed, even though
`README.md` and `CONTRIBUTING.md` both tell you to copy it.

Build the file from the reference in [Environment & config](/environment), or ask a
maintainer for a copy.

## Metro can't resolve modules / Gradle can't find React Native

Almost always a `node_modules` layout problem. This repo **requires** a flat, hoisted
layout — `.npmrc` sets `node-linker=hoisted` because Metro and native autolinking both
break on pnpm's default symlinked store.

If you installed with npm, yarn, or a pnpm that ignored the `.npmrc`:

```bash
rm -rf node_modules apps/*/node_modules services/*/node_modules packages/*/node_modules
corepack prepare pnpm@8.9.0 --activate
pnpm install
```

Related: several build files point further up the tree than looks right — for example
`apps/mobile/android/app/build.gradle` sets `reactNativeDir` four levels up. That's
correct, because hoisting puts dependencies at the workspace root.

## Lockfile / frozen-lockfile failures in CI

`.npmrc` sets `prefer-frozen-lockfile=true` and CI installs with `--frozen-lockfile`. A
lockfile produced by a different pnpm major version will fail there even though it worked
locally. Match the pin:

```bash
corepack prepare pnpm@8.9.0 --activate
pnpm install
git diff pnpm-lock.yaml     # should be empty, or an intentional dependency change
```

## `uv sync` fails to resolve

Check your Python version. The constraint is `>=3.10,<3.13` — the **upper** bound catches
people out, because 3.13 is current on many systems.

```bash
python3 --version
uv python install 3.12     # uv can fetch a compatible interpreter for you
```

## Chatbot starts but every answer is ungrounded

The FAISS index isn't built. It's generated, not committed:

```bash
make ingest
```

This needs the knowledge corpus in `services/chatbot/data/raw`, which is git-ignored — ask
a maintainer. First run also downloads the `BAAI/bge-m3` embedding model, about **2.3 GB**.

If you change `EMBEDDINGS_MODEL`, you **must** re-run ingestion: vector dimensions differ
between models, and `load_index()` refuses a mismatched index.

## Port already in use

Every port is overridable from the root `.env`:

```bash
BACKEND_PORT=4001
CHATBOT_PORT=8002
MONGO_PORT=27018
REDIS_PORT=6380
OTEL_COLLECTOR_PORT=4319
```

The admin port is not a compose variable — it's set in `apps/admin/vite.config.ts`.

## `pnpm dev` doesn't start the mobile app

Correct, and not a bug you can fix by retrying: `apps/mobile` has no `dev` script, so
`turbo run dev` skips it. Use:

```bash
pnpm --filter @vivamama/mobile start
```

## `pnpm clean` leaves the backend build behind

The backend's `clean` is `rimraf dist`, but it compiles to `build/`. Remove it manually:

```bash
rm -rf services/backend/build
```

## Docker stack came up but the database is empty

`make down` and `pnpm stack:down` both pass `-v`, which deletes the named volumes
(`mongo_data`, `redis_data`). To stop without losing data:

```bash
docker compose stop      # instead of `down -v`
```

## Push rejected: "Changes must be made through a pull request"

`main` is protected by a repository ruleset — PR required, one approving review, three
passing checks, linear history, no force pushes. Admins are not exempt; the bypass list is
empty.

```bash
git switch -c fix/your-change
git push -u origin fix/your-change
```

Then open a PR.

## Turbo returns a stale result

Turbo caches aggressively. Force a rebuild:

```bash
pnpm build -- --force
pnpm clean          # or drop the cache entirely
```

## Still stuck?

Open a [discussion or issue](https://github.com/VivaNari/viva-mama-hq/issues) using the
templates in `.github/ISSUE_TEMPLATE`. For anything security-related, **do not open a
public issue** — follow
[`SECURITY.md`](https://github.com/VivaNari/viva-mama-hq/blob/main/SECURITY.md).

Next: [How to contribute →](/contributing)
