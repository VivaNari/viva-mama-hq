<!-- Thanks for contributing to VivaMama! Please fill this out. -->

## What & why

<!-- What does this PR change, and why? Link any related issue: "Closes #123". -->

## Affected packages

- [ ] `apps/mobile`
- [ ] `services/backend`
- [ ] `services/chatbot`
- [ ] `packages/contracts`
- [ ] tooling / CI / docs

## How to test

<!-- Steps for a reviewer to verify. Include screenshots/recordings for UI changes. -->

## Checklist

- [ ] Branch is rebased on `main`; title follows [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass for affected packages
- [ ] Added a **changeset** (`pnpm changeset`) if a published package's behaviour changed
- [ ] Updated docs / README / `.env.example` if config or behaviour changed
- [ ] **No secrets** committed (use `.env` / `.env.example`); CI secret scan passes
- [ ] No unrelated reformatting (respect per-package lint/format config)
