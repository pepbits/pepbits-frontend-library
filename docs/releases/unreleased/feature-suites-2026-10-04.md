# Feature suites and patient 360 booking crash — 4 October 2026

Status: implemented and verified locally; deployed by the Jenkins `main` pipeline to the
[test site](https://frontend.test.pepbits.com) when pushed. Date UTC: 2026-10-04. Base: `bdeef57`.
Testing-guide version: [current testing guide](../../testing/README.md). Executor: Claude Code on the fleet hub.

## Changes and user impact

Five `features` browser suites failed identically before and after the
[navigation fixes](navigation-suites-2026-10-04.md). Investigation found one product defect.

**Fixed product behavior**

- **Patient 360 crashed after booking an appointment without notes.** The demo store persists care rows in CSV and
  drops empty cells, so a booking's empty `detail` came back missing; the overview then translated `undefined` and
  the whole page failed with "This page encountered an error". The CSV reader restores the contract's empty
  `detail` (`dummy-api/clinical-template-csv.ts`) and the overview omits an empty detail line
  (`erp-screens/src/clinical-templates/patient-360.tsx`).

**Test corrections**

| Suite | Cause | Correction |
| --- | --- | --- |
| `clinical-templates` | Clicked per-record "Rail/Wizard/Tab layout" buttons removed on 9 September when the record adopted the shared `formNavigation` preference; also hit the crash above | Chooses "Record form style" in Preferences and reopens a new record; passes with the product fix |
| `page-templates` | Hard-coded 97 templates; the catalog now has 102 | Derives the count from `PAGE_TEMPLATES` installed by the product |
| `localization` | Counted the English row buttons before the table re-rendered after a language switch | Waits for the buttons |
| `library-preferences` | Accepted only component-catalog/reference markers; 25 later Library pages (Page Library list, DCP designer, care pages, billing, clinical documents, OP registration, labels, devices, identity readers) render their own roots | Accepts those recognised Library surfaces; all 159 destinations still must render one |
| `dcp-designer` | Raced the designer: clicked within `@dnd-kit`'s 50 ms post-drop click guard, pressed keyboard-drag keys before the pick-up activated, and expected single-column movement although fields are a two-column grid | Waits for each step's visible result and the drag state; expects ArrowDown to move the field to the cell below (last position) |

### Follow-up: intermittent `search-post`

`search-post` failed once in a full `browser` run (worklist keyword field not found) and could not be reproduced in 8
isolated and 4 grouped runs. Deep links, preferences, login rate limits and the preceding `saved-view` suite were
ruled out as shared-state causes. The shared `signIn` helper slept a fixed 6 s after login instead of waiting for the
signed-in shell; it now waits for the shell header and network idle. `search-post` confirms it is on Customer Master
before typing and, on failure, saves a screenshot with the URL and heading. After the change: `search-post` alone
5/5, full `browser` group 5/5 runs at 9/9, and the group runs about 25% faster. The original cause remains
unconfirmed; the new evidence capture will identify it if it recurs.

## Installation and compatibility

No API contract, schema, preference or catalog change. Existing CSV rows without a detail cell now load with an
empty detail.

## Data, errors and security

No migration. Synthetic demo data only.

## Verification and limits

Local release builds of this source, Chromium 1148 headless on the hub, each browser suite with its own fresh API
unless noted:

| Scope | Result |
| --- | --- |
| Typecheck (all packages) | passed |
| Unit tests | 229 files passed, 2 skipped; 2,561 tests passed, 7 skipped |
| API tests | 336 passed; clinical 34 passed (adds the CSV round-trip regression test, which fails on the previous source) |
| `features` group | 44/44 passed |
| `navigation` group | 18/18 passed |
| `browser` group, one shared demo API | 9/9 passed. One earlier run failed `search-post` (worklist keyword field not found); it passed alone and in a full rerun, so it is recorded as intermittent and remains to be investigated |
| `dcp-designer` repeated | 5/5 passed |

GitHub Actions runs were not observed from the hub. Not covered: native Tauri, Firefox/WebKit, live integrations,
native-language review.

## Upgrade, rollback and publication

Push to `main` triggers the Jenkins pipeline, which deploys the test site through the pb-srv5 receiver; rollback is a
redeploy of the previous release folder (see the [test site runbook](../../../desktop-clients/docs/frontend-test-deployment.md)).
