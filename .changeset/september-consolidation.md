---
"@vivamama/backend": minor
"@vivamama/chatbot": minor
"@vivamama/contracts": minor
---

Second consolidation: resync the services with their source repos and import the
admin console.

**Backend** gains the admin API (`/api/v1/admin/*`, SUPER_ADMIN-enforced),
subscriptions and Google Play billing, referral programs, Viva Club moderation,
webhooks, analytics and ~24 migration scripts. `payments` is superseded by
`subscription`, and `weeklyCheckin` by `weekly-checkin-v1`.

**Chatbot** gains a provider-agnostic LLM factory with Vertex AI (Gemini)
alongside Groq, GCS-backed embedding-model provisioning, a LactMed lookup, a
content knowledge-base MCP tool, referral-scoped expert visibility and
entitlement-based product suppression.

**Contracts** gains `apiRoutes.admin.*`, mirroring the backend's admin router so
the console no longer hard-codes API paths.
