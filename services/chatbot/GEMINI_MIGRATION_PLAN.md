# Gemini model migration: 2.5 Flash → 3.5 Flash-Lite

Branch: `fix/chatbot-gemini-model` · Service: `services/chatbot` · Region: `asia-south1` only
Last updated: 2026-11-27

## Checklist

### Phase 0: Investigation (done)
- [x] Confirm the only India-served candidate: `gemini-3.5-flash-lite` (3.8 Flash is `global`-only)
- [x] Check whether `thinking_budget=0` reaches the model through LangChain (it does)
- [x] Measure 3.5 Flash-Lite latency vs 2.5 Flash, broken down by phase
- [x] Find the cause of the 3–20 s stalls (server-side queueing, not thinking)
- [x] Capture the response format difference (list of parts vs string)
- [x] Trace what today's code does with the new format (whole chatbot breaks)

### Step 1: Code fix (works on both models). Done, not committed
- [x] Add `response_text(msg) -> str` in `app/llm/response.py` (reads `.content`: str, or text parts joined; signatures/thinking dropped)
- [x] Use it at every reply-reading site (see [Affected code](#affected-code))
- [x] Replace `speech/transliterate.py` `_content_text` with the shared helper
- [x] Add per-role request deadlines in `_build_vertex` (see [Step 1 design](#step-1-design))
- [x] Shorten retry back-off from 4–10 s to 1 s
- [~] Stop retrying errors a retry can't fix: **dropped**, see [Step 1 design](#step-1-design)
- [x] Unit tests: `tests/test_llm_response.py` (13 tests; the 2 pipeline tests fail on the old code)
- [x] Full chatbot test suite passes: 250 passed (237 before + 13 new), no `.pyc` changes left
- [x] Smoke test both models through `get_llm()`: gate, translation, main answer, structured output, forced deadline
- [ ] Review the diff, then commit (needs approval)

### Step 2: Comparative evaluation (2.5 Flash vs 3.5 Flash-Lite)
- [ ] `scripts/eval_answers.py`: grounding, refusals, Hindi/Hinglish answers
- [ ] Query translation (Hinglish → English for RAG)
- [ ] Scope/grounding classifier (YES/NO agreement)
- [ ] Attachment triage + analysis (`with_structured_output`)
- [ ] Health-record summaries (`with_structured_output`)
- [ ] Log extraction from chat (`with_structured_output`)
- [ ] Transliteration for read-aloud
- [ ] Markdown in replies (3.5 adds `**bold**`): check app rendering and read-aloud
- [ ] Latency: median **and** worst case, per role; measure attachment/summary times to confirm the 60 s cutoff
- [ ] Optional: 1–2 h interleaved run to see whether stalls cluster by time of day
- [ ] Optional: Cloud Monitoring per-model latency in `vivamama-prod-100`
- [ ] Side-by-side results table added to this file

### Step 3: Decision and rollout (each item needs explicit approval)
- [ ] 3.5 Flash-Lite pricing confirmed
- [ ] Model decision recorded in [Decisions](#decisions)
- [ ] Commit + PR for Step 1 code
- [ ] Update `.env` and `.env.example` model variables
- [ ] UAT: switch model env vars, deploy, smoke test, watch logs/latency
- [ ] Production: switch model env vars, deploy, watch logs/latency for 24–48 h
- [ ] Confirm rollback works (env vars back to `gemini-2.5-flash`) while 2.5 is still served

### Step 4: Follow-up (other thread)
- [ ] Merge this fix into `feature/chatbot-improvements-content-suggestions` (expect conflicts in `app/llm/factory.py`, `app/settings.py`)
- [ ] Redraft content summaries with the chosen model

---

## Why

Every Viva AI feature runs on `gemini-2.5-flash` via Vertex AI in `asia-south1`: chat, translation, attachments, health summaries and read-aloud transliteration. 2.5 Flash is past its published Vertex retirement date (Oct 20, 2026). It still answers today, but if Google switches it off, all of Viva AI stops.

## Constraints

- **User data stays in India.** `asia-south1` only. No `global` endpoint, no US/EU fallback, no fallback region without explicit sign-off.
- No commit, push, UAT or production change without approval. UAT goes first, then production.
- Run tests with `PYTHONDONTWRITEBYTECODE=1` (tracked `.pyc` files under `app/` change otherwise).
- Vertex auth is gcloud ADC. On auth errors, run `gcloud auth application-default login`.
- Out of scope here: the RAG score normalisation bug (`RAGRetriever._normalize_score`) and the content-suggestion feature.

## Model choice

| Model | asia-south1 | Notes |
|---|---|---|
| gemini-2.5-flash | Yes | Current. Past retirement date. |
| gemini-3.8-flash | No (404) | `global` only. Also missing in asia-south2, asia-southeast1, us-central1, europe-west4. Ruled out. |
| **gemini-3.5-flash-lite** | **Yes** | **Candidate.** |

## Findings (Phase 0)

All tests used project `vivamama-prod-100` with synthetic prompts. They read and changed no user data.

### 1. Thinking settings are not the problem

LangChain (`langchain-google-vertexai` 3.2.4) builds `thinking_config={"thinking_budget": 0}`, and the value is serialised into the request. With the current factory config, 3.5 Flash-Lite answers in about 2 s. The ~12.6 s from earlier notes did not reproduce, and turning the thinking setting off or on made no difference. **No library change or upgrade is needed.**

### 2. The response format is different and breaks today's code

```python
# gemini-2.5-flash
response.content = "Postpartum bleeding, or lochia, typically lasts for two to six weeks after childbirth. \n"

# gemini-3.5-flash-lite
response.content = [
  {
    "type": "text",
    "text": "Postpartum bleeding (lochia) usually lasts for about **four to six weeks** after childbirth.",
    "thought_signature": "AY89a1+Aymgj7V2wMFeX...",   # opaque token, never show to users
  }
]
```

LangChain's `response.text` returns the joined answer text for both models.

| | 2.5 Flash | 3.5 Flash-Lite |
|---|---|---|
| `response.content` type | `str` | `list` of dicts |
| Answer text | the string | `text` of each part (may be several parts) |
| Extra data | none | `thought_signature` |
| Style | plain text | adds Markdown bold |

### 3. 3.5 Flash-Lite sometimes stalls for 3–20 s before starting

A raw streaming probe (no retries, connection and token reused) split each call into phases:

| 20 runs each, asia-south1 | wait for server to start (median / max) | writing the answer (median / max) | total (median / max) | stalls > 2 s |
|---|---|---|---|---|
| 3.5 Flash-Lite, Hinglish RAG prompt | 0.80 s / **19.49 s** | 1.03 s / 1.84 s | 1.88 s / 20.66 s | 6 / 20 |
| 3.5 Flash-Lite, "Reply OK" (1 token) | 0.59 s / **9.43 s** | 0.04 s / 0.08 s | 0.60 s / 9.48 s | 3 / 20 |
| 2.5 Flash, Hinglish RAG prompt | 0.50 s / 0.76 s | 2.77 s / 4.01 s | 3.32 s / 4.76 s | **0 / 20** |

- **Not thinking:** a one-token reply still stalled 9 s.
- **Not our network or code:** every call returned HTTP 200 / `STOP` with no retries.
- **Not our project or quota:** 2.5 Flash, run at the same time from the same project, never stalled.
- **Most likely cause (inferred):** queueing on Google's side because the regional capacity pool for 3.5 Flash-Lite is small and new, while 2.5 Flash has a large, mature pool with falling demand.

### 4. Model comparison: speed

| | 2.5 Flash (current) | 3.5 Flash-Lite (candidate) |
|---|---|---|
| Typical total (median) | 3.32 s | **1.88 s** |
| Worst total | **4.76 s** | 20.66 s |
| Stalls > 2 s | **0 / 20** | 6 / 20 |
| Answer length | ~450 tokens | ~190 tokens |
| Reply format | `str` | `list` of parts |

3.5 Flash-Lite is faster on a typical call but less predictable. Answer quality is still to be checked in Step 2.

### 5. Thinking-setting runs (3.5 Flash-Lite, medians, max in brackets)

| Run | Prompt | Runs | Factory config (budget 0) | No thinking setting | google-genai, budget 0 | google-genai, default |
|---|---|---|---|---|---|---|
| A | short | 5 | 0.94 s (2.75) | 0.86 s (1.20) | 1.13 s (2.27) | – |
| B | Hinglish RAG | 5 | 2.06 s (3.30) | 2.05 s (20.51) | 2.03 s (3.28) | – |
| C | Hinglish RAG | 10 | 2.00 s (13.54) | 2.11 s (14.01) | 2.15 s (15.93) | 2.00 s (13.56) |
| D | short | 20 | 0.89 s (22.46) | 0.87 s (16.95) | 0.92 s (14.83) | 1.03 s (8.16) |

In run B, REST transport took 2.58 s with one **1014 s hang**, and the v1 endpoint took 1.92 s. Neither was better.

### 6. There is no request timeout today

`_build_vertex` sets no timeout. A stuck Gemini call holds the request until the backend gives up at 150 s (`CHAT_TIMEOUT_MS`, `services/backend/src/services/llm/llm.service.ts`), and the user then gets an error. LangChain also retries non-retryable errors: an expired login was retried 5 times (about 30 s) before failing.

## Affected code

| Site | Today | With 3.5 Flash-Lite |
|---|---|---|
| Grounding/scope gate, `app/chains/chat_pipeline_mcp.py:1187` | `content.strip().upper()` | `AttributeError`, gate fails closed, **every question "not grounded"** |
| Main answer, `chat_pipeline_mcp.py:2215` | `_strip_thinking(content)` | `TypeError`, **every user gets the apology message** |
| Query translation, `chat_pipeline_mcp.py:1061` | `_strip_thinking(content)` | crash, Hindi/Hinglish queries go to RAG untranslated |
| Answer-length log, `chat_pipeline_mcp.py:2210` | `len(content)` | logs part count (1), not characters |
| `chat_pipeline_mcp.py:2500`, `app/chains/chat_pipeline.py:216`, `:287` | `response.content` as str | returns a list instead of text |
| Transliteration, `app/speech/transliterate.py` | own `_content_text` | already handles lists |
| Attachments, health summary, log extractor | `with_structured_output` | parsed by LangChain; verify in Step 2 |

**Switching the model env vars without Step 1 would break Viva AI entirely, with no visible error.**

## Step 1 design

**Reply text helper.** `app/llm/response.py` has one function, `response_text(msg) -> str`. It reads `.content`: a string is returned as is; for a list, the text parts are joined and signature and thinking parts are dropped. It reads `.content` rather than LangChain's `.text`, so the existing test doubles (`SimpleNamespace(content=...)`) keep working. Every site in the table above uses it.

**Deadline with retry.** A deadline abandons the stuck attempt and retries after 1 s. The client waits for the whole answer, so each deadline must exceed that role's slowest normal answer:

| Role | Slowest normal (seen / expected) | Deadline per attempt | Worst case (2 attempts) |
|---|---|---|---|
| Scope classifier | < 1 s | 8 s | 17 s |
| Translation, main answer | ~5 s (2.5 Flash max 4.76 s) | 20 s | 41 s |
| Log extractor | small JSON | 8 s (= its `wait_for`) | 17 s |
| Transliteration | whole reply | 30 s (= its `wait_for`) | 61 s |
| Attachment triage / analysis | not measured | 25 s / 50 s (= settings) | 51 s / 101 s |
| Health summary | not measured | 60 s (= setting) | 121 s |

Roles that already had an `asyncio.wait_for` get the same value as their deadline. `wait_for` stops waiting but can't stop the executor thread; the deadline ends the call itself. Their behaviour is otherwise unchanged.

`langchain-google-vertexai` counts `max_retries` as **total attempts**, so `max_retries=2` means one retry. One chat turn (translation + gate + main) can therefore take at most 41 + 17 + 41 = 99 s, under the core API's 150 s. A test pins this. If every attempt fails, the user gets the existing apology message, as today, but sooner.

**Limit:** a deadline only cuts stalls longer than itself. In the smoke test, 3.5 Flash-Lite stalled 14 s on the main answer and 24 s on the summary, both under their deadlines, so the user would still wait. Shortening stalls below 20 s would need streaming with a first-token deadline (the stall happens before the first byte). That's a possible follow-up, not part of Step 1.

**Dropped: skipping retries on unfixable errors.** The library retries every `GoogleAPIError` with no way to configure the list. Its retry helpers are internal, so changing them means patching library code. Also, the expired-login error arrived as a 503 "unavailable", so filtering by type wouldn't catch it anyway. With the 1 s back-off and two attempts, an unfixable error now costs about 1 s extra, not ~30 s.

**Unchanged:** `thinking_budget=0` stays (needed by 2.5 Flash, harmless on 3.5). LangChain `ChatVertexAI` stays. It is marked deprecated in favour of `langchain-google-genai`; moving to that is a separate task.

## Environment variables to switch (Step 3)

`LLM_MODEL`, `SCOPE_CLASSIFIER_MODEL`, `TRANSLATION_MODEL`, `ATTACHMENT_CLASSIFIER_MODEL`, `ATTACHMENT_ANALYSIS_MODEL`, `HEALTH_SUMMARY_MODEL`

Order: `.env` / `.env.example` → UAT → production. **Rollback:** set them back to `gemini-2.5-flash` (possible only while Google still serves it).

## Risks

| Risk | Mitigation |
|---|---|
| 3.5 Flash-Lite stalls (~1 in 4 calls, 3–20 s) | Per-role timeout + retry; watch whether capacity improves; Provisioned Throughput if needed |
| 2.5 Flash switched off before rollout | Step 1 is model-agnostic; switching is env-only once Step 1 ships |
| Shorter or differently styled answers | Step 2 quality eval; check Markdown rendering and read-aloud |
| Structured output differs on 3.5 | Step 2 covers attachments, health summary, extractor |
| Cost unknown | Pricing check before the decision |

## Decisions

| Date | Decision |
|---|---|
| 2026-11-26 | Keep LangChain `ChatVertexAI`; no switch to google-genai (thinking setting already reaches the model) |
| 2026-11-26 | Use `vivamama-prod-100` for local model tests (synthetic prompts only) |
| 2026-11-27 | Deadlines per role, 1 s back-off, 2 total attempts; don't patch the library's retry list |
| — | Model choice (after Step 2 and pricing) |

## Open questions

- 3.5 Flash-Lite pricing (being checked).
- Do the stalls cluster at certain times of day?
- Does the app render Markdown bold, and does read-aloud strip it?
- Is streaming with a first-token deadline worth it to cut stalls under 20 s?

## Step 1 smoke test (2026-11-27, through `get_llm()`, asia-south1)

| Call | 2.5 Flash | 3.5 Flash-Lite |
|---|---|---|
| Grounding gate | True (6.69 s, first call incl. client set-up) | True (2.13 s) |
| Translation (Hinglish → English) | correct (0.88 s) | correct (1.39 s) |
| Main answer | `str` → read correctly (0.71 s) | `list` → read correctly (13.97 s, stall) |
| Structured output (summary) | correct (0.73 s) | correct (23.72 s, stall) |
| Forced 50 ms deadline | `DeadlineExceeded` after 1.11 s (2 attempts + 1 s back-off) | same |
