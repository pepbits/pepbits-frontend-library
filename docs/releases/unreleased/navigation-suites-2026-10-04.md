# Navigation suites and sidebar/subtitle fixes — 4 October 2026

Status: implemented and verified locally; deployed by the Jenkins `main` pipeline to the
[test site](https://frontend.test.pepbits.com) when pushed. Date UTC: 2026-10-04. Base: `624b1d7`.
Testing-guide version: [current testing guide](../../testing/README.md). Executor: Claude Code on the fleet hub.

## Changes and user impact

Six browser suites in the `navigation` group failed on the
[rebuilt-fleet deployment](frontend-test-pb-srv5-2026-10-03.md). Investigation found two product defects and four
test or CI defects.

**Fixed product behavior**

- **Sidebar reopened after choosing a page (hover mode, the default).** Choosing a destination dismissed the unpinned
  rail as documented in the [sidebar correction](sidebar-navigation-2026-10-01.md), but Chromium re-sends
  `mouseenter` when the rail re-renders under a still pointer, so the rail immediately reopened over the new page.
  A dismissal now holds until the pointer actually leaves the rail (`erp-shell/src/sidebar.tsx`). Toggle, Escape,
  outside-click and pinned behavior are unchanged.
- **Wrong header subtitle on 239 reference pages.** LIS1, LIS2, RIS1, ERP, School, Reports and other reference pages
  showed "MedSlot scheduling workspace" (and the MedSlot text in Arabic, Hindi and Malayalam) instead of "Fictional
  demo data.". The legacy-alias loop in `applyApplicationConfig` wrote each page's subtitle translation under the
  page's legacy subtitle key, which all reference pages share, so the last page written won. The same loop could
  overwrite shared English title entries such as "Dashboard" in other locales. Aliases now only fill missing catalog
  entries (`erp-config/src/application-config.ts`).

**Test and CI corrections**

| Suite | Cause | Correction |
| --- | --- | --- |
| `reference-modules` | Hard-coded 175 pages; later imports raised the registry to 384 | Sweeps its five modules (Reports, ERP1, ERP2, School, Healthcare Suite: 184 pages) and checks page-id uniqueness across all modules; `e2e/run.mjs` allows this sweep 15 minutes |
| `pharmacy-localization` | Reverse lookup of "Full name" picked MedSlot's key, whose Malayalam differs | Prefers Pharmacy's own catalog keys |
| `teleconsult-localization` | Started from a hover-opened rail; relied on another suite having signed visit `a8` | Moves the pointer off the rail first; signs `a8` through the API when not already signed |
| `diagnostic-localization` | Started from a hover-opened rail (pointer left on the toggle by the previous step) | Moves the pointer off the rail before each toggle check |
| `diagnostic-reference` | Sidebar defect above | Passes with the product fix |
| `backend-navigation` | Failed only under a same-origin `/api` harness with two shell origins | No change; passes when both shells use one API origin as in CI |

The GitHub Actions `feature-browser` job could not pass the navigation group: it never prepared the compiled API
workers, never built or started the web shell, and did not set `E2E_BASE`. It now runs `npm run pretest:api`, builds
and starts both shells, sets `E2E_BASE`/`NEXT_PUBLIC_API_URL`, and allows 60 minutes.

The Malayalam wording of "Full name" differs between MedSlot (`പൂർണ്ണ പേര്`) and Pharmacy/SurgiSuite
(`മുഴുവൻ പേര്`). Catalogs were not changed; this is left to the pending native-language review.

## Installation and compatibility

No API, schema, preference or catalog change. Pages that relied on the clobbered alias now show their own subtitle.

## Data, errors and security

None. The Teleconsult suite signs a synthetic fixture visit on its own isolated API only.

## Verification and limits

Local release builds of this source (web shell, desktop shell, demo API with fresh fixture data per suite, simulators
from `pepbits-mocking-app` `5ced4f8b`), Chromium 1148 headless on the hub:

| Scope | Result |
| --- | --- |
| Typecheck (all packages) | passed |
| Unit tests | 229 files passed, 2 skipped; 2,561 tests passed, 7 skipped (adds 3 sidebar and 1 configuration regression tests; each new test fails on the previous source) |
| `navigation` group, each suite with its own fresh API | 18/18 passed |
| `browser` group, one shared demo API | 9/9 passed |
| `features` group, each suite with its own fresh API | 39/44 passed. `dcp-designer`, `library-preferences`, `clinical-templates`, `page-templates` (102 vs 97 templates) and `localization` (record IDs) fail identically on a build of the previous source, so they predate this change and remain open |

GitHub Actions runs of the updated workflow were not observed from the hub (no GitHub API access); the Jenkins
pipeline does not run browser suites. Not covered: native Tauri, Firefox/WebKit, live integrations, native-language
review.

## Upgrade, rollback and publication

Push to `main` triggers the Jenkins pipeline, which deploys the test site through the pb-srv5 receiver; rollback is a
redeploy of the previous release folder (see the [test site runbook](../../../desktop-clients/docs/frontend-test-deployment.md)).
