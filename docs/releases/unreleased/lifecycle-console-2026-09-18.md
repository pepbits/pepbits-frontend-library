# Lifecycle console — 18 September 2026

Status: local implementation; no production deployment or registry publication.
Source: working tree on `0e5de8f200378d42b2de2506d4eb1d5725d5dee1`; final commit is identified by Git history.
Testing guide: [1.0.0](../../testing/README.md). Feature: [Lifecycle configuration](../../features/lifecycle-configuration.md).

## Changes

Changed the reusable lifecycle page to the supplied three-panel console design. Added persistent
API worklist cards, stage/event summary cards, applicability editing, live counts and validation state.
Existing API ports, expected revisions, change reasons, permission hints, independent approval,
source pins, immutable releases and separate activation remain in use. No schema/API changes.

Fixed stale validation display after editor changes and guarded worklist navigation with unsaved values.
All controls use shared primitives; pane layout, stage summaries and worklist cards are specialized
lifecycle composition with semantic tokens, host typography/density and keyboard buttons.

## Verification

Passed locally with Node 24.21.0:

- `npm run typecheck`: all packages.
- `npm test`: 1,654 tests, 137 files, including two new console state/navigation cases.
- `npm run test:api`: 104 API tests and 33 clinical API tests.
- `npm run test:e2e-registry`: 2 tests; `npm run test:deployment`: 14 tests.
- `npm run build`: web and desktop builds.
- `npm run verify`: all repository gates, including localization and documentation impact receipts.
- `node docs/tools/check-docs.mjs`: 112 documentation files; `git diff --check`.

The final nonlinguistic brand-mark JSX/whitespace correction followed the runtime suite and was
checked by the repository gate. No runtime behavior changed after the passing suite.
Browser checks belong to the healthcare consuming host. Native desktop, native-speaker review,
production API acceptance and production deployment are outside this local change.
