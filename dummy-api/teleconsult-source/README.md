# Teleconsult source (backend-only)

Provenance: `teleconsult-01/teleconsult` reference (`shared/types.ts`, `backend/src/{catalog,store,intelligence}.ts`).
The Express server is not copied; `../reference-teleconsult-store.mjs` exposes the same `/api` surface through the
authenticated host `handle(user, scope, request)` adapter and reuses these modules.

- `types.ts` – shared contract, plus marked hosted additions (`Encounter.version`, `overrideReason`, `followUpAppointmentId`, `LiveVitals.simulated`).
- `catalog.ts` – fictional ICD, formulary, orderable, order-set, template and score catalog.
- `seed.ts` – synthetic patients, staff, visits and encounters. `buildSeed()` returns a fresh clone per tenant/application/branch.
- `intelligence.ts` – rule-based decision support, suggestions, scores and scripted ambient scribe.
- `ids.ts` – identifier/clock helpers.

Only import-extension and factory changes were made so Node 24 can run the `.ts` files (type stripping). No enums or parameter properties are used.

## Simulation boundary

Everything here is **demonstration logic**. Decision-support alerts, AI suggestions, the scribe, NEWS2/CURB-65/PHQ-9/etc. scores,
the vitals feed and the transcript are fictional, rule-based or scripted. They are not validated clinical software, do not use real
devices, speech recognition or models, and make no diagnostic, dosing or safety claims. Data is fictional and must not be replaced
with real patient information.

## Host contract (`../reference-teleconsult-store.mjs`)

`createReferenceTeleconsultStore({dataDir, policy?, now?})` → `{handle(user, scope, request), close()}`. `policy` is a config document
(default `../config/teleconsult/nexora.json`, validated at creation; invalid values throw). `now` is a test clock. No port is opened.

- `user`: trusted `{id, tenantId, role, name?}`. `scope`: `{applicationId, branchId, moduleId}` with `moduleId` `reference-teleconsult-provider` or `reference-teleconsult-patient`.
- `request`: `{method, path (starts /api), query: URLSearchParams, body, headers}` → `{status, body, headers}` (always `Cache-Control: no-store`).
- One durable partition per tenant/application/branch, shared by both modules (`<sha256>.json`, atomic temp+fsync+rename, single-writer lease directory). Damaged files are preserved and answer 503, never reseeded.
- Provider: `X-Teleconsult-Role: doctor|nurse` (or `?role=` on `GET /api/session`), validated against grants. Patient: `X-Teleconsult-Patient: <id>` (or `?patientId=` on the session), validated; a dedicated patient account is fixed to the host's trusted `user.teleconsultPatientId`; a missing mapping denies access (the configured `defaultPatientId` only seeds an admin's initial selection).
  Roles: `enterprise-admin`/`admin` (both provider modes, any fixture patient), `teleconsult-doctor`, `teleconsult-nurse`, `teleconsult-patient`. Doctor/nurse map to staff `d1`/`n1` for source relationships; audit records the real `user.id`.
- Changes (POST/PUT/PATCH) need `Idempotency-Key` (428 when missing, 400 invalid). Identical replays return the stored response with `Idempotent-Replay: true`; the same key with a different request is 409. Pure computations (`/cds`, `/suggest`, `/scribe`, `/api/scores/compute`) are exempt.
- Encounters carry `version`. `PUT /api/encounters/:id` and `POST /api/encounters/:id/sign` (`{encounter, signerId?, overrideReason?}`) must send the current `encounter.version` (428 missing, 409 `version-conflict`). Both return the saved encounter with the new version; use it for the next request. Signed encounters answer 409 `signed`.
- Source routes are preserved. `…/vitals/stream` and `…/transcript/stream` answer 410; poll `GET /api/appointments/:id/vitals/current` (LiveVitals frame, `simulated: true`) and `…/transcript/current[?after=<lineId>]` (a TranscriptLine, `{done:true}` or `{pending:true, reason}`; appended only while recording is active with consent).
- Patient registration: only the all-patient admin demo grant may `POST /api/patients` from the patient module, and only while `access.allowAdminPatientRegistration` is true (shipped default). Fixed patient accounts never can. Allergy authorship is the host `user.id` (providers: the mapped staff id); caller claims such as `recordedBy` are ignored. `canRegister` on the patient session mirrors this.
- Recording always requires patient consent; `recording.consentRequired: false` is rejected as invalid configuration. Recording, transcript and vitals remain a simulation.
- `GET /api/booking-advice?patientId=<id>&symptoms=<comma list>[&severity=0-10]` → `{specialty, urgent, demo: true}`. Source patient-book logic: under-16 → Pediatrics; Low mood/Anxiety/Trouble sleeping → Psychiatry; Rash/Itching → Dermatology; Palpitations/High blood pressure reading → Cardiology; else General medicine. `urgent` when Chest pain or Shortness of breath is listed (or severity ≥ 8). Symptom names match exactly. Demonstration hint only, not medical advice. Patients: own beneficiary (`patientId` optional); admin grant: any patient; providers: `patientId` required.
- Additions: `GET /api/session`, `GET /api/audit` (doctor mode), `?durationMin=` on `/api/slots`.
- Static error strings emitted by the two top-level `.mjs` files are listed in `api-errors.json` for the API-copy gate.
