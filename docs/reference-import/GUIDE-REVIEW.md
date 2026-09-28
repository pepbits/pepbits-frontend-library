# Reference module guide audit

Audit of the 152 English reference-module page guides in the `2026-09-28-reference-modules` documentation release, cross-checked against the ported route/page components and API contracts and accompanied by local browser and API evidence. The page-by-page rows below document source coverage; they do not establish native-speaker translation approval or production acceptance.

Reviewed 28 September 2026 against `desktop-clients/packages/reference-{reports,erp1,erp2,school,keystone-core}/src`, `docs/reference-import/SOURCE-INVENTORY.json` and `desktop-clients/packages/reference-school/API-CONTRACT.md`, cross-referenced against the 152 page IDs in documentation release `2026-09-28-reference-modules`. The source inventory covers 341 original source files across the four imported modules; those source trees remain unchanged.

## Counts

| Module | Pages | Status after this review | Notes |
| --- | --- | ---: | --- |
| Lumen Reports (`reference-reports-*`) | 14 | authored | Numbered workflow steps and field metadata authored from `src/pages/pages.tsx` and its admin/builder/dashboards/jobs/schedules/emailin components; previously one generic sentence per section. |
| Keystone ERP1 (`reference-erp1-*`) | 57 | authored | Sections/fields were already generated from the 20 template families in `src/lib/registry.ts`; spot-checked profile, grid, document, voucher, settings and rate templates against `src/components/templates/*` and the original source registry (`PAY_TERMS`, `UOMS`, etc.) - verified accurate, corrected none. |
| Keystone ERP2 (`reference-erp2-*`) | 57 | authored | ERP2's `src/lib/registry.ts` defines the same semantic catalogue as ERP1 (57 pages across the same 20 template families and entities); the same page/template/field mapping applies to both. |
| Scholaris School (`reference-school-*`) | 24 | authored | Numbered workflow steps and field metadata authored from `src/pages/*.tsx` and `API-CONTRACT.md`; previously one generic sentence per section with empty `fields`. |
| **Total** | **152** | **authored** | 152 newly authored guides within 468 current guides. The original 28 historical releases and the prior registered-page and legacy-reference sets remain unchanged. |

## Corrections (this pass)

- `guidePageIds` previously totalled 467 against 468 actual `guides` entries because the inherited `dcp-designer` guide id had not been copied forward; it is now included, so `guidePageIds.length === Object.keys(guides).length === 468`.
- The ERP2 "byte-identical except comment" description above was corrected to describe the same semantic catalogue, since asserting byte-identity is a claim about the file contents rather than the page/template/field mapping this audit actually verifies.
- Nineteen guides (11 School role-authorization statements plus 8 absolute/overstated behavior claims) were corrected; see the School and Reports notes below. Translation baselines for exactly these 19 guides were reset to their new content hashes (`reviewer`/`reviewedAt`/`reviewEvidence`: `null`); the other 133 reference guides' baselines were left as previously set.

### School: real roles only

Scholaris' actual roles are `admin`, `teacher`, `student`, `parent`, `librarian`, `accountant` (see API-CONTRACT.md, `GET /session`). Guide text previously invented compound labels not in that set - "admin/office", "admin/HR", "admin/academic-office", "staff/admin" - implying separate granted roles that do not exist. These were corrected to name only the actual roles enforced by the server and reflected in the client's own role-conditional rendering (for example `reference-school-admissions`, `reference-school-calendar`, `reference-school-classes`, `reference-school-fees`, `reference-school-notices`, `reference-school-students`, `reference-school-students-new`, `reference-school-subjects`, `reference-school-teachers`, `reference-school-teachers-new`, `reference-school-timetable`, `reference-school-exams`). "Office" contacts (for example the principal or finance) remain valid as message recipients/labels in `reference-school-messages`; that wording was clarified to state they are contact labels, not a separate login role. The stray quoted UI fragment `" - last paid {date} via {method}"` in `reference-school-students` was replaced with a plain-language description of when the server shows that payment state.

### No overstated absolute guarantees

`reference-reports-schedules` no longer claims a schedule "never sends the same run twice" (an unqualified durability claim); it now describes server-side deduplication against the in-memory run record for this demo. `reference-school-library` no longer claims re-read stock "can never drift"; it now describes reloading the authoritative server value after each action. `reference-reports-admin-outbox` and `reference-reports-admin-settings` now state plainly that every mail action in this demo is synthetic and that an SMTP setting alone does not connect a real provider, rather than conditioning that fact on whether SMTP happens to be "configured". `reference-reports-builder` no longer asserts that custom-report data can never come from a live transactional database in any future production deployment; it states that this demo's dataset content is synthetic and a production adapter is expected to supply its own approved read-only source. `reference-school-fees` now states that an overpayment is rejected by the server (not silently capped) and that a zero amount is a no-op. `reference-school-settings` now states explicitly that its profile/password fields exercise this module's own demo settings adapter and do not reset the host application's login credentials.

## Translation baselines

`dummy-api/config/documentation/translation-revisions.json` -> `default["2026-09-28-reference-modules"]` contains current hashes for all 152 new guide IDs × {ar, hi, ml}, computed with the same `translationRevision`/`translate` helpers used by `docs/tools/documentation-lifecycle.mjs`. Draft translations are present in all 456 states: 455 report `translationStatus: "current"`; the Malayalam school-library entry reports `incomplete` because the standalone identifier `ISBN` is intentionally unchanged. All 456 have `reviewStatus: "pending"`, with `reviewer`, `reviewedAt` and `reviewEvidence` set to `null`; these are translated drafts, not native-reviewed guides. The [translation validation record](TRANSLATION-VALIDATION.json) documents language quality checks and retained identifiers. The three native-language CSVs contain the 2,417 newly added shared catalog keys with their current translations and `Pending` status; this UI-copy review inventory does not certify native guide approval. Historical release content and prior guide records are preserved.

## Page-by-page mapping

### Lumen Reports (14)

| Page ID | Route | Source page / component | API contract |
| --- | --- | --- | --- |
| `reference-reports-overview` | `/` | OverviewPage (src/pages/pages.tsx) -> GET overview loader | reference-reports adapter (`src/api/client.tsx`) |
| `reference-reports-reports` | `/reports` | LibraryPage + ReportPage/ReportViewer (src/pages/pages.tsx, src/reports/*) -> report/dataset endpoints | reference-reports adapter (`src/api/client.tsx`) |
| `reference-reports-admin-access` | `/admin/access` | AdminAccessPage + AccessControl (src/admin/AccessControl.tsx) -> admin-access endpoints | reference-reports adapter (`src/api/client.tsx`) |
| `reference-reports-admin-audit` | `/admin/audit` | AdminAuditPage (src/pages/pages.tsx) -> admin-audit endpoint | reference-reports adapter (`src/api/client.tsx`) |
| `reference-reports-admin-outbox` | `/admin/outbox` | AdminOutboxPage (src/pages/pages.tsx) -> admin-outbox endpoint | reference-reports adapter (`src/api/client.tsx`) |
| `reference-reports-admin-settings` | `/admin/settings` | AdminSettingsPage + SettingsForm (src/admin/SettingsForm.tsx) -> admin-settings endpoints | reference-reports adapter (`src/api/client.tsx`) |
| `reference-reports-admin-sources` | `/admin/sources` | AdminSourcesPage (src/pages/pages.tsx) -> admin-sources endpoint | reference-reports adapter (`src/api/client.tsx`) |
| `reference-reports-admin-users` | `/admin/users` | AdminUsersPage + UsersAdmin (src/admin/UsersAdmin.tsx) -> admin-users endpoints | reference-reports adapter (`src/api/client.tsx`) |
| `reference-reports-api-keys` | `/api-keys` | ApiKeysPage + ApiKeysPanel (src/admin/ApiKeysPanel.tsx) -> API-key endpoints | reference-reports adapter (`src/api/client.tsx`) |
| `reference-reports-builder` | `/builder` | BuilderListPage/BuilderEditPage + ReportBuilder (src/builder/ReportBuilder.tsx) -> builder/dataset endpoints | reference-reports adapter (`src/api/client.tsx`) |
| `reference-reports-dashboards` | `/dashboards` | DashboardsPage/DashboardPage + DashboardView (src/dashboards/DashboardView.tsx) -> dashboard endpoints | reference-reports adapter (`src/api/client.tsx`) |
| `reference-reports-email-in` | `/email-in` | EmailInPage + EmailInPanel (src/emailin/EmailInPanel.tsx) -> email-in endpoint | reference-reports adapter (`src/api/client.tsx`) |
| `reference-reports-jobs` | `/jobs` | JobsPage/JobPage + JobsTable/JobResults (src/jobs/Jobs.tsx) -> jobs endpoints | reference-reports adapter (`src/api/client.tsx`) |
| `reference-reports-schedules` | `/schedules` | SchedulesPage + SchedulesPanel (src/schedules/SchedulesPanel.tsx) -> schedule endpoints | reference-reports adapter (`src/api/client.tsx`) |

### Keystone ERP1 (57) and Keystone ERP2 (57)

ERP1 and ERP2 share one page registry (`src/lib/registry.ts`, identical between packages) rendered through 20 template components in `src/components/templates/*` (`@pepbits/reference-keystone-core` supplies the shared shell/record/list primitives). Each row below applies to both `reference-erp1-*` and `reference-erp2-*` with the same suffix.

| Page suffix | Template | Entity | Source registry entry |
| --- | --- | --- | --- |
| `dashboard` (Dashboard) | dashboard | dashboard | keystone-erp/src/lib/registry.ts → slug: dashboard |
| `approvals` (Approvals inbox) | inbox | approvals | keystone-erp/src/lib/registry.ts → slug: approvals |
| `countries` (Country master) | grid | countries | keystone-erp/src/lib/registry.ts → slug: countries |
| `states` (State master) | dependent | states | keystone-erp/src/lib/registry.ts → slug: states |
| `currencies` (Currency master) | grid | currencies | keystone-erp/src/lib/registry.ts → slug: currencies |
| `units` (Unit of measure) | grid | units | keystone-erp/src/lib/registry.ts → slug: units |
| `holidays` (Holiday calendar) | grid | holidays | keystone-erp/src/lib/registry.ts → slug: holidays |
| `org-structure` (Organisation structure) | tree | org-structure | keystone-erp/src/lib/registry.ts → slug: org-structure |
| `departments` (Department master) | grid | departments | keystone-erp/src/lib/registry.ts → slug: departments |
| `chart-of-accounts` (Chart of accounts) | tree | chart-of-accounts | keystone-erp/src/lib/registry.ts → slug: chart-of-accounts |
| `tax-rates` (Tax rates) | rate | tax-rates | keystone-erp/src/lib/registry.ts → slug: tax-rates |
| `customers` (Customer master) | profile | customers | keystone-erp/src/lib/registry.ts → slug: customers |
| `suppliers` (Supplier master) | profile | suppliers | keystone-erp/src/lib/registry.ts → slug: suppliers |
| `items` (Item master) | profile | items | keystone-erp/src/lib/registry.ts → slug: items |
| `product-categories` (Product categories) | tree | product-categories | keystone-erp/src/lib/registry.ts → slug: product-categories |
| `price-lists` (Price lists) | rate | price-lists | keystone-erp/src/lib/registry.ts → slug: price-lists |
| `bill-of-materials` (Bill of materials) | structure | bill-of-materials | keystone-erp/src/lib/registry.ts → slug: bill-of-materials |
| `employees` (Employee master) | profile | employees | keystone-erp/src/lib/registry.ts → slug: employees |
| `leave-types` (Leave types) | grid | leave-types | keystone-erp/src/lib/registry.ts → slug: leave-types |
| `shifts` (Shift master) | grid | shifts | keystone-erp/src/lib/registry.ts → slug: shifts |
| `salary-structures` (Salary structures) | structure | salary-structures | keystone-erp/src/lib/registry.ts → slug: salary-structures |
| `patients` (Patient master) | profile | patients | keystone-erp/src/lib/registry.ts → slug: patients |
| `doctors` (Doctor master) | profile | doctors | keystone-erp/src/lib/registry.ts → slug: doctors |
| `lab-tests` (Lab test master) | grid | lab-tests | keystone-erp/src/lib/registry.ts → slug: lab-tests |
| `consultation-fees` (Consultation fees) | rate | consultation-fees | keystone-erp/src/lib/registry.ts → slug: consultation-fees |
| `students` (Student master) | profile | students | keystone-erp/src/lib/registry.ts → slug: students |
| `fee-structures` (Fee structures) | structure | fee-structures | keystone-erp/src/lib/registry.ts → slug: fee-structures |
| `vehicles` (Vehicle master) | profile | vehicles | keystone-erp/src/lib/registry.ts → slug: vehicles |
| `sales-orders` (Sales orders) | document | sales-orders | keystone-erp/src/lib/registry.ts → slug: sales-orders |
| `sales-invoices` (Sales invoices) | document | sales-invoices | keystone-erp/src/lib/registry.ts → slug: sales-invoices |
| `purchase-orders` (Purchase orders) | document | purchase-orders | keystone-erp/src/lib/registry.ts → slug: purchase-orders |
| `goods-receipts` (Goods receipts) | document | goods-receipts | keystone-erp/src/lib/registry.ts → slug: goods-receipts |
| `journal-vouchers` (Journal vouchers) | voucher | journal-vouchers | keystone-erp/src/lib/registry.ts → slug: journal-vouchers |
| `payment-vouchers` (Payment vouchers) | voucher | payment-vouchers | keystone-erp/src/lib/registry.ts → slug: payment-vouchers |
| `petty-cash` (Petty cash vouchers) | voucher | petty-cash | keystone-erp/src/lib/registry.ts → slug: petty-cash |
| `leave-requests` (Leave requests) | request | leave-requests | keystone-erp/src/lib/registry.ts → slug: leave-requests |
| `expense-claims` (Expense claims) | request | expense-claims | keystone-erp/src/lib/registry.ts → slug: expense-claims |
| `attendance` (Attendance register) | matrix | attendance | keystone-erp/src/lib/registry.ts → slug: attendance |
| `timesheets` (Timesheets) | matrix | timesheets | keystone-erp/src/lib/registry.ts → slug: timesheets |
| `payroll-run` (Payroll run) | process | payroll-run | keystone-erp/src/lib/registry.ts → slug: payroll-run |
| `depreciation-run` (Depreciation run) | process | depreciation-run | keystone-erp/src/lib/registry.ts → slug: depreciation-run |
| `appointments` (Appointments) | booking | appointments | keystone-erp/src/lib/registry.ts → slug: appointments |
| `room-bookings` (Meeting rooms) | booking | room-bookings | keystone-erp/src/lib/registry.ts → slug: room-bookings |
| `quality-inspections` (Quality inspections) | checklist | quality-inspections | keystone-erp/src/lib/registry.ts → slug: quality-inspections |
| `support-tickets` (Support tickets) | case | support-tickets | keystone-erp/src/lib/registry.ts → slug: support-tickets |
| `maintenance-requests` (Maintenance requests) | case | maintenance-requests | keystone-erp/src/lib/registry.ts → slug: maintenance-requests |
| `marks-entry` (Marks entry) | matrix | marks-entry | keystone-erp/src/lib/registry.ts → slug: marks-entry |
| `sales-register` (Sales register) | report | sales-invoices | keystone-erp/src/lib/registry.ts → slug: sales-register |
| `purchase-register` (Purchase register) | report | purchase-orders | keystone-erp/src/lib/registry.ts → slug: purchase-register |
| `stock-summary` (Stock summary) | report | stock-summary | keystone-erp/src/lib/registry.ts → slug: stock-summary |
| `receivables-aging` (Receivables aging) | report | receivables-aging | keystone-erp/src/lib/registry.ts → slug: receivables-aging |
| `customer-ledger` (Customer ledger) | ledger | ledger-entries | keystone-erp/src/lib/registry.ts → slug: customer-ledger |
| `invoice-print` (Invoice print) | print | sales-invoices | keystone-erp/src/lib/registry.ts → slug: invoice-print |
| `company-settings` (Company settings) | settings | company-settings | keystone-erp/src/lib/registry.ts → slug: company-settings |
| `users` (Users) | grid | users | keystone-erp/src/lib/registry.ts → slug: users |
| `number-series` (Number series) | grid | number-series | keystone-erp/src/lib/registry.ts → slug: number-series |
| `notifications` (Notification settings) | settings | notification-settings | keystone-erp/src/lib/registry.ts → slug: notifications |

### Scholaris School (24)

| Page ID | Route | Source page / component | API contract (API-CONTRACT.md) |
| --- | --- | --- | --- |
| `reference-school-dashboard` | `/dashboard` | pages/dashboard.tsx (role dashboards in components/dashboards/*) -> GET /stats | reference-school API-CONTRACT.md |
| `reference-school-admissions` | `/admissions` | pages/admissions.tsx -> GET/POST/PATCH /admissions | reference-school API-CONTRACT.md |
| `reference-school-assignments` | `/assignments` | pages/assignments.tsx -> /assignments, /submissions | reference-school API-CONTRACT.md |
| `reference-school-attendance` | `/attendance` | pages/attendance.tsx -> /attendance, /leave-requests | reference-school API-CONTRACT.md |
| `reference-school-calendar` | `/calendar` | pages/calendar.tsx -> /events | reference-school API-CONTRACT.md |
| `reference-school-classes` | `/classes` | pages/classes.tsx -> /classes | reference-school API-CONTRACT.md |
| `reference-school-exams` | `/exams` | pages/exams.tsx -> exam schedule + /marks | reference-school API-CONTRACT.md |
| `reference-school-fees` | `/fees` | pages/fees.tsx -> /invoices, /invoices/reminders, /fee-structure | reference-school API-CONTRACT.md |
| `reference-school-library` | `/library` | pages/library.tsx -> /books, /issues, /reservations | reference-school API-CONTRACT.md |
| `reference-school-live` | `/live` | pages/live.tsx + pages/live-room.tsx -> /live, /live/{id}/room, /live/{id}/actions | reference-school API-CONTRACT.md |
| `reference-school-marks` | `/marks` | pages/marks.tsx + components/shared/report-card.tsx -> /marks, /report-card | reference-school API-CONTRACT.md |
| `reference-school-messages` | `/messages` | pages/messages.tsx -> /threads, /contacts, /attachments | reference-school API-CONTRACT.md |
| `reference-school-notices` | `/notices` | pages/notices.tsx -> /notices | reference-school API-CONTRACT.md |
| `reference-school-quizzes` | `/quizzes` | pages/quizzes.tsx + pages/quiz-player.tsx -> /quizzes, /quiz-attempts, /quizzes/{id}/grade | reference-school API-CONTRACT.md |
| `reference-school-quizzes-new` | `/quizzes/new` | pages/quiz-builder.tsx -> POST /quizzes, /question-bank | reference-school API-CONTRACT.md |
| `reference-school-reports` | `/reports` | pages/reports.tsx -> GET /stats (analytics derivations) | reference-school API-CONTRACT.md |
| `reference-school-settings` | `/settings` | pages/settings.tsx -> /settings, /settings/password, /settings/sessions/{id} | reference-school API-CONTRACT.md |
| `reference-school-students` | `/students` | pages/students.tsx -> GET/PATCH /students | reference-school API-CONTRACT.md |
| `reference-school-students-new` | `/students/new` | pages/student-registration.tsx -> POST /students | reference-school API-CONTRACT.md |
| `reference-school-subjects` | `/subjects` | pages/subjects.tsx -> /subjects | reference-school API-CONTRACT.md |
| `reference-school-teachers` | `/teachers` | pages/teachers.tsx -> GET/PATCH /teachers | reference-school API-CONTRACT.md |
| `reference-school-teachers-new` | `/teachers/new` | pages/teacher-registration.tsx -> POST /teachers, PATCH /classes/{id} | reference-school API-CONTRACT.md |
| `reference-school-timetable` | `/timetable` | pages/timetable.tsx -> GET/PATCH /timetable | reference-school API-CONTRACT.md |
| `reference-school-whiteboard` | `/whiteboard` | pages/whiteboard.tsx (components/whiteboard/whiteboard.tsx) -> live-room actions when shared | reference-school API-CONTRACT.md |

## Local verification and remaining review

The final candidate was exercised in local Chromium and against the isolated demo API. The archived [evidence index](../releases/unreleased/evidence/reference-modules-2026-09-28/README.md) links the route results, action records, visual comparisons and logs.

- The browser run passed 162 records with no recorded errors: all 152 static destinations, six dynamic report/ERP2/School destinations and four desktop header/navigation checks.
- Reports preview/save, dynamic navigation, API-key create/pull/revoke and non-owner recipient download checks passed. The partial ERP probe recorded customer create/edit steps in each variant and 63 successful API requests before later selectors timed out. Separate focused runs verified an ERP1 invoice (total 150), editor save/back-to-list, ERP2 record edit/cancel/middle-open cleanup, and an ERP2 invoice (total 200), print view and cleanup; both focused results report no errors. See the [ERP evidence](../releases/unreleased/evidence/reference-modules-2026-09-28/README.md). School passed four actual UI actions: exact 75-byte attachment round-trip, idempotent library return (6 → 7 → 7 copies), server quiz grading and a persisted live-room action/chat/end flow.
- Healthcare compatibility checks compared six existing pages. Text and measured geometry matched on all six and five screenshot pairs were byte-identical. The existing query screenshot differed only at 63 border pixels (0.009%). A pre-existing page-ID alias made record and 360 routes fall back to the query view in both the source baseline and first candidate. Explicit forward/reverse page-ID mappings fixed the integrated candidate; three real query/new-record/360 checks and eight focused component tests then passed without changing form UI or writing clinical data. See [healthcare evidence](../releases/unreleased/evidence/reference-modules-2026-09-28/healthcare/EVIDENCE.md).
- The archived full test evidence records 1,859 Vitest tests and 238 API tests passed, all package/client type checks passed, separate ERP and School suites passed (46 and 35 tests), and both app builds passed. Five existing browser regressions passed: OP Registration, Clinical Consultation, Clinic Billing, DCP host runtime and the Page Library's 14-ID run. The Page Library check covered order, examples, guides, search, all 14 open-page actions, four languages, direction, width and absence of page errors; see the [final log](../releases/unreleased/evidence/reference-modules-2026-09-28/logs/existing-page-library.log).
- The normal documentation lifecycle check passes all 468 current page registrations and translation revisions. `check-docs.mjs` passes the documentation tree. Strict lifecycle validation remains blocked by 1,572 explicit backlog entries: 168 inherited domain-workflow authoring items and 1,404 guide-translation review items. All 456 new guide-language drafts are present and their native review remains pending (455 helper-current; one unchanged `ISBN` identifier exception is helper-incomplete). No strict check was bypassed or recorded as passing.

All evidence is from a local candidate with fictional demo data. No production application backend, real email provider, native executable, package publication or live deployment is verified. Native-speaker review remains pending. All 152 new guides currently have empty tours; their source components do not yet expose tour anchors.
