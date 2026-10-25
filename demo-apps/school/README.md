# Scholaris school demo

Private `@pepbits-demo/school`, using Next.js 16.3.3, React 19.2 and Tailwind 4.1. All **26 authenticated Scholaris pages** and six role portals run in the public shared shell. Data comes from the unchanged demo HTTP API. All identities and records are fictional; academic, assessment and financial behavior is a demonstration, **not institutional acceptance**. This is a local app build/run, not a deployment.

## Run locally

From the repository root:

```sh
npm install
# Start the existing API with its documented Node 24/runtime environment.
node mock-api/server.mjs
NEXT_PUBLIC_API_URL=http://localhost:3330 npm run dev -w @pepbits-demo/school
```

Use the API's actual port and origin configuration from the [API guide](../../mock-api/README.md). School dev/start use **3340**. Credentials remain in the existing API fixtures; do not retain them in evidence. The optional same-origin proxy uses an ignored app `.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=/api
SCHOOL_API_URL=http://127.0.0.1:3330
```

`NEXT_PUBLIC_API_URL` is build-time configuration. `SCHOOL_API_URL` is server-only; page components receive an authenticated request function. No component owns an origin, token store or business-data fallback.

```sh
NEXT_PUBLIC_API_URL=/api npm run build -w @pepbits-demo/school
npm run typecheck -w @pepbits-demo/school
npm test -w @pepbits-demo/school
npm run start -w @pepbits-demo/school
npm run test:integration -w @pepbits-demo/school
```

Build before integration. The shared launcher starts one API, one production Next server and Chromium on free loopback ports with isolated temporary storage. It cleans up on completion, failure, cancellation or deadline. Set `SCHOOL_API_NODE` to a Node 24 executable. `SCHOOL_RUNTIME_ARTIFACTS` may identify an existing source-identical API checkout when generated runtimes are unavailable: tracked API sources are compared and reused runtime hashes are recorded. This is artifact reuse, not an API rebuild. Chromium on this machine needs `LD_LIBRARY_PATH=$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu`.

Optional receipt paths: `SCHOOL_RESULT`, `SCHOOL_IDENTITY`, `SCHOOL_SCREENSHOT`. `SCHOOL_STOP_FILE` and `SCHOOL_TIMEOUT_MS` control cancellation/deadline; `SCHOOL_BUILD_DIR` selects Next output. Keep at most one Next server, one API and one Vitest tree for this run. The [release record](../../docs/releases/unreleased/restructure-phase-6d-2026-10-24.md) retains exact evidence.

## Structure, navigation and roles

`src/app` owns Next routing and the optional proxy. Its persistent root layout keeps the host mounted between routes. `src/navigation.ts` supplies 26 page definitions, six portal views and `/preferences`; `src/renderer.tsx` registers Scholaris and preferences with the public page-renderer registry. `src/adapters` maps calls to `/reference-modules/school/api/...`. `src/modules/school` owns school definitions, domain pages, widgets and API projections. [Source mapping](source-mapping.md) lists every route and source adaptation.

The six portals are Administrator, Teacher, Student, Parent, Librarian and Accountant. Portal choices are the union of the account's recognized school role and its explicit server-issued `referenceSchoolViews`. An administrator role alone does not grant all six. The existing enterprise fixture explicitly grants them. `?role=` selects only among those grants; otherwise the first granted role is used. Unknown accounts have no school data access. The API independently validates `X-Reference-Module`, account, branch, record and operation. Client checks only control presentation.

`/` and `/login` retain the accepted default portal when granted. `/dashboard?role=teacher`, `/students`, `/quizzes/new`, `/quizzes/:id` and `/live/:id` are direct links; unknown or malformed app paths show not-found. Role/module scope changes remount school state. Dynamic record changes remount quizzes and live rooms so answers, timers and local media cannot leak between records. AI is off.

## Preferences and data behavior

The public ApplicationProviders chain is SessionProvider → PreferenceHost → runtime LocalizationProvider → ShellProvider/EnterpriseShell. Preferences and tenant policy have one serialized update path, accepted revisions, availability, locks and focus/policy refresh. Catalogs come from the canonical API; no translated fallback catalog is copied or edited. Arabic automation does not establish native-speaker review.

Effective theme, fonts, independent scales, radius, table density/striping/wrapping/sticky headers/page size, date/time/number/currency formatting, preview, keyboard shortcuts, motion and notification settings apply. Source native date values and whiteboard drawing dimensions retain their machine/domain meaning. Settings → Preferences forwards to the same host update path. CSV exports honor effective export format and policy; an XLSX preference disables these source CSV-only actions with an explanation. School does not silently substitute CSV.

Tables configure CollectionView, admissions configures WorkflowBoard, Calendar composes the shared Gregorian calendar with school event markers, and all line/donut/bar/ring indicators use public chart renderers. Source controls compose shared fields/buttons/tabs/overlays, with the public option metadata helper. ResourceScope/useFetch own scoped fetching and stale-response cancellation. Notifications use ScreenHost. PrintDocument isolates the selected record or current school page at print time and clears the snapshot afterwards. Calendar marker labels include their visible event text. Specialized quiz answer tiles, attendance register, marks cells, timetable, whiteboard/media canvas remain school composition; their domain geometry is independent of table page size.

The API owns quiz questions, grading/review, attempt persistence, school identity/lookups, attachments, book stock/fines, invoice receipts and live-room state. Staff quiz previews are not student attempts. Attachments are limited to 1 MB and retain failed uploads for retry. Failed edits, messages, grades and collections retain mounted input. Scope/route changes discard that mounted state; it is **not durable draft recovery**. Live-room camera/microphone/screen previews stay local; no conferencing media is transmitted. Payments and automatic messages are synthetic.

## Completion boundary

All 26 route patterns and six dashboards are implemented; some source role-menu destinations are withheld to match actual API grants. The original seven test files retain 100 cases; chart event selectors are adapted to the shared accessible renderer while keeping localization/value assertions. School-specific configuration cases are ported separately. Four-profile route/axe cases, host/transport tests and real local HTTP workflows have distinct counts in the record. The mocked jsdom matrix excludes color contrast; real Chromium audits run axe without rule exclusions.

Shared engines intentionally change some source chart/table/board/calendar geometry. Exact source pixel comparison, exhaustive media/canvas interaction, physical printing, native executables, production identity/provider integration and human language/accessibility/domain review are not claimed. The separate School product's master-transfer/pricing integrations are not part of the Scholaris source or its unchanged API; their generic public exports already live in patterns. No replacement backend contract is invented. Original desktop/API/deployment/ERP files remain untouched; no commit or push.

## Existing API restrictions

The unchanged API grants Librarian books/issues/message threads and Accountant invoices/message threads, plus shared metadata, profile, statistics and settings. Their academic lookups are skipped. Librarian Students/Calendar/Notices and Accountant Students/Notices are therefore withheld; those pages remain available to authorized academic roles. Librarian issue creation offers borrowers already present in allowed circulation records; unrestricted new-borrower lookup is deferred. Accountant invoice class labels and class filtering remain unavailable because its class lookup is not granted. These are explicit source workflow parity limits, not backend changes.

## Phase 6d-2 source comparison

The [per-route parity handoff](parity-status.md) distinguishes measured source content, changed adapters and remaining work. Compact shared charts now keep source plot heights, bounds, area fills, donut diameters/strokes, centre captions and segment colours. Keyboard inspection remains available; the native line selector is revealed on focus. Tables keep source header metadata, result typography, separators, hover/selection and sort direction while the shared Table retains effective density, wrapping, stripes and sticky headers.

The phase 6 source-comparison result is retained in release evidence. Its original-source generator was retired in phase 8; current app integration checks continue to cover demo geometry, profiles and accessibility. Original-source pixel parity is not re-established by these checks.

Run every build, CI, API/server/browser or integration session through `flock /home/pepadmin/.cache/pepbits-heavy.lock`; keep unit workers at two or fewer. The [6d-2 record](../../docs/releases/unreleased/restructure-phase-6d-2-2026-10-24.md) records exact current counts and limits. No new dependencies or installation are needed for this increment.

Calendar days with more than three events now show the source `+N more` count and retain complete event titles; select that day to read every event in its agenda. This closes a frontend composition gap without changing the API.

Phase 8 retires the original-source visual comparison generators. Their source hashes, screenshots and destination ledgers remain immutable in the phase 6 release evidence. Current integration suites retain their demo geometry and axe checks; this is not a new original-source pixel comparison.
