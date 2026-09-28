# Reports, ERP1, ERP2 and School reference modules

Feature ID: REF-MODULES. State: implementation and local validation complete; package publication and live deployment are outside this task. This guide covers reusable frontend modules and their fictional demo APIs. It does not establish a deployed ERP, school or reporting backend.

The four modules expose 152 source-reviewed English page guides in release `2026-09-28-reference-modules`. The [guide audit](../reference-import/GUIDE-REVIEW.md) maps each guide to its actual route, component and API contract. Draft Arabic, Hindi and Malayalam translations are populated and their revision baselines are current; all await native-speaker review. The lifecycle helper marks the Malayalam school-library entry incomplete because its standalone `ISBN` identifier is intentionally unchanged. See the [translation validation record](../reference-import/TRANSLATION-VALIDATION.json).

## Purpose and module selection

Applications can add Reports, ERP1, ERP2 and School as separate modules in the existing frontend workspace. The host keeps responsibility for sign-in, branch and role selection, the module selector and the sidebar. The reference pages keep their own module and page identities, so similar names across modules do not collide.

Reports includes its library, builder, dashboards, jobs, schedules, email requests and administration. ERP1 and ERP2 each expose 57 catalogue destinations through 20 template families; ERP1 retains its in-page record editor behavior, while ERP2 supports routed new, view and edit records. School includes administration, teacher, student, parent, librarian and accountant views, with the applicable dashboards and academic workflows. The [source inventory](../reference-import/SOURCE-INVENTORY.json) records 341 original source files across the four source modules; those source trees remain unchanged. Six public packages provide the four modules, their common host contract and shared ERP components.

## Packages and catalogue coverage

| Header module | Public package | Source design | Static destinations |
| --- | --- | --- | ---: |
| Reports | `@pepbits/reference-reports` | Lumen Reports | 14 |
| ERP1 | `@pepbits/reference-erp1` | Keystone ERP1 | 57 |
| ERP2 | `@pepbits/reference-erp2` | Keystone ERP2 | 57 |
| School | `@pepbits/reference-school` | Scholaris | 24 |
| **Total** |  |  | **152** |

ERP1 and ERP2 share `@pepbits/reference-keystone-core`; each keeps its own module, navigation, scoped data and record behavior. `@pepbits/reference-host` defines the host injection contract. The 152 static destinations include Reports Overview. Six dynamic report, builder, dashboard, ERP2 customer, School quiz and live-room URLs resolve through their parent page. Four module-header and desktop-opening checks cover the desktop client.

## User workflow

1. Sign in through the host and select a branch and imported module available to the current user.
2. Open a destination from the module's page navigation. Dynamic records, dashboards, quizzes and live rooms retain their route identifiers through host navigation.
3. Search or filter a list, open a record and use the actions available on that page. API-backed actions go through the configured module adapter.
4. Review the returned state and validation messages. Failed requests keep retryable work available to the user.
5. When the user, branch or module changes, the host invalidates data from the prior scope before rendering the new one.

These workflows were exercised against the local integrated candidate. The [evidence index](../releases/unreleased/evidence/reference-modules-2026-09-28/README.md) records the exact route checks and actions. This is local demo evidence, not a production service claim.

## Integration boundaries

The public module exports receive typed host navigation, request, effective-preference and authenticated-context contracts. Client transports use that contract; they do not import source filesystem stores or server-only packages. A consuming application can connect an authorized backend without editing the page renderer.

The local `dummy-api` stores provide fictional Reports, ERP and School data and simulate operations such as report generation, record updates, quiz grading and live-room actions. They do not deliver real email or replace production business services. Client scope metadata routes requests but does not authorize them. A production backend must enforce identity, branch, role and operation authority on every read and write.

Generic controls and common page primitives use the shared UI packages. Specialized report charts, editors and template layouts remain module-owned where the shared components do not express the required interaction. The imports also use host preferences and tenant locks: the recorded checks covered RTL, compact density, a dark theme, larger host font settings and read-only page-size enforcement. Date, number, currency and pagination behavior must follow the host's effective preferences.

## Verification and remaining acceptance

The final local evidence records 162 browser route/header checks with no recorded errors: 152 static destinations, six dynamic destinations and four desktop checks. It also records the Reports builder and API-key workflow, non-owner report delivery, ERP1 and ERP2 record creation/editing and print flow, and four genuine School actions, including exact 75-byte attachment round-trip, idempotent library return, server quiz grading and persisted live-room actions.

The healthcare compatibility comparison covers six existing pages: rendered text and measured geometry matched on all six, with five byte-identical screenshot pairs. The remaining query screenshot differs at 63 border pixels (0.009%). After the candidate and baseline were both found to route record and 360 page IDs to the query form, explicit forward and reverse page-ID mappings were added; three real query/new-record/360 navigation checks and eight focused component tests then passed without changing form UI or writing clinical data.

Final recorded local checks include 1,859 Vitest tests, 238 API tests, package/client type checks, separate 46-test ERP and 35-test School checks, and successful web and desktop builds. The largest compressed client chunks were 266,229 bytes for web and 528,673 bytes for desktop, below the 550,000-byte budget. All five existing browser regressions passed, including the 14-ID Page Library run. See the [delivery record](../releases/unreleased/reference-modules-2026-09-28.md) for test scope and the evidence index for logs.

Native-speaker review remains pending for all 456 Arabic/Hindi/Malayalam guide translations. The revision helper reports 455 current entries and one Malayalam `ISBN` identifier exception; all 456 review states remain pending. The strict documentation gate therefore remains blocked by 1,572 authoring/review items (168 inherited workflow items and 1,404 guide-translation review items). No locale approval, native executable test, public production backend, real mail delivery, package publication or deployment is claimed.
