# Rate limit strategy for k6 vs `POST /v1/chat`

The API applies **slowapi** `@limiter.limit("60/minute")` per client IP ([app/api/main.py](../../app/api/main.py)).

## Strategy A (default for scripts in this folder)

- **Goal:** Measure latency and reliability **under** the production-like throttle.
- **k6 setup:** Use **`constant-arrival-rate`** capped at **55 iterations/minute** from a single runner IP (headroom under 60/min).
- **Interpretation:** Results reflect LLM/RAG/Redis behavior **without** artificial 429 floods from the app rate limiter.

## Strategy B (raw capacity / stress)

- **Goal:** Measure maximum throughput beyond 60 RPM/IP.
- **Requires one of:** temporarily raise/remove the limit in a **non-production** environment, use **multiple egress IPs** (k6 distributed / multiple machines), or run k6 from several IPs in parallel.
- **Report must state** explicitly that Strategy B was used and how the limit was bypassed.

Do not present RPS from Strategy B as “production capacity” unless limits match production.
