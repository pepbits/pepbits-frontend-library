# @pepbits/reference-school

This package ports the Scholaris school reference (`reference/frontend/school/scholaris`, read-only) into the shared frontend library as a module rendered inside a host shell. It includes all 26 authenticated pages, the six role dashboards and their domain features.

It renders **no** application shell, sidebar, header, sign-in or role chooser, and uses no iframe, HTML injection, Next.js app or API routes. Identity, navigation, preferences and requests come from the host through `@pepbits/reference-host`.

Status: implementation plus focused local checks (see "Verification"). It has not been deployed, and it has not been tested against the production backend or in a browser end to end.

## Use

```tsx
import { ReferenceSchoolModule, SCHOOL_ROUTES } from "@pepbits/reference-school";
<ReferenceSchoolModule path="/quizzes/qz-3" host={host} />
```

- **`host`** (`ReferenceHost`) provides `scope {tenantId, applicationId, branchId, userId, roles}`, effective `preferences`, optional `preferenceHost {preferencePolicy, preferencesAvailable, onPreferenceChange}`, `request(path, init)` and `navigate(path)`.
- **`path`** is module-internal. `"/"` resolves to the dashboard. An optional `?role=` hint selects one of the portals the scope already grants.
- **Styles:** `src/school.module.css` is a CSS module imported by the module, and every rule is scoped under its root. The host Tailwind build must scan this package (`@source ".../packages/reference-school/src"`). The package never imports Tailwind.
- **Stable client:** the API client is keyed by scope only. A host re-render with a new `request` function or new preferences does not reload the session or pages, so open records and drafts survive.
- **Remounting:** the module keys itself by `referenceScopeKey(host.scope)`. A tenant, application, branch, user or role change discards all pages, session, lookups, drafts and toasts, even if the consumer does not key the module. Pages are also keyed by route and parameters, so `/quizzes/a` → `/quizzes/b` and `/live/a` → `/live/b` never carry answers, results, timers or camera streams across.
- **Data:** the backend owns all production and demo data. The package exports only `.` and ships no fixture data. Fictional fixtures under `src/test-support/fixtures` exist only for this package's unit tests; `bundle-boundary.test.ts` checks that the public entry cannot reach them.

## Pages and source map

`SCHOOL_ROUTES` (`src/routes.ts`) lists each route with its source file. `matchSchoolRoute` prefers static segments, so `/quizzes/new` is the builder. Dynamic parameters are URI-decoded and reach pages through `useParams()`.

| Route | Source `src/app/(app)/…` | Module file |
| --- | --- | --- |
| /dashboard | dashboard/page.tsx (+ components/dashboards/admin, teacher, student, staff) | pages/dashboard.tsx |
| /reports | reports/page.tsx | pages/reports.tsx |
| /students, /students/new | students/page.tsx, students/new/page.tsx | pages/students.tsx, pages/student-registration.tsx |
| /teachers, /teachers/new | teachers/page.tsx, teachers/new/page.tsx | pages/teachers.tsx, pages/teacher-registration.tsx |
| /admissions | admissions/page.tsx | pages/admissions.tsx |
| /classes, /subjects, /timetable | classes, subjects, timetable page.tsx | pages/classes.tsx, subjects.tsx, timetable.tsx |
| /attendance | attendance/page.tsx (+ shared/attendance-calendar) | pages/attendance.tsx |
| /assignments | assignments/page.tsx | pages/assignments.tsx |
| /quizzes, /quizzes/new, /quizzes/:id | quizzes/page.tsx, quizzes/new, quizzes/[id] | pages/quizzes.tsx, quiz-builder.tsx, quiz-player.tsx |
| /exams, /marks | exams/page.tsx, marks/page.tsx (+ shared/report-card) | pages/exams.tsx, pages/marks.tsx |
| /live, /live/:id | live/page.tsx, live/[id]/page.tsx | pages/live.tsx, pages/live-room.tsx |
| /whiteboard | whiteboard/page.tsx (+ components/whiteboard) | pages/whiteboard.tsx |
| /library, /fees, /calendar, /notices, /messages, /settings | matching page.tsx | pages/<name>.tsx |

The source root `app/page.tsx` (a demo role chooser) and the layout pieces (`app-shell`, `header`, `sidebar`, `command-palette`, `popover`, `logo`) are intentionally not ported: the host owns them. `SCHOOL_ROLE_NAVIGATION` exposes the source's per-role menu for the host sidebar.

## Identity and permissions

- **Portal:** comes only from `host.scope.roles`. Accepted forms are `admin`, `teacher`, `student`, `parent`, `librarian`, `accountant`, `school:<role>`, `school-<role>`, and the aliases `enterprise-admin` → admin, `finance-manager` → accountant and `operations-analyst` → teacher. Unknown roles map to nothing. With no school role, the module shows "Access not permitted" and never calls `/session`.
- **Identity:** `GET /session?role=` returns the school identity and a parent's children. A response whose role differs from the trusted role is rejected.
- **Client-side checks are presentation only.** The source's "not part of your portal" page check is kept, but the server must authorize every read and write (API-CONTRACT.md).

## Server boundary (no mock data in the client)

All data and all simulated activity live behind `host.request("/api" + path)` (API-CONTRACT.md). The main bundle contains no seed, question bank, demo users, canned replies, random participant pools or tariff tables; `bundle-boundary.test.ts` checks this. In particular:

- **Quizzes:** students load questions without answer keys (`/quizzes/:id/questions`), and the server grades them (`POST /quizzes/:id/grade`). A staff preview is graded as `preview: true` and is not stored. The review (answer key and explanations) arrives only with the result.
- **Live room:** participants, chat, polls, votes, scores and recording state are server state, polled every 2 s and changed through `POST /live/:id/actions`. Local camera, microphone and screen use the browser's real media, shown only locally. **No audio or video is sent anywhere.** The room is a server-driven prototype, not real-time conferencing.
- **Messages:** the displayed thread is the server's reply to `PATCH /threads/:id`. Any automatic reply is the backend's.
- **Question bank, school profile, fee tariff, office contacts** come from `/question-bank`, `/school-profile`, `/fee-structure` and `/contacts`.
- **Attachments:** the source's fake attach buttons are now the shared ops-ui `FilePicker`, backed by `/attachments` (API-CONTRACT.md "Attachments"):
  - the assignment creation dialog
  - the student "Turn in" dialog
  - the chat composer

  Saved attachments appear with download buttons on the teacher's assignment view, each submission in grading, the student's assignment cards and chat bubbles. Each file is at most 1 MB; failed uploads keep the file and offer Retry upload; nothing commits until every file is uploaded or removed.
- **Settings:** `/settings*` holds the profile, notifications, password, two-step verification and sessions. Presentation settings are not stored there.

## Preferences

- **Theme and colours:** source colour names (brand, line, muted, ok, warn, bad…) alias the host's theme tokens, including the fill/ink contrast tokens and dark themes. The source's per-portal accent is kept as `--school-role-accent` and `data-role`.
- **Corner radius:** `rounded*` classes scale with `--radius`.
- **Font family:** the module root sets `--font-ui` from `fontFamily`.
- **Font scales:** text utilities use `--fs-scale`. The shell scale applies at the root, bridged form controls and field groups use `--fs-form`, and ops-ui tables use `--fs-result`.
- **Record previews:** the student, teacher, class, invoice and assignment-grading views follow `previewMode`:
  - `inline` — a shared Card in the page with close and footer
  - `center-card` — CenterRecordCard
  - `center-modal` — Modal
  - `left-drawer` / `right-drawer` — Drawer side

  A preference or policy change while a preview is open changes only the frame; the record and unsaved drafts are kept. Operation dialogs (create, pay, confirm) remain modals.
- **Numbers:** KPI and summary percentages and counts are formatted with the host number locale (`fmtNum`/`fmtPct`) before they are assembled into text. Request payloads keep plain numbers.
- **Library loans:** returning a book shows the fine from the server's returned record (the live overdue estimate is only shown before return). After a return or an issue the page re-reads `GET /books`; it never increments or decrements stock locally.
- **Creation payloads:** new books, classes, quizzes and assignments send only authored fields. The server initializes available/rating/cover, strength/average, attempts/average and submitted/graded/total, and the page shows the returned record.
- **Tables:** tables are ops-ui `Table`s (the source `dense` flag is ignored so host density wins; plain numeric cells, record counts, chart values and KPI numbers use the host number format) under the host `PresentationProvider`: density, striping, wrapping and sticky headers. DataTable page size follows `pageSize` and changes only through `preferenceHost` when it is available and not locked. Dashboard widgets with fewer than 10 rows keep their fixed size.
- **Localization:** source strings are wrapped by the parent localization pass (`LocalizedText`, shown as `ReferenceText`, and `useLocalization().t` inside components). The translation catalogs are owned by the root.
  - Select options keep their source English label and value; the shared Select translates labels once and never touches values.
  - DataTable string headers, and CSV header labels, are localized.
  - Chart labels, series, legends and tooltips go through `t`.
- **Toasts:** messages are rendered through `LocalizedText`, so static source messages translate at render and follow a language change while shown. Dynamic messages are whole-message `referenceT("…{value0}…", {value0})` calls; enum words, plural forms and conditional suffixes become separate complete messages, not spliced fragments. Authored names and titles, formatted amounts and dates, and server error text are placeholder values kept verbatim. An unknown server error renders exactly as received. Named-placeholder catalog entries are collected by the root.
- **Dates, times, numbers and money:** formatted through `createFormatters` and the language locale (`useFormat`). Native date/time inputs keep machine values.
- **Export:** only CSV is written. It is enabled only when the effective `exportFormat` is CSV and policy allows it. Otherwise the button is disabled with the reason; the module never silently writes CSV for an XLSX preference. Text cells are protected against formula injection.
- **Whiteboard PNG:** "Download PNG" saves the author's own raster drawing. It is not tabular data, so the CSV/XLSX `exportFormat` preference and its policy do not apply. Canvas text uses the host's selected font (the canvas's computed family). Stroke widths and text sizes are author-chosen drawing geometry and do not follow the UI font scales.
- **Shortcuts:** quiz answer keys and whiteboard tool keys attach only while `keyboardShortcuts` is on.
- **Reduced motion:** follows the preference and the operating-system setting.
- **Toasts:** position, duration, style and maximum count follow the host preferences.
- **Settings → Preferences:** theme, density, reduced motion and shortcuts go only through `preferenceHost.onPreferenceChange`. Locked or unavailable settings are disabled, and their handlers refuse changes.

## Shared components and documented exceptions

The KPI tiles are the shared `StatCard`, restyled by scoped `.school-kpi` rules to the source's compact layout (tinted icon on the left, small label, value, sub-line, inline trend); numeric values use the host number format. Avatars are the shared `Avatar` inside a wrapper sized to the source's exact pixel size (for example 88 px in the live lobby).

Page code keeps the source call-site API through `src/ui`, which renders the ops-ui components: Button, Card/CardHeader/CardGrid, Badge, Avatar, StatCard, Input/DateInput/TimeInput/Select/Textarea through FieldShell, Tabs, Segmented, Toggle, Checkbox, SearchInput, Modal/Drawer/ConfirmDialog, Table/TableContainer, Pagination, EmptyState/ErrorState/LoadingState/AccessDenied/NotFoundState and Skeleton. `verify:shared-components` and `verify:form-controls` pass for this package.

Specialized markup is kept where no shared primitive expresses the behaviour:
- charts (bar, line, donut, ring, hbars)
- the calendar month agenda
- the admissions kanban
- the attendance register rows (with a shared Segmented per student)
- the marks spreadsheet grid (shared `Input` cells inside a managed `Table`)
- the whiteboard canvas and its native colour picker (the text overlay is a shared `Textarea`)
- the dark live-room chrome (the chat composer is a shared `Input`)
- the quiz answer tiles and palette
- Progress

## Failure behaviour

- API errors reach the user verbatim, as a toast or through ErrorState with retry.
- Create and edit dialogs stay open and keep their values when a request fails.
- If the first lookup load fails, the module shows retry. A failed reload keeps the loaded pages.
- A failed grade keeps the answers and offers Retry grade.
- A failed message send keeps the draft.
- If the room cannot be read, the error is shown with no substitute data.
- Failed room actions report the error, and leave or end does not navigate away when it fails.
- Payment failure returns to the form.
- A rejected collection keeps its dialog and the entered amount.
- A successful payment shows the server's `receiptNo`, and says the receipt was emailed only when `receiptSent` is true.
- Dashboard trends appear only when `/stats` returns `trends`.

## Verification (local, this working tree)

Run from `desktop-clients/` (Node 24):

- `node node_modules/typescript/bin/tsc -p packages/reference-school/tsconfig.json --noEmit`
- `node node_modules/vitest/vitest.mjs run packages/reference-school/src --reporter=dot`
- `node packages/reference-school/scripts/generate-token-css.mjs --check`
- `node scripts/verify-shared-components.mjs`
- `node scripts/verify-form-controls.mjs`

Last local result (2026-09-28, uncommitted working tree on branch `task/reference-modules-20260928`, base `a9703f1`, after the root's expanded presentation converter, the toast localization fix and the library return fix):
- tsc exit 0
- vitest: 7 files, 100 tests passed
- token CSS check: up to date, 101 scoped rules
- `verify-shared-components` PASS
- `verify-form-controls` exit 0
- `scripts/localization/check-copy.mjs`: exits 1 repository-wide. For this package it reports 340 `missing copy` (wrapped English messages that the root catalogs have not added yet), 0 `raw JSX copy` and 0 "translate the whole presentation template".
  - A package scan finds no unwrapped JSX text.
  - The 36 remaining plain string props go to shared components that translate them (StatCard hint, CardTitle, EmptyState, Modal and Tabs labels).
  - Messages added through `referenceT(...)` in expressions are not seen by the gate and also need catalog keys.

The implementation was done in Claude Code session `c483bd17-1188-4d3c-b7a6-7fc75c4a06f1`. Logs are in `/tmp/scholaris-claude-implementation-{1,2,3,4,5,6,7,8}.jsonl` (7 is the toast localization pass, 8 the library return fix):
- The first run timed out after generating the token CSS, before tests existed.
- Later runs added the server boundary, gates, tests, attachments, the localization-bridge fixes and the final numeric/creation-payload cleanup.

The tests use a test-only fictional host (`src/test-support/fake-host.test-support.ts`) implementing the contract in memory. Mocked tests do not establish that the real backend behaves correctly.

Not run:
- host application builds (including CSS-module and Tailwind `@source` compilation in the host)
- browser journeys
- the demo backend
- visual comparison with the source
- Arabic, Hindi or Malayalam layout review

Known gaps:
- The compact KPI layout and exact avatar sizes are CSS over the current ops-ui StatCard/Avatar DOM. An ops-ui markup change needs these rules rechecked.
- Visual parity with the source has not been compared in a browser.
- The whiteboard and live room depend on browser canvas and media APIs that were stubbed in jsdom.
- The source's Tailwind radius, spacing and shadow values are approximated through host tokens.
- The attachment endpoints, their 1 MB limit and their scope/owner checks are verified here only against the test fake host.
- Translated strings depend on the root catalogs: 340 wrapped School messages are still missing there per `check-copy`, plus `referenceT` expression messages the gate does not scan. No native-speaker or RTL layout review has been done.
- The fees card form is a reference presentation: card details are not sent, the payment is recorded through `PATCH /invoices`, and the source's "demo" disclaimers remain on screen.

## Files

- `src/index.ts` — public API.
- `src/module.tsx` — root and routing.
- `src/routes.ts` — route table.
- `src/pages/*` — the 26 pages.
- `src/components/*` — dashboards, shared widgets and the whiteboard.
- `src/ui/*` — the ops-ui bridge and charts.
- `src/lib/*` — API, session, lookups, formatting, preferences, quiz hooks, types and contract.
- `src/school.module.css` — scoped styles; its generated section is produced by `scripts/generate-token-css.mjs`.
- `src/test-support/*` — the fake host and fictional fixtures used only by the unit tests.
- `API-CONTRACT.md` — the server contract.
