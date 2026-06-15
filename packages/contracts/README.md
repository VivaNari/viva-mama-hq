# @vivamama/contracts

Shared **API contract** for the VivaMama platform: the canonical endpoint
registry and core domain types used by every service so the backend, mobile app,
and chatbot stay in lock-step.

## What's inside

| Module | Exports |
| --- | --- |
| `endpoints` | `API_VERSION`, `apiVersionPath()`, `apiRoutes` (typed registry of every REST/SSE path) |
| `domain` | `ScoreCategory`, `ScoreZone`, `VivaRecoveryScore`, `Recommendation`, `ApiResponse<T>` … |

Paths are **relative** (no host). Each consumer supplies its own base URL from
configuration — never hard-code environment URLs.

## Usage

```ts
import { apiRoutes, type VivaRecoveryScore } from '@vivamama/contracts';

const url = `${process.env.BASE_API_URL}${apiRoutes.dashboard.vivaScore}`;
```

In any workspace package, depend on it with the workspace protocol:

```jsonc
// package.json
"dependencies": { "@vivamama/contracts": "workspace:*" }
```

## Scripts

```bash
pnpm --filter @vivamama/contracts build      # tsc -> dist/ (CJS + .d.ts)
pnpm --filter @vivamama/contracts typecheck
pnpm --filter @vivamama/contracts lint
```

## Adoption status

This is a **starter extraction**. The backend depends on it today; full
de-duplication of the inline types still living in `services/backend/src/types`
and `apps/mobile/src/constants/endpoints.ts` is tracked as a follow-up in
[`MIGRATION_NOTES.md`](../../MIGRATION_NOTES.md). Add to it whenever you find a
type or path that more than one service needs.
