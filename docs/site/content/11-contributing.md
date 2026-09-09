---
title: How to contribute
section: Help
description: Branching, commits, changesets, and what a PR needs to pass.
---

Full policy lives in
[`CONTRIBUTING.md`](https://github.com/VivaNari/viva-mama-hq/blob/main/CONTRIBUTING.md).
This is the working summary.

## Branching

Trunk-based. `main` is always releasable and protected. Branch off it with a short-lived,
descriptive branch:

```text
feat/<short-description>
fix/<short-description>
chore/<short-description>
docs/<short-description>
```

Rebase on `main` and open the PR early.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(backend): add weekly check-in v1 validation
fix(mobile): prevent duplicate chat messages on reconnect
docs(contracts): document the endpoint registry
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
`revert`. Scopes: `backend`, `mobile`, `admin`, `chatbot`, `contracts`.

## Changesets

If your change affects the behaviour of a **published** package — `backend`, `chatbot` or
`contracts` — record it:

```bash
pnpm changeset
```

Pick the packages and bump type, write a short user-facing note, and commit the generated
file in `.changeset/`. The mobile app is excluded; it versions through the app store.

## Before you push

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm format:check
```

Turbo scopes to affected packages, so this is faster than it looks. Python changes also
need `pnpm py:lint` and `pnpm py:test`.

## What a PR must clear

`main` requires a pull request, **one approving review**, and **three passing checks**:

| Check | Source |
| --- | --- |
| `ci-ok` | aggregate gate over lint / typecheck / test |
| `gitleaks` | secret scan over full history |
| `dependency-review` | flags vulnerable new dependencies |

Also enforced: linear history, resolved conversations, branches up to date, no force
pushes, no deletions. Admins are **not** exempt — the bypass list is empty.

`ci-ok` exists because the `js` and `chatbot` jobs are path-filtered: a docs-only PR skips
them, and a required check that never reports would block the merge forever. `ci-ok`
passes when its dependencies succeed *or* are skipped.

## Code owners

Security-sensitive paths require review from a code owner — CI/CD workflows, lockfiles,
Dockerfiles, auth and payment code, `.env.example` templates, Firebase config, and the
shared contracts. See `.github/CODEOWNERS`.

If you're touching one of these, expect a review request to appear automatically.

## Secrets

Never commit one. The repo defends this in three layers:

1. `.gitignore` blocks `.env`, keys, certificates and service-account JSON
2. **push protection** rejects a detected secret at `git push`
3. `gitleaks` scans full history on every PR

If a secret does land, treat it as **compromised even after removal**. Rotate it at the
provider first, then purge it from history, then notify the maintainers. `SECURITY.md`
has the procedure.

## Editing these docs

Every page here is a Markdown file in `docs/site/content/`. Adding one:

1. Create `NN-slug.md` — the number sets sidebar order
2. Add frontmatter:

```markdown
---
title: Your page title
section: Getting started
description: One-line summary shown under the heading.
---
```

3. Write Markdown. GFM tables, fenced code blocks and syntax highlighting all work.

No code change and no route registration — the site picks the file up automatically. Each
page has an **Edit this page on GitHub** link at the bottom.

## Reporting

Bugs and features: the [issue templates](https://github.com/VivaNari/viva-mama-hq/issues/new/choose).
Security: **never** a public issue — follow
[`SECURITY.md`](https://github.com/VivaNari/viva-mama-hq/blob/main/SECURITY.md), or use
GitHub's private vulnerability reporting.
