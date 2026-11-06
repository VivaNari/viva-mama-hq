---
"@vivamama/backend": minor
"@vivamama/care-schedules": minor
---

The 1000-day Journey tab replaces the static mock: a five-stage bar, Happening, Coming up and
Remember cards, a Baby view, and "When to get help" on every Journey screen.

**Care schedules.** A new `@vivamama/care-schedules` package holds the ANC and PNC schedule
structure and timing windows for both the app and the API. The ANC checkup opens to public
women, the public schedule gains its sugar tests, scans and PMSMA, and a new PNC checkup runs
from the birth to 24 months (`GET`/`PUT /mother-logs/pnc-schedule`, log types `pnc_visit` and
`pnc_schedule_item`).

**Delivery.** `POST /user/labour-started` and `POST /user/baby-arrived` back two new buttons.
The due-date job now marks the date as estimated, and it stays correctable until she confirms it.

**Content.** `scripts/generate-journey-content.mjs` builds the Journey data from the workbook in
`content/journey`. Clinical content is a draft awaiting sign-off, and Hindi falls back to English.
