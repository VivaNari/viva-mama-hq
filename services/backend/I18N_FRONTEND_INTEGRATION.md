# i18n (Hindi) — Frontend Integration Guide

This document lists everything the frontend needs to integrate Hindi (`hi`)
localization. It covers onboarding, weekly check-in, recommendations, push
notifications, products, experts, and content/articles.

> **TL;DR**
> - Supported languages: `en` (default) and `hi`.
> - Persist the user's choice once via `PUT /api/v1/user/update-user-data` with `{ "preferred_language": "hi" }`.
> - After that, **all localized endpoints automatically return Hindi** for that user — no other change required.
> - Optionally, you can override per request with a `lang` parameter (query or body, see table).
> - **Response shapes do NOT change.** Localized strings are swapped in place; an internal `translations` field is stripped before sending.

---

## 1. Supported languages

| Code | Language | Notes |
|------|----------|-------|
| `en` | English  | Default. Used whenever no language is set or an unknown value is sent. |
| `hi` | Hindi    | Devanagari. |

Any unsupported/empty value silently falls back to `en`.

---

## 2. How the language is resolved (priority order)

For every localized response the backend picks the language as:

```
1. explicit `lang` in the request (query param or body field)   ← highest priority
2. user.preferred_language (persisted on the user)
3. "en"                                                          ← default fallback
```

So you have two integration styles, and they compose:

- **Persisted (recommended):** set `preferred_language` once; every endpoint returns the right language with no per-call work.
- **Per-request override:** send `lang` on a specific call (e.g. a language toggle/preview) to override the persisted value just for that response.

---

## 3. Setting the user's preferred language

New persisted field on the user object:

```jsonc
// user
{
  "preferred_language": "en" | "hi"   // default "en"
}
```

It is returned by `GET /api/v1/user` and can be updated with the existing
profile update endpoint:

```http
PUT /api/v1/user/update-user-data
Authorization: Bearer <token>
Content-Type: application/json

{ "preferred_language": "hi" }
```

**Recommended UX:** capture the language choice at the start of onboarding (or in
Settings) and call this endpoint, so onboarding itself and all later screens are
already in Hindi. Notifications and the recommendation snapshot (see §6) rely on
this persisted value because they run server-side with no request context.

---

## 4. Per-request `lang` override — where to put it

The override is read from **query for GET / SSE endpoints** and from the
**body for POST endpoints**. (For check-in POSTs, query also works.) Value is the
language code, e.g. `lang=hi`.

---

## 5. Endpoint reference

Base URL: `/api/v1`. All endpoints below already require auth as before; nothing
about auth changed.

### Onboarding & Weekly check-in (guided chat — SSE)

| Endpoint | Method | Where to send `lang` | Localized content |
|---|---|---|---|
| `/chat-session/:slug` | GET (SSE) | **query**: `?lang=hi` (auth token also in query) | Question `text`, `educationalMessage`, `whyThisMatters`, each option `label` in the streamed `data:` payloads |
| `/chat-flow/answer` | POST | **body**: `{ "lang": "hi" }` | The next question payload returned/streamed |

`:slug` is `onboarding-flow-v2` (onboarding) or `weekly-checkin-v1` (check-in),
with `flowType` as today (`ONBOARDING` / `CHECK_IN`).

Example SSE connect:
```
GET /api/v1/chat-session/onboarding-flow-v2?flowType=ONBOARDING&token=<jwt>&lang=hi
```

### Weekly check-in v1 (request/response)

| Endpoint | Method | Where to send `lang` | Localized content |
|---|---|---|---|
| `/chat/checkin/start` | POST | **body**: `{ "week": 5, "lang": "hi" }` (query also accepted) | `data.nextQuestion` (text/options/etc.) |
| `/chat/checkin/answer` | POST | **body**: `{ ..., "lang": "hi" }` (query also accepted) | `data.nextQuestion` |
| `/chat/checkin/answer/current` | GET | **query**: `?week=5&lang=hi` | `currentQuestion` |
| `/status` (check-in status) | GET | n/a | Returns only progress/state — no display text, nothing to localize |

The question payload keys are unchanged. Only the human-readable values
(`text`, `educationalMessage`, `whyThisMatters`, `options[].label`) come back in
Hindi. Logic fields are unchanged — see §7.

### Products

| Endpoint | Method | Where to send `lang` | Localized fields |
|---|---|---|---|
| `/products` | GET | **query**: `?lang=hi` | `productName`, `productDescription`, `productCategory`, `productPriceRange`*, `safetyFlag` |
| `/products/:id` | GET | **query**: `?lang=hi` | same as above |

\* `productPriceRange` is currently left as the base value (numeric range).

### Experts

| Endpoint | Method | Where to send `lang` | Localized fields |
|---|---|---|---|
| `/experts` | GET | **query**: `?lang=hi` | `name`, `speciality`, `qualification`, `bio` |
| `/expert/:id` | GET | **query**: `?lang=hi` | same as above |

### Content / Articles

| Endpoint | Method | Where to send `lang` | Localized fields |
|---|---|---|---|
| `/contents` | GET | **query**: `?lang=hi` | `featuredTitle`, `contentBody[]` (each block's `body`) |
| `/contents/:id` | GET | **query**: `?lang=hi` | same as above |

`contentBody` stays the same array shape (`[{ contentType, body }, ...]`); only
each `body` string is translated. `contentType`, ordering, and VIDEO/IMAGE URLs
are unchanged.

> **Rollout note:** every article **title** is translated. Article **bodies** are
> being translated in batches. Until a given article's body is translated, the
> body falls back to English while the title shows in Hindi (per-field fallback,
> see §8). This is expected and safe — no special handling needed on the FE.

### Recommendations (after weekly check-in) — server-side, no FE param

The recommendation engine localizes using the user's persisted
`preferred_language` at the moment the check-in completes, and stores the result
in the recommendation history snapshot.

| Endpoint | Method | Notes |
|---|---|---|
| `/recommendation-history` (and formatted variant) | GET | Returns the stored snapshot as-is, already in the language used at check-in time. No `lang` param. |

Implications for FE:
- No `lang` parameter to send here.
- A history record reflects the language the user had **when that check-in was
  done**. If the user switches `en`↔`hi` later, **past** records keep their
  original language; **new** check-ins use the new language. (This is intentional
  — history is a point-in-time record.)
- Localized fields in the snapshot: `tagline`, and per category
  `title`, `goingWell`, `needsHelp`, `tips[]`, `celebrate[]`, `next[]`.

### Push notifications — server-side, no FE param

Weekly check-in pushes (new check-in available, reminder, completion) are sent in
the user's persisted `preferred_language`. Nothing to do on the FE except make
sure `preferred_language` is set. The notification `data` payload keys are
unchanged; only `title`/`body` text is localized.

---

## 6. Response shape — no breaking changes

- **No keys are added or removed** in API responses. Localized string fields are
  simply returned with Hindi values instead of English.
- An internal `translations` object exists on these documents in the database but
  is **stripped from every response** — you will never receive it, and should not
  depend on it.
- You do **not** need to change parsing/models. Switching language only changes
  the text values inside the existing fields.

---

## 7. What is NOT translated (intentionally)

These are logic/structural fields and must stay identical across languages — keep
using them exactly as today:

- Identifiers: `_id`, node `id`, `flowInstanceId`, option `value`, outcome `key`
- Scoring/branching: `score`, `selectedKeys`, `branch`, `calc`, `next`,
  `nodeType`, `validWeekStart`/`validWeekEnd`, `categoryId`
- Product/expert/content structural fields: image URLs, `productAffiliateLink`,
  `userCategory`, `remuneration`, `yearsOfExperience`, `category`,
  `validWeekStart`/`End`, `authors`, `reviewers`, `contentBody[].contentType`,
  VIDEO/IMAGE URLs

Because option `value`/`selectedKeys`/`score` are unchanged, **answer submission
payloads are exactly the same** regardless of language — keep sending the same
`value`/`selectedKeys` you do today.

---

## 8. Fallback behavior (important)

Localization is **per-field with graceful fallback**:

- If a translation for a field is missing, the **English** value is returned for
  that field only — the response is never empty or broken.
- This means you can briefly see **mixed** content (e.g. a Hindi article title
  with an English body) while body translations are still being rolled out. Treat
  any returned string as display-ready as-is.

---

## 9. Quick examples

Set preference once:
```bash
curl -X PUT /api/v1/user/update-user-data \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"preferred_language":"hi"}'
# → subsequent calls below need no lang param
```

Per-request override (GET):
```bash
curl "/api/v1/products?lang=hi"      -H "Authorization: Bearer $TOKEN"
curl "/api/v1/experts?lang=hi"       -H "Authorization: Bearer $TOKEN"
curl "/api/v1/contents?lang=hi"      -H "Authorization: Bearer $TOKEN"
curl "/api/v1/chat/checkin/answer/current?week=5&lang=hi" -H "Authorization: Bearer $TOKEN"
```

Per-request override (POST body):
```bash
curl -X POST /api/v1/chat/checkin/start \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"week":5,"lang":"hi"}'
```

SSE (lang + token in query):
```
/api/v1/chat-session/weekly-checkin-v1?flowType=CHECK_IN&token=<jwt>&lang=hi
```

---

## 10. Integration checklist

- [ ] Add a language selector (onboarding + settings); on change call
      `PUT /user/update-user-data` with `preferred_language`.
- [ ] Read `preferred_language` from `GET /user` to render the selector's current state.
- [ ] (Optional) Pass `lang` on GET/SSE (query) and check-in POST (body) where you
      want an explicit override / instant preview before the user's preference is saved.
- [ ] No model/parsing changes needed — same response shapes.
- [ ] Expect occasional EN body + HI title on articles during body rollout.
