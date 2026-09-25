---
"@vivamama/admin": minor
---

Import the admin console into the monorepo as `apps/admin`.

The staff operations surface: consultation scheduling (including confirming the
agreed meeting time, which is what unlocks the patient's Join button) and the
content-moderation queue behind the app's report button. A static React/Vite SPA
that reads its API paths from `@vivamama/contracts`.
