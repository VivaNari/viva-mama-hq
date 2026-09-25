# Chatbot Expert Referral — Implementation Plan

Two requirements, three repos.

- **R1 — Referral-aware expert directory:** the expert list injected into the chatbot
  prompt must obey the same visibility rule the app's `GET /experts` already applies:
  if the user was referred by expert *X* (category *C*), she may only ever see *X*
  within category *C*; all other categories remain fully visible.
- **R2 — Connect button:** when the answer recommends a specific expert, the chat
  bubble renders a "Connect with …" button that opens `ExpertDetails` for that expert.

Repos:
- `rag_chatbot` (FastAPI + MCP + LLM pipeline)
- `vivamam_core_server` (Node/Express, owns MongoDB + SSE to the app)
- `viva_nari_app` (React Native client)

---

## 0. Current state (verified)

**Visibility rule (the authority)** — `vivamam_core_server`
[expert.controller.ts:30-44](../../mern/vivamam_core_server/src/api/v1/controllers/expert/expert.controller.ts#L30-L44):

```
experts = find({ isActive: true }).populate("category")
if (user.referred_by_expert_id) {
    referred = experts.find(e => e._id == user.referred_by_expert_id)
    if (referred) keep e  ⟺  e._id == referred._id  ||  e.category != referred.category
}
```

**Chatbot directory (unfiltered)** —
`rag_chatbot/app/mcp/tools/get_experts_tool.py`: `get_all_experts()` takes no
`user_id`, projects only `{name, speciality}` from every `isActive != false`
expert. `context_server._handle_get_all_experts` passes no user, and
`chat_pipeline_mcp._fetch_user_context` calls it with `{"format_for_prompt": True}`
only. The formatted block lands in the prompt under
`=== VIVAMAMA EXPERT DIRECTORY ===` ([chat_pipeline_mcp.py:1212](../../artificial_intelligence/rag_chatbot/app/chains/chat_pipeline_mcp.py)),
and the `MASTER REFERRAL RULES` in `SYSTEM_PROMPT` tell the model to pick a name
from it. So today a referred user can be pointed at a competing expert in her
referrer's own category.

**Answer transport:** pipeline → FastAPI `/v1/chat` → `LLMService.sendUserQuery`
→ `ChatFlowAIService.processChatbotResponse` → SSE `ai_message` → RN
`useChatSession` → `IAiMessage` → `ChatBubble`. The answer is free-form markdown;
nothing structured about the recommended expert survives the trip.

**Chatbot history is in-memory on the client** (`shouldSaveHistory(CHATBOT) === false`),
so R2 needs **no SQLite migration** — the button only has to live as long as the
message object in React state.

---

## R1 — Referral-aware expert directory

### 1.1 `rag_chatbot/app/mcp/db_connection.py`

Add `get_expert_categories_collection()` returning `db["expert_categories"]`
(used to resolve a readable category name for the prompt; keeps the LLM's
"Supplements → Dietitian" matching working when we start grouping by category).

### 1.2 `rag_chatbot/app/mcp/tools/get_experts_tool.py`

Rewrite `get_all_experts(user_id: Optional[str] = None)`:

1. Projection changes from `{"_id": 0, name, speciality}` to
   `{"_id": 1, "name": 1, "speciality": 1, "category": 1, "translations": 1}`.
   `_id` and `translations` are needed for R2 (id → deep link, translated names →
   matching a Hindi answer); `category` is needed for the filter.
2. Fetch active experts with `{"isActive": True}` — **changed** from today's
   `{"isActive": {"$ne": False}}` to match the app exactly (see §1.6).
3. If `user_id` is given, load `users.find_one({_id: ObjectId(user_id)}, {"referred_by_expert_id": 1})`
   and apply the port of the Node rule:

```python
referred_id = (user_doc or {}).get("referred_by_expert_id")
if referred_id:
    referred = next((e for e in experts if str(e["_id"]) == str(referred_id)), None)
    if referred:
        referred_category = str(referred.get("category"))
        experts = [
            e for e in experts
            if str(e["_id"]) == str(referred_id)
            or str(e.get("category")) != referred_category
        ]
```

   Note the `if referred:` guard is load-bearing and mirrors the backend: when the
   referring expert is inactive/deleted, **no** filtering happens and the user sees
   everyone. Do not "improve" this — divergence between the app list and the
   chatbot is exactly the bug we're fixing.
4. Resolve `category` ObjectIds to names in one `expert_categories.find({_id: {$in: [...]}})`
   round trip; attach as `category_name`.
5. Return JSON-safe rows: `{"id": str(_id), "name", "speciality", "category_name",
   "name_variants": [base name + every `translations.<lang>.name`]}`.
   **Never** put raw `ObjectId` in the returned dict — `_handle_get_all_experts`
   `json.dumps` it without `default=str` today and would raise.
6. Add `filtered_by_referral: bool` to the result for logging/QA.

`format_experts_for_prompt` keeps its current one-line-per-expert shape but appends
the category, and must **not** emit `id`/`name_variants` (prompt-size + no reason to
show the model an ObjectId it could hallucinate back at us):

```
- Dr. Anita Rao, Lactation Consultant (Lactation)
```

### 1.3 `rag_chatbot/app/mcp/context_server.py`

- Tool schema for `get_all_experts`: add optional `user_id` property, and extend the
  description to say the directory is *already scoped to this user* and is the only
  permitted source of expert names.
- `_handle_get_all_experts`: read `user_id`, pass through, and `json.dumps(..., default=str)`
  for the non-formatted branch as a belt-and-braces guard.

### 1.4 `rag_chatbot/app/chains/chat_pipeline_mcp.py`

In `_fetch_user_context`, change the expert call to request **structured** data and
format locally, because R2 needs the ids anyway:

```python
expert_result = await session.call_tool(
    name="get_all_experts",
    arguments={"user_id": user_id, "format_for_prompt": False},
)
payload = json.loads(expert_result.content[0].text)
context_result.experts = payload.get("experts", [])
context_result.expert_directory = format_experts_for_prompt(payload)
```

`format_experts_for_prompt` lives in **`app/experts/formatting.py`**, not in
`get_experts_tool`, and the pipeline imports it from there. It cannot be imported
from the tool module: that pulls in `app.mcp.db_connection`, which calls
`get_mongo_client()` at module scope — so the API process would open a Mongo
connection at import and hard-fail on boot if Mongo were unreachable, instead of
degrading gracefully the way it does today. `get_experts_tool` re-exports the
function so existing callers are unaffected.
Add `experts: List[Dict[str, Any]] = field(default_factory=list)` to
`UserContextResult`.

**Cache check (already safe):** `_user_context_cache` is keyed by `user_id` with a
60s TTL, so a referral-scoped directory can never be served to a different user. The
only exposure is a ≤60s staleness window right after a referral code is applied —
acceptable; note it in the PR.

### 1.5 Backend consistency (in scope — decided)

Extract the rule out of the controller into
`ExpertService.getVisibleExperts(userId)` and have
[expert.controller.ts](../../mern/vivamam_core_server/src/api/v1/controllers/expert/expert.controller.ts)
call it. R2's server-side validation (§2.4) reuses the same method, so the rule
exists in exactly two places overall (Node + the Python port) instead of four.

While there: the current comparison `String(e.category) !== referredCategory` runs on
**populated** Mongoose documents, so it is stringifying whole sub-documents. It
happens to produce the right answer (identical docs stringify identically), but it is
fragile — switch to comparing `e.category?._id`. Behaviour-neutral.

### 1.6 Close the `isActive` divergence (in scope — decided)

The app filters `isActive: true`; the chatbot filters `isActive != false`, so an
expert document missing the field entirely is invisible in the app but visible to the
chatbot. Aligning the chatbot to `isActive: true` (§1.2) turns "chatbot directory ==
app list" into an exact invariant the tests in *Verification* can assert on, instead
of an approximate one with a documented exception.

---

## R2 — Connect button

### 2.1 How we know which expert was suggested

The answer is free-form markdown, so the recommended expert must be recovered as
structured data. Three options were considered:

| | Approach | Verdict |
|---|---|---|
| A | **Match directory names against the finished answer** | ✅ chosen — deterministic, zero extra latency/cost, cannot produce an id that isn't in the user's own filtered directory |
| B | Have the LLM emit a marker like `[[EXPERT:<id>]]` | ✗ depends on prompt compliance; partial compliance leaks raw markers into user-visible text; ids can be hallucinated |
| C | Second LLM extraction call | ✗ adds a full round trip to every chat turn |

Option A's correctness comes for free from R1: the candidate set *is* the
referral-filtered directory, so the button can never deep-link to an expert the
user isn't allowed to see.

### 2.2 `rag_chatbot` — detection

New module `app/experts/suggestion.py`:

```python
def detect_suggested_experts(answer: str, experts: list[dict], limit: int = 1) -> list[dict]
```

Rules:
- For each expert, test every entry in `name_variants` (base + translated names).
- Normalise both sides: casefold, strip honorifics (`Dr.`, `Dr`, `डॉ.`, `डॉ`),
  collapse whitespace, drop markdown emphasis (`**Anita Rao**` must match).
- Match on a word/`\b`-style boundary built with `re.escape`, so "Anita" does not
  match inside a longer unrelated token.
- Rank by first character offset in the answer, return the first `limit`. **`limit`
  stays at 1** — when a reply names a second expert (e.g. for product clearance), the
  first one named wins and the second remains plain text in the answer. The parameter
  exists so this is a one-line change if that call is ever revisited.
- Return `[{"id", "name", "speciality"}]`.

Wire into `chat_once` right after `final_answer` is assembled
([chat_pipeline_mcp.py:1871](../../artificial_intelligence/rag_chatbot/app/chains/chat_pipeline_mcp.py)):

```python
suggested_experts = (
    [] if severity == "HIGH"
    else detect_suggested_experts(draft_answer, user_context.experts)
)
```

Match against `draft_answer`, **not** `final_answer` — the escalation banner is
prepended text we don't want to scan. Suppress entirely on `severity == "HIGH"`: an
emergency response must push the user to emergency services, not to a booking screen.

Add `suggested_experts: List[Dict[str, Any]]` to the pipeline `ChatResponse`
dataclass (default `[]`, so the four early-return `ChatResponse(...)` sites —
rate-limit, out-of-scope, self-query, LLM-fallback — need no changes) and to the
FastAPI `ChatResponse` model + the `resp = ChatResponse(...)` construction in
`app/api/main.py`.

### 2.3 Prompt nudge (small, `SYSTEM_PROMPT`)

Under `MASTER REFERRAL RULES`, add: *"Write the expert's name exactly as it appears
in the directory, even when the rest of your reply is in Hindi or Hinglish."*
This is the matcher's reliability lever. If the model transliterates anyway, the
`name_variants` list is the fallback, and worst case we simply render no button —
never a wrong one.

### 2.4 `vivamam_core_server` — transport + validation

`ChatFlowAIService.processChatbotResponse`
([chat-flow-ai.service.ts:151](../../mern/vivamam_core_server/src/services/chat-system/chat-flow-ai.service.ts#L151)):

1. Read `llmResponse.suggested_experts`.
2. **Re-validate server-side** — the Node server is the authority on visibility, and
   the Python port could drift. Call the new `ExpertService.getVisibleExperts(userId)`
   from §1.5 and keep only suggestions whose id is in that set (which also drops
   inactive/deleted experts).
3. Persist on the message so the record matches what the user saw: add
   `suggestedExperts: [{ expertId: ObjectId, name: String, speciality: String }]`
   (`default: []`) to `message.schema.ts` and `IMessage`. Chosen over stuffing JSON
   into the existing `rich: String` field so the data stays queryable — e.g. "how
   often does a bot referral convert to a booking". Purely additive with a default,
   so existing message documents need no migration.
4. Add `suggestedExperts?: {...}[]` to `AILLMResponse` in `types/chat.types.ts` and
   include it in the `aiLlmResponse` SSE payload.

### 2.5 `viva_nari_app` — render + navigate

1. **Types** (`src/types/chat.types.ts`): add
   `export interface ISuggestedExpert { expertId: string; name: string; speciality?: string }`
   and an optional `suggestedExperts?: ISuggestedExpert[]` on both `IAiMessage` and
   `ISSEMessageData`.
2. **`src/hooks/useChatSession.ts`**: map `data.suggestedExperts ?? []` into the
   `aiMessage` in the `AI_MESSAGE` branch.
3. **`src/components/chatBubble/`**: add an **optional**
   `onConnectExpert?: (expertId: string) => void` to `ChatBubbleProps`,
   `StaticBubbleProps` and `AnimatedBubbleProps`, and a shared
   `renderConnectButton()` in both bubbles:
   - render only when `isAi && isChatbotMessage(message) && suggestedExperts?.length`
     and `onConnectExpert` is provided;
   - in `AnimatedBubble`, gate on the existing `showOptions` flag so it appears once
     the typing animation finishes, matching how every other bubble affordance
     behaves;
   - place it under the bubble next to the bookmark row, reusing
     `bubbleStyles.optionButton` / `specialOptionButton` so it inherits the
     established look;
   - label `t('chat.connectWithExpert', { name: expert.name })`,
     `accessibilityRole="button"`.
4. **`src/screens/ChatWithVivaAI.tsx`**: add
   ```ts
   const handleConnectExpert = useCallback(
       (expertId: string) => navigation.navigate('ExpertDetails', { expertId }),
       [navigation],
   );
   ```
   and pass it to `<ChatBubble onConnectExpert={handleConnectExpert} />`.
   `ExpertDetails` already reads `route.params.expertId` and fetches by id
   ([ExpertDetails.tsx:39](src/screens/ExpertDetails.tsx#L39)), so booking, credits and
   the payment path all work unchanged — no new screen, no new API.
5. **i18n** (`src/i18n/locales/en.json`, `hi.json`): add
   `chat.connectWithExpert` — `"Connect with {{name}}"` / `"{{name}} से जुड़ें"`.
   Static UI text only; the expert's name is backend content and is interpolated,
   never translated.

`ChatBubble` is only consumed by `ChatWithVivaAI`, so keeping the prop optional means
nothing else in the app has to change.

---

## Build order

1. **R1 chatbot** — `db_connection` → `get_experts_tool` → `context_server` →
   `chat_pipeline_mcp`. Independently shippable and independently verifiable via
   `final_prompt` in the `/v1/chat` response.
2. **R1 backend refactor** — `ExpertService.getVisibleExperts`, controller rewired.
   Pure refactor, no behaviour change.
3. **R2 chatbot** — `suggestion.py`, pipeline field, API model.
4. **R2 backend** — schema field, validation, SSE payload.
5. **R2 app** — types → hook → bubbles → screen → locales.

Steps 1–2 and 3–5 are two reviewable PRs. Nothing in 3–5 changes behaviour until the
chatbot starts returning a non-empty `suggested_experts`, so the app change is safe
to ship ahead of the pipeline deploy.

---

## Verification

**R1**
- Seed a user with `referred_by_expert_id` = an expert in the Lactation category.
  Hit `/v1/chat` and read `final_prompt`: the directory block must contain that
  expert and **zero** other Lactation experts, while Nutrition/Emotional/Gynae
  experts are all still listed.
- Diff the directory names against `GET /api/v1/experts` for the same user — with
  §1.6 closed, the sets must be **exactly** identical. Assert this for a referred
  user, an unreferred user, and a tenant containing an expert doc with no `isActive`
  field at all.
- A user with `referred_by_expert_id: null` sees the full directory (regression).
- A user referred by a **deactivated** expert sees the full directory, matching the
  app.
- No `user_id` / malformed `user_id` → full directory, no exception.
- `test_context_server.py` already exercises the MCP tool surface — extend it with a
  referred-user case.

**R2**
- Ask something that reliably triggers a referral ("should I take a calcium
  supplement?") → response carries exactly one `suggested_experts` entry whose `id`
  is in the filtered directory; the bubble shows the button; tapping it lands on that
  expert's `ExpertDetails`.
- Ask a generic question → `suggested_experts: []`, no button.
- Emergency phrasing (red-flag terms) → banner present, `suggested_experts: []`,
  **no** button.
- Hindi and Hinglish turns: name written in Devanagari must still resolve via
  `name_variants`; if it doesn't resolve, confirm the graceful outcome (no button,
  no crash, answer intact).
- Referred user: confirm the button can never deep-link to a same-category
  non-referred expert, even if the answer names one — the server-side filter in
  §2.4 is the assertion under test here.

---

## Risks

| Risk | Mitigation |
|---|---|
| LLM writes a transliterated/paraphrased name → no match | `name_variants` covers stored translations; prompt rule §2.3; failure mode is a missing button, never a wrong one |
| Two experts with the same first name | Match on the full stored name string, not tokens; cap at 1 result ordered by first occurrence |
| Python port of the visibility rule drifts from Node | Server-side re-validation in §2.4 makes Node the last word; both live in named, tested functions |
| Prompt grows with `category_name` | Directory is one short line per expert; the products block (capped at 3500 chars) dominates. Measure `len(final_prompt)` before/after — expect a low-hundreds-of-chars delta |
| Referral applied mid-session serves a stale directory | ≤60s `_user_context_cache` TTL; acceptable, documented |
