# Load test report — `POST /v1/chat`

## 1. Scope

| Field | Value |
|-------|--------|
| Endpoint | `POST /v1/chat` |
| API implementation | [app/api/main.py](../../app/api/main.py) |
| Rate limit | 60 requests/minute per IP (`@limiter.limit("60/minute")`) |
| k6 script | [loadtests/k6/chat.js](../k6/chat.js) |

## 2. Rate limit strategy

**Strategy A (default in k6 script):** measure behavior **under** the production-like cap (smoke ~30 RPM, load ~55 RPM from one IP).  
**Strategy B:** raw capacity beyond 60 RPM requires a test environment change (higher limit, multiple IPs, or distributed k6). Document explicitly if used.

See [../k6/RATE_LIMIT_STRATEGY.md](../k6/RATE_LIMIT_STRATEGY.md).

## 3. Test configuration

| Parameter | Smoke | Load | Quick (sanity) |
|-----------|-------|------|----------------|
| SCENARIO | `smoke` | `load` | `quick` |
| Arrival / iterations | 30/min × 1 min | 55/min × 5 min | 3 iterations, 1 VU |
| BASE_URL | (fill) | (fill) | (fill) |
| API_KEY | (redacted) | (redacted) | (redacted) |
| QUERY | default or custom | default or custom | default |

## 4. Environment (fill when running)

| Field | Value |
|-------|--------|
| Date / time (UTC) | |
| k6 version | `k6 version` output |
| App version / git commit | |
| Target region / host | |
| Rate limit adjusted for test? | Yes / No (if Yes, describe) |

## 5. Assumptions and limits

- Latency is dominated by **Groq/LLM** and optional **RAG/MCP/Redis/Mongo** dependencies.
- Single k6 runner = **single egress IP** unless using k6 Cloud / multiple agents.
- Groq quotas and cost apply; cap duration and arrival rate in staging.

## 6. Results (fill after run)

### 6.1 Summary (from k6 end-of-test output)

Paste the k6 summary block (or attach Grafana/k6 Cloud screenshot).

| Metric | Value |
|--------|--------|
| Total HTTP requests | |
| http_req_failed rate | |
| Checks success rate | |
| http_req_duration p(95) | |
| http_req_duration p(99) | |
| Custom: status 200 count | |
| Custom: status 429 count | |

### 6.2 HTTP status mix

| Code | Count | Notes |
|------|-------|--------|
| 200 | | |
| 401 | | Missing/invalid `X-API-Key` |
| 429 | | App rate limit (per IP) |
| 5xx | | Server/dependency errors |

### 6.3 Artifacts

| File | Description |
|------|-------------|
| `loadtests/reports/k6_*.json` | Raw k6 JSON output (`k6 run --out json=...`) |

## 7. Interpretation

- If **429** dominates: throughput is **limited by app rate limiting**, not necessarily by CPU/LLM. Do not report uncapped RPS as “server capacity” unless Strategy B was applied and documented.
- If **401** appears: verify `API_KEY` matches server configuration.
- If **high latency p95**: correlate with Groq latency, cold start, RAG index load, or DB timeouts.

## 8. Recommendations

- Staging: optionally raise chat route limit **only** for load tests, or use **multiple IPs**.
- Production reporting: always record Strategy A results alongside any Strategy B experiment.
- Monitor Groq usage and errors during sustained `load` runs.

---

## Appendix: Sample quick run (CI / script validation)

This sample used **Strategy A script** with `SCENARIO=quick` and a **closed port** to verify k6 wiring only (all requests failed at TCP layer — **not** representative of API performance).

| Field | Value |
|-------|--------|
| k6 version (runner) | k6 v1.6.1 (see `k6 version` on execution host) |
| Command | `SCENARIO=quick BASE_URL=http://127.0.0.1:9 API_KEY=test k6 run --out json=loadtests/reports/k6_quick_sample.json loadtests/k6/chat.js` |
| Outcome | 3 iterations, connection refused; `http_req_failed` 100% |

Artifact: [k6_quick_sample.json](k6_quick_sample.json) (large JSON; optional to commit — regenerate locally).

**Replace `BASE_URL` with your running API** and re-run `smoke` and `load` to produce a production-meaningful report.
