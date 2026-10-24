# Feature: independent Scholaris school demo

Feature ID: SCD. State: implemented, locally verified subset with the parity limits below. Affected application: private `@pepbits-demo/school`, 26 authenticated pages, six portals and preferences. [Initial release](../releases/unreleased/restructure-phase-6d-2026-10-24.md), [visual increment](../releases/unreleased/restructure-phase-6d-2-2026-10-24.md), [testing guide 1.0.0](../testing/v1.0.0/PRE-COMMIT.md).

## User problem and outcome

Scholaris now runs as its own Next.js app using public library packages, without loading another demo or the original desktop shell. Administrator, teacher, student, parent, librarian and accountant portals keep their school data and workflows. Fictional academic/assessment behavior is not institutional acceptance.

## User and administrator flows

1. Configure the API and start the app as described in the [app guide](../../demo-apps/school/README.md). Sign in with a local fixture account. The shared shell loads accepted preferences, policy and canonical localization before showing authenticated content.
2. Choose an available School portal in the header. Navigation and dashboard follow that selection. A direct `?role=` hint can select only a portal granted by the session; an edited URL/header does not create authority.
3. Administrators manage people, admissions, academics, learning and operations. Teachers take attendance, author assessments and grade work. Students submit work and quizzes; parents select linked children. Librarians manage circulation; accountants collect fictional fees.
4. Open a record from a list. Effective preview mode controls its frame. Recoverable save/upload/grade failures keep entered values and expose retry/error feedback. Values retained in a mounted editor are not durable cross-route drafts.
5. Open `/preferences` or School Settings → Preferences. Managed/unavailable values are disabled and handlers refuse changes; accepted policy changes replace conflicting presentation. The shared host persists preferences through one update path.

## Technical contract and integration

[Source mapping](../../demo-apps/school/source-mapping.md) lists all routes and source files. The app uses SessionProvider → PreferenceHost → LocalizationProvider → ShellProvider/EnterpriseShell through `@pepbits/shell/application-providers`. `@pepbits/platform/http` owns configured authenticated requests; the shared host uses `@pepbits/platform/preference-service`. The school adapter namespaces relative paths under `/reference-modules/school/api` and supplies portal/branch metadata. The unchanged backend derives actual authority from the authenticated account.

The page-renderer registry selects school pages and shared preferences. Domain state and API projections remain school-owned. CollectionView, WorkflowBoard, Calendar, charts, fields, overlays and ScreenHost provide shared rendering and notification behavior. ResourceScope/useFetch own scoped caches, cancellation and late-response fences. No demo API URL or fixture business records are embedded in runtime components.

```tsx
import {ApplicationProviders} from '@pepbits/shell/application-providers';
// The application supplies its verified account-to-catalog resolver and router.
<ApplicationProviders apiBaseUrl={configuredApi} productId={applicationId}
  brand={brand} productForRole={catalogForAccount} navigation={navigation}>
  {registeredPage}
</ApplicationProviders>;
```

The additional resolver account argument allows host-defined grants without adding product roles to the library. Explicit module page membership includes non-menu details without duplicating page definitions. Neither contract grants server access.

## Compatibility, localization and accessibility

Original consumers/backend files are unchanged. No data migration is required. School catalogs remain backend-owned and load at runtime; no backend catalog is modified. Source labels, machine values and enum IDs are retained. Effective fonts/scales, tokens/radius, table presentation, page size, formatting, preview, notifications, shortcuts and reduced motion apply. Native date/time fields retain standardized values; whiteboard drawing geometry remains authored content. CSV-only export is disabled when incompatible with effective format/policy.

Shared engines provide keyboard-operable tables/board/calendar/chart controls. Specialized attendance, marks, quiz, timetable and media/canvas layouts retain source composition. Shared engine geometry can differ from original screenshots. The mocked jsdom route matrix excludes color contrast; the separate real Chromium route audits run axe without rule exclusions. Arabic RTL automation and axe checks do not establish native-speaker, assistive-technology or institutional review.

## Acceptance, completed and pending work

| Case | Contract |
| --- | --- |
| SCD-01 | Sign-in, accepted preferences/policy and runtime catalog precede the school shell |
| SCD-02 | All six dashboards and only granted role views; header, direct links and refresh |
| SCD-03 | All 26 routes plus preferences under default, Arabic RTL, reduced-motion and locked preferences; axe without violations |
| SCD-04 | Student/teacher records, registration, admissions and scope-local lookup behavior |
| SCD-05 | Quiz creation, server preview/grade, persisted student attempts and restrictions |
| SCD-06 | Assignment attachments, failed upload retry, grading and retained input |
| SCD-07 | Parent child scoping, library canonical stock/fines and fee receipts |
| SCD-08 | Configured real HTTP workflows, rejected role claims and isolated process cleanup |
| SCD-09 | Authored chart dimensions, bounds, fills and palette; finite geometry and keyboard inspection under default, Arabic RTL, reduced motion and independent result scale |
| SCD-10 | Source table headers and three-state sorting preserve locked density and page size |
| SCD-11 | Calendar overflow counts retain full titles and the complete selected-day agenda |
| SCD-12 | Paired source-content measurements cover 26 routes and six dashboards in four profiles; remaining differences and unvisited states are recorded per route |

All original 100 cases and five school catalog tests are ported with provider/renderer adaptations. Added host, adapter, route/profile/axe and real HTTP checks are reported separately in the release record. All 26 administrator routes are present; restricted-role exceptions are listed below. Exact pixel parity, exhaustive canvas/media interaction, physical printing, native execution, production services and human/domain acceptance remain outside the automated evidence.

## Operations and support

Missing API configuration produces an actionable message. Authentication failure stays on sign-in. Failed preferences/catalog bootstrap offers retry; rejected preference saves retain the accepted snapshot until reload. School failures preserve supported input and display the actual service error. Quiz grading and loan fines/stock use authoritative responses. Live-room media remains local; payments and automatic messages are synthetic. Stop the demo's own processes after checks. Rollback removes this opt-in app without changing protected applications or stored backend schemas. No publication/deployment is implied.

## Existing API restrictions

The unchanged API grants Librarian books/issues/message threads and Accountant invoices/message threads, plus shared metadata, profile, statistics and settings. Their academic lookups are skipped. Librarian Students/Calendar/Notices and Accountant Students/Notices are therefore withheld; those pages remain available to authorized academic roles. Librarian issue creation offers borrowers already present in allowed circulation records; unrestricted new-borrower lookup is deferred. Accountant invoice class labels and class filtering remain unavailable because its class lookup is not granted. These are explicit source workflow parity limits, not backend changes.

## Phase 6d-2 visual parity increment

The [route handoff](../../demo-apps/school/parity-status.md) and [6d-2 record](../releases/unreleased/restructure-phase-6d-2-2026-10-24.md) supersede the initial visual deferral for the measured subset. Dashboard/report line plots keep authored height, bounds and area fill. Donuts keep diameter, stroke, centre caption and semantic/source segment colours. Tab to a line chart to reveal its native inspection selector; choose a date with the keyboard to read localized values. Legend buttons inspect donut values. Effective result scale, theme and number formatting remain authoritative.

School tables keep source heading metadata, result typography, row separators/hover/selection and ascending/descending/unsorted indicators through CollectionView. Managed density, striping, wrapping, sticky headers and page-size policy still come from the shared presentation host. No API contract, record command, durable draft service or source role grant changes. Existing retry behavior remains.

Verification distinguishes the read-only source fixture comparison from real-HTTP browser workflows. Source content is rendered at the same width and frozen fixture clock; computed element comparisons do not certify full-page pixels, shell chrome, all dialogs or printed geometry. The route handoff lists those remaining states explicitly. API-imposed Librarian/Accountant collections, unrestricted new-borrower lookup, accountant class labels/filtering and durable drafts remain deferred.

Calendar days with more than three events now show the source `+N more` count and retain complete event titles; select that day to read every event in its agenda. This closes a frontend composition gap without changing the API.
