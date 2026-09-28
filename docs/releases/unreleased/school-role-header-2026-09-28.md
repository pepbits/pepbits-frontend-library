# School role views in the header — 28 September 2026

Status: deployed to the isolated frontend test site; local and public role acceptance passed. Date UTC: 28 September 2026. Implementation source: `9c3cea72e624dccb454cfd60fd2d0a34b774a69b`, based on `6f470dc81f4a52557ca4010e715af9b8f020cc25`. Package publication and tag: not created. Public deployment: release `20260928121228378-07561b3d` active at `https://frontend.test.pepbits.com`. Affected area: shared frontend navigation, School reference module and authenticated synthetic demo API.

## Changes and user impact

Choose School Administrator, Teacher, Student, Parent, Librarian or Accountant in the header to open that view's dashboard and sidebar. Module context is retained in page URLs, refresh, browser back/new tabs, command search, remembered landing preferences and desktop-browser workspace identities. All six views reuse the canonical 24 School page registrations. Reports, ERP1, ERP2 and healthcare retain their existing navigation.

The synthetic `enterprise-admin` account is explicitly entitled to all six views. Each synthetic School-role account receives its own view. The server validates `X-Reference-Module`, product, branch and authenticated grants before applying the effective School persona. Original account identity and session remain unchanged. Header, query and body edits cannot grant another role. See the [user instructions](../../features/school-role-views.md).

## Compatibility and documentation

Existing `reference-school` Administrator URLs remain valid; legacy School URLs for an account with one authorized view resolve to that view. Restricted child routes still require the relevant role. Optional module context preserves legacy navigation keys and URL behavior for other pages.

No persistent business schema migration is required. The new immutable documentation patch `2026-09-28-school-role-views` updates dashboard instructions and preserves older snapshots and existing review states. The 468 guide registrations remain unchanged; 1,572 existing guide-authoring/native review items remain tracked backlog. Claude Haiku translated two revised paragraphs; that is not native-speaker approval.

## Verified local acceptance

All final checks ran against the identified implementation source:

| Check | Result |
| --- | --- |
| Frontend unit tests | 1,883 passed across 160 files |
| API tests | 248 passed: 215 general and 33 clinical |
| Typechecks | 17 shared packages and desktop passed |
| Production builds | Web and desktop-browser passed |
| Repository rules | All normal gates passed |
| E2E registry / deployment mechanics | 2 / 14 tests passed |
| Authenticated Chromium | 28 checks passed; zero page errors; seven screenshots |
| Documentation | 134 files at implementation freeze; 136 after evidence collection; 468 registrations and impact receipts passed |
| Source provenance | 341 original files unchanged; 152 static destinations; six public packages |

The browser run covers all six selections and ordinary role logins, role-specific sessions/menus, child and student data scope, hidden direct routes, refresh/back/new-tab behavior, legacy links, remembered landing, command search and representative ERP1/ERP2/Reports/healthcare navigation. The focused API suite also verifies restricted writes, forbidden branch/product/module selectors and grant-spoof attempts. Repeated focused suites overlap the full suites and are not added to the totals.

Retained evidence: [local validation](evidence/school-role-header-2026-09-28/local-validation.json), [browser results](evidence/school-role-header-2026-09-28/local-browser/results.json), [expanded selector](evidence/school-role-header-2026-09-28/local-browser/school-role-header-options.png), [Claude review](evidence/school-role-header-2026-09-28/backend-claude-review.txt). Reproduce the browser checks with [the registered script](../../../desktop-clients/e2e/school-role-header.mjs) and explicit `E2E_BASE` / `E2E_API` values.

## Deployment, rollback and limits

The isolated public-site update is active from the exact implementation source above. The web and desktop-browser package smoke checks passed before activation; all three isolated services are active and their release markers match. The live API passed six-view/24-page checks, own-role navigation and mismatched-role denials, with zero business writes. All 28 authenticated role-browser checks passed over public HTTPS, using normal DNS resolution and certificate validation, with zero page errors. See [public role results](evidence/school-role-header-2026-09-28/public-browser/results.json) and the [public selector screenshot](evidence/school-role-header-2026-09-28/public-browser/school-role-header-options.png). The broader [public reference regression](evidence/school-role-header-2026-09-28/public-reference/results.json) passed all 152 static destinations, six dynamic URLs and four representative pages (162 records) with zero page errors. Its four physical-source header checks preserve Reports, ERP1, ERP2 and School Administrator; the separate 28-record role suite covers all six School choices. The previous release `20260928110944214-b5bb610f` and matching source/config/data backups remain retained for rollback; no rollback was triggered. Retained [runtime receipts](evidence/school-role-header-2026-09-28/runtime/README.md) identify source/archive, package checks, backups, activation and active service/API checks. The [test-site runbook](../../../desktop-clients/docs/frontend-test-deployment.md) describes service and TLS boundaries.

These are synthetic demo accounts and API records. Production School identity/provider integration, native executable execution, regulatory certification and native-speaker review are not claimed. The source-reference page import remains distinct from pixel equivalence or exhaustive business-workflow acceptance.
