# Mock clinical data for AllyVora Outpatient and Emergency — 27 October 2026

Status: **local working tree on `main` after `50d8c71`; not committed, not pushed, not deployed.** The local demo on port 4110 and the mock API on 3200 were rebuilt and restarted for checking.

## Changes and user impact

- **The intake and triage pages now show data.** Both pages had shown "Couldn’t load the queue / No route for GET /encounters" because nothing served the AllyVora clinical workspace API. The mock API now serves it under `/allyvora-clinical` ([allyvora-clinical-store.mjs](../../../mock-api/allyvora-clinical-store.mjs)): six outpatient visits across every stage and six emergency visits (three waiting for triage, one unidentified; three triaged at ESI 2–4), fictional patients and allergies, complaint and allergen catalogues.
- **Same contract as the workspace.** Paths, payloads, the outpatient status changes (registered → intake on opening, ready after saving, see now), triage save (triaged, final level, reassessment time 15/60/120/180 minutes by level), NEWS2 bands and the ESI decision points with the age-banded danger zone are ported from the AllyVora workspace API (commit `e025f48`). Validation returns the problems list the forms show.
- **Signed-in only.** Requests need the demo sign-in (bearer session); without it the API answers 401. Demo accounts act as nurses; accounts whose role contains `doctor` act as doctors.
- **Demo adapter.** `modules/outpatient/adapter.ts` now sends the clinical port through the demo's signed-in request client with the `/allyvora-clinical` prefix instead of the front desk client; the emergency pages share it.

## Limits

Data is in memory and resets when the mock API restarts; waiting times grow from the API's start time. The NEWS2 and ESI logic is a port for demonstration, including the workspace's documented ESI gaps (missing HR/RR/SpO₂ treated as normal); it is not clinically validated. Front desk pages (Start a visit, Emergency registration) still have no mock backend.

## Verification

Node 24.22.1, uncommitted working tree on `main` after `50d8c71`, 27 October 2026:

- `mock-api/allyvora-clinical-store.test.mjs` 6/6 (NEWS2 bands and missing inputs; ESI A–D with age bands; lists; outpatient status, validation, save and conflicts; triage preview, override reason, final level and reassessment; catalogue, allergies, unknown routes). Whole mock-api suite: 332 passed, 7 failed — the payment simulator tests (`healthcare-suite-rcm-exchange`, `healthcare-suite-rcm-money-lifecycle`), which need the pinned external simulator repository (`HC_RCM_MOCK_REPO`) that is not on this server; CI clones it. `npm run typecheck` in mock-api passed.
- Healthcare demo: `tsc --noEmit` passed; full vitest 1,934 passed, 4 skipped, 0 failed. The outpatient and emergency tests now send through the demo request client; the all-routes test's synthetic request mock gained the clinical worklists (it reported them as unexpected requests until then).
- Live on this server: mock API restarted on 127.0.0.1:3200 with its existing data folders, demo rebuilt and restarted on 0.0.0.0:4110. Through the demo `/api`, a request without sign-in returned 401; signed in as the synthetic `user1`, `/allyvora-clinical/auth/me` returned a nurse, both worklists returned the seeded visits, the ESI preview returned level 2 with the danger zone, NEWS2 returned 0; both pages returned 200.
- `check-boundaries.mjs` and `check-docs.mjs` passed; `git diff --check` clean.

Not run: browser rendering (Chromium on this server lacks system libraries such as `libatk`), full `npm run ci`, test-site packaging or deployment.
