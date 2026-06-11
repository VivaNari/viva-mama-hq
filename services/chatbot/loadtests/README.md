# Load tests (k6) — `POST /v1/chat`

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed (`k6 version`).
- API running and reachable from the k6 runner.
- Pass `API_KEY` (and other vars) **on the command line** when you run k6 (see below); do not commit secrets.

## Rate limit (important)

The route is limited to **60 requests/minute per IP** (`slowapi`). Scripts default to **Strategy A** (stay under the cap). See [k6/RATE_LIMIT_STRATEGY.md](k6/RATE_LIMIT_STRATEGY.md).

## Scenarios (`SCENARIO`)

| Value   | Purpose |
|---------|---------|
| `quick` | 3 requests, 1 VU — fast validation that the script and env work. |
| `smoke` | ~30 requests/min for 1 minute — under rate limit. |
| `load`  | ~55 requests/min for 5 minutes — under rate limit, longer soak. |

## Commands

From the repository root (variables only on the command line):

```bash
BASE_URL=http://localhost:8000 API_KEY=your-api-key SCENARIO=smoke k6 run loadtests/k6/chat.js
```

Export JSON for dashboards or archiving:

```bash
BASE_URL=http://localhost:8000 API_KEY=your-api-key SCENARIO=smoke k6 run --out json=loadtests/reports/k6_$(date +%Y%m%d_%H%M%S).json loadtests/k6/chat.js
```

Custom message:

```bash
BASE_URL=http://localhost:8000 API_KEY=your-api-key SCENARIO=smoke QUERY="What are tips for postpartum hydration?" k6 run loadtests/k6/chat.js
```

## Interpreting results

- **status_429** custom metric: application rate limiting (per IP).
- **http_req_failed**: transport/TLS/DNS failures.
- **Checks** (`status is 200`, `has session_id`, `has answer`): functional success for a healthy chat response.

## Reports

See [reports/LOAD_TEST_REPORT.md](reports/LOAD_TEST_REPORT.md) for the report template and sample quick run notes.
