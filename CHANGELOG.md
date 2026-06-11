# Changelog

All notable changes to the VivaMama monorepo are documented here.

Per-package changelogs are generated from [Changesets](https://github.com/changesets/changesets)
and live alongside each published package (e.g. `services/backend/CHANGELOG.md`).
This root file tracks repository-wide milestones. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Consolidated the three previously separate repositories
  (`app_customer_viva_nari`, `backend_core_vivanari`, `rag_chatbot`) into a single
  polyglot monorepo with **pnpm workspaces + Turborepo** (JS/TS) and **uv** (Python).
- `@vivamama/contracts` — a shared package with the canonical API endpoint registry
  and core domain types.
- Open-source hygiene: `README`, `LICENSE` (Apache-2.0), `NOTICE`, `CONTRIBUTING`,
  `CODE_OF_CONDUCT`, `SECURITY`, issue/PR templates, and CI with path filtering.
- Root `docker-compose.yml` to run the backend + chatbot + MongoDB + Redis with one
  command, plus a `Makefile` of helpers.
- Secret scanning (gitleaks) wired into CI and the migration.

### Changed

- Backend resolves Firebase credentials via **Application Default Credentials**
  instead of a committed service-account key.
- Mobile reads `BASE_API_URL` from the environment instead of a hard-coded URL.

### Security

- Scrubbed all secrets and a 651 MB third-party PDF corpus from the merged git
  history; rewrote the inherited histories with `git filter-repo`. See
  [`MIGRATION_NOTES.md`](./MIGRATION_NOTES.md) for the full audit and the
  credentials that must be rotated.

[Unreleased]: https://github.com/NexaNeura/vivamama/commits/main
