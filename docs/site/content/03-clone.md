---
title: Clone the repository
section: Getting started
description: Getting the code, and a stale URL to watch out for.
---

## The correct remote

```bash
git clone https://github.com/VivaNari/viva-mama-hq.git
cd viva-mama-hq
```

Or over SSH, if you have a key on your GitHub account:

```bash
git clone git@github.com:VivaNari/viva-mama-hq.git
cd viva-mama-hq
```

> ⚠️ **Known issue** — `README.md`, `CONTRIBUTING.md` and the `repository.url` field in
> the root `package.json` all still point at `https://github.com/NexaNeura/vivamama.git`,
> which is not this repository. Use the URL above. Those three references should be
> updated.

## If you're contributing

You won't have write access, so fork first, then clone your fork and add the original as
an upstream remote:

```bash
# after clicking "Fork" on GitHub
git clone git@github.com:<your-username>/viva-mama-hq.git
cd viva-mama-hq
git remote add upstream git@github.com:VivaNari/viva-mama-hq.git
git remote -v
```

Keeping `upstream` lets you rebase onto the latest `main` before opening a PR:

```bash
git fetch upstream
git rebase upstream/main
```

## Branching

`main` is protected — it requires a pull request, one approving review, and three passing
status checks. You cannot push to it directly. Branch first:

```bash
git switch -c feat/short-description
```

Prefixes in use: `feat/`, `fix/`, `chore/`, `docs/`. See [How to contribute](/contributing)
for the full convention.

## Check

```bash
git remote -v && git branch --show-current
```

Next: [Install dependencies →](/install)
