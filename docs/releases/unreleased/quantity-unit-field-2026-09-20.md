# Quantity/unit primitive — 20 September 2026

Status: additive source implementation; local verification recorded below. No commit, package publication, deployment or consumer pin update is claimed.

## Added

`QuantityUnitField` composes existing ops-ui Input and Select primitives. A controlled decimal-string/unit pair is returned unchanged to the host; an optional host-provided preview is shown only for the matching pair and is suppressed during loading or validation failure. Labels, hints, errors, loading copy, locking and form names are host-supplied. There is no conversion mathematics, network, authentication or persistence in the component.

The [feature and integration guide](../../features/quantity-unit-field.md) describes the contract, user flow, accessibility, preferences, empty/retired choices, asynchronous preview boundaries and pending host work. The existing component-catalog TextDemo now includes this export and runnable source. Business pages do not use it yet. No page navigation or canonical localization text changes.

## Compatibility and packaging

The public ops-ui export is additive. Package metadata remains `0.0.0`, private, source-distributed; this record does not invent a published version. A later approved handoff must package an immutable reviewed Git snapshot into a uniquely named archive, record its SHA-256/source identity and deliberately update each consumer's package lock and provenance lock. Do not replace a vendor archive in place or edit installed `node_modules`.

Healthcare pins and source, ERP and School consumers, package archives and deployment remain unchanged. The current task creates no archive and publishes nothing.

## Verification

Commands ran from `desktop-clients` using Node 24.21.0 and the existing lockfile. [Retained evidence](evidence/quantity-unit-field-2026-09-20/README.md) includes logs and source SHA-256 identities.

| Gate | Result |
| --- | --- |
| Focused QuantityUnitField Vitest | 9 passed |
| Full `npm test -- --maxWorkers=2 --minWorkers=1` | 141 files, 1,676 tests passed |
| `npm run typecheck` | Passed, including final catalog integration |
| `npm run build` | Web and desktop builds passed; 2 tasks |
| `verify:form-controls`, `verify:shared-components` | Passed |
| `verify:localization`, `verify:library`, `verify:library-preferences` | Passed |
| Documentation contract tests | 3 passed |
| Documentation link/content checker | Passed; final file count recorded in evidence |
| `verify:documentation` | Passed after reviewing and repairing two prior shell receipts; 316 registrations, 1,116 existing authoring/review items remain pending |

The first focused invocation ran from the repository root without desktop-clients Vitest/jsdom configuration and failed with `document is not defined`; the correct invocation passed. The first full suite found the missing public component catalog entry (1 failure, 1,675 passes). Adding the runnable catalog example resolved it; the complete rerun passed. The prior shell receipt drift was subsequently resolved through an explicit [source-history review](shell-branch-receipt-review-2026-09-20.md); no shell runtime or language-review status was changed. The repaired documentation gate passes.

## Remaining gates

Hosted CI, API acceptance, browser/native/screen-reader execution, consumer packaging and adoption, and deployment are not established by component tests. Host adapters must supply canonical units, exact conversion, context/revision fencing and authorization. No claim of healthcare/ERP/School stock correctness follows from this presentation primitive.
