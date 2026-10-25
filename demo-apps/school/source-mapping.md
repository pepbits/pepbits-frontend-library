# Scholaris source mapping

Phase 8 note: original-tree paths below describe the historical import source at the recorded base. That tree is now retired; current runtime uses this demo and public root packages.

Read-only source: `desktop-clients/packages/reference-school`, plus school metadata from `desktop-clients/packages/erp-config`. Base identity and hashes are in the [release evidence](../../docs/releases/unreleased/restructure-phase-6d-2026-10-24.md). Source files are copied/adapted; protected originals remain in place.

## Pages

Every route is registered through the public page renderer. All paths are app-root paths; `?role=` selects an already granted portal. There are 24 static pages and two dynamic record patterns.

| Destination | App route | School module file |
| --- | --- | --- |
| Dashboard | `/dashboard` | `pages/dashboard.tsx` |
| Reports & analytics | `/reports` | `pages/reports.tsx` |
| Students | `/students` | `pages/students.tsx` |
| Student registration | `/students/new` | `pages/student-registration.tsx` |
| Teachers | `/teachers` | `pages/teachers.tsx` |
| Teacher registration | `/teachers/new` | `pages/teacher-registration.tsx` |
| Admissions | `/admissions` | `pages/admissions.tsx` |
| Classes & sections | `/classes` | `pages/classes.tsx` |
| Subjects | `/subjects` | `pages/subjects.tsx` |
| Timetable | `/timetable` | `pages/timetable.tsx` |
| Attendance | `/attendance` | `pages/attendance.tsx` |
| Assignments | `/assignments` | `pages/assignments.tsx` |
| Quizzes | `/quizzes` | `pages/quizzes.tsx` |
| Quiz builder | `/quizzes/new` | `pages/quiz-builder.tsx` |
| Quiz | `/quizzes/:id` | `pages/quiz-player.tsx` |
| Examinations | `/exams` | `pages/exams.tsx` |
| Mark list & results | `/marks` | `pages/marks.tsx` |
| Live classes | `/live` | `pages/live.tsx` |
| Live classroom | `/live/:id` | `pages/live-room.tsx` |
| Whiteboard | `/whiteboard` | `pages/whiteboard.tsx` |
| Library | `/library` | `pages/library.tsx` |
| Fees & payments | `/fees` | `pages/fees.tsx` |
| School calendar | `/calendar` | `pages/calendar.tsx` |
| Notice board | `/notices` | `pages/notices.tsx` |
| Messages | `/messages` | `pages/messages.tsx` |
| Settings | `/settings` | `pages/settings.tsx` |

`dashboard.tsx` composes the admin, teacher, student/parent and librarian/accountant source dashboards. All six source role portals are retained. `/preferences` adds the shared shell preferences page; sign-in is supplied by ApplicationProviders. Root/layout/header/sidebar/role-chooser source wrappers are replaced by the shared host.

## Ownership and replacements

| Read-only source | Destination / treatment |
| --- | --- |
| reference-school pages, contracts, lookups, role/session/quiz/attachment logic, CSS | `src/modules/school`; existing HTTP contract and source workflows retained |
| reference-host scope, routing and presentation contract | School-owned `host.tsx` composition over public preferences, presentation and ResourceScope; no imported old package |
| school-role-views.ts and school portions of product/navigation/reference-modules | `src/modules/school/role-views.ts` and `src/navigation.ts`; one 26-page registry, six scoped memberships |
| data-table renderer | School sorting/search/export metadata over public CollectionView and Pagination |
| copied fetch hook | School envelope projection over public ResourceScope/useFetch |
| copied toast queue | ScreenHost notification adapter; test-only notification probe preserves assertions |
| admissions drag/drop renderer | Public WorkflowBoard with source stages, cards, actions and HTTP commands |
| calendar month renderer | Public Calendar with source event markers, filters, agenda, creation and export |
| chart renderers | Public LineChart/DonutChart/BarChart/HorizontalBars/ProgressRing, keyboard inspection and selected formatting |
| control option parser | Public optionsFromChildren; shared form controls retain source labels/values |
| operations/record overlays | Existing shared Modal, Drawer, CenterRecordCard and Card preview frames |
| print buttons | Public PrintDocument snapshot of the selected record or current school page; no physical-printer claim |
| source test support | Test-only fictional backend/fixtures; never reachable from runtime entry |
| school-role-views.test.ts | `src/navigation.test.ts`; five school catalog/grant assertions adapted to the independent 26-page catalog; unrelated ERP/report aggregate counts excluded |
| school-specific `MasterTransferPanel` / `PricingExpressionInput` usages | None in Scholaris or erp-config. Generic implementations already exported by `@pepbits/patterns/master-transfer`; the separate School product's integrations remain outside this source/API |

The shared `student-master` and `school-fees` Library template examples are not Scholaris pages and have no source-module calls to move. Their product-specific template instances remain in the protected original configuration and are not copied into the new library. Public page engines provide the generic rendering contracts; this app's Students and Fees use the actual Scholaris API. Porting those separate Library examples is deferred.

## Source tests and limits

All seven source files are retained: contracts, module, bundle-boundary, attachments-locale, toast-locale, library-return and final-parity. Providers/imports are adapted; test fixtures remain isolated, original test count is 100. The bundle test points to the private demo package and still checks all page imports, forbidden fixture reachability and the sole public entry. Module route parsing keeps its decoded-parameter contract; the app/HTTP boundaries additionally reject encoded separators and traversal.

Mounted drafts, retry behavior, scope reset, question/answer authority, receipt/fine authority, attachments and translations keep their source assertions. Tests using an explicit unsupported formatter locale retain that fixture-only formatter input; real hosted preferences are validated by PreferenceHost. Shared chart event selectors replace source DOM selectors while preserving translated label and number assertions.

The phase 6d-2 adapters restore source line/donut geometry and table header/result presentation on the public renderers. The [per-route handoff](parity-status.md) records the paired standalone source comparison and remaining differences; it is not a claim of full pixel identity. All 26 administrator destinations are present; restricted-role exceptions are listed below; exact source screenshots, exhaustive media, physical printing and institutional/human acceptance remain separate.

## Existing API restrictions

The unchanged API grants Librarian books/issues/message threads and Accountant invoices/message threads, plus shared metadata, profile, statistics and settings. Their academic lookups are skipped. Librarian Students/Calendar/Notices and Accountant Students/Notices are therefore withheld; those pages remain available to authorized academic roles. Librarian issue creation offers borrowers already present in allowed circulation records; unrestricted new-borrower lookup is deferred. Accountant invoice class labels and class filtering remain unavailable because its class lookup is not granted. These are explicit source workflow parity limits, not backend changes.
