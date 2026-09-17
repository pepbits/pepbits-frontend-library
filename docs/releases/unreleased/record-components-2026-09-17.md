# Shared record presentation — 17 September 2026

Status: developed and validated locally. No registry publication, commit/push or live deployment
performed for this change. [Reusable API and adoption guide](../../architecture/record-page-components.md).

## Changed

Extracted the remaining general-purpose registration presentation into WorkspacePage, RecordPage,
RecordIdentity, RecordNotice, RecordActionBar and DcpSectionFields. Healthcare consumes these exports
through the `0.0.0-hc064.1` private archive handoff. Layout sizing is explicitly opt-in; existing demo
page consumers retain their viewport behavior. Theme tokens and resolved preferences remain the
source of presentation settings. DCP row projection retains server-provided access constraints.

Source identity: base `ebddd6b7648935faa40a1a71c5b3339da70fe430` plus the implementation file hashes in
[the manifest](manifest-record-components-2026-09-17.json). The healthcare lock also retains the
exact package patch checksum and all 12 archive digests. Documentation changes after testing do not
change runtime sources.

## Verification

Node 24. Commands run from `desktop-clients` unless otherwise noted:

- `npm run typecheck`: all configured packages and desktop application passed.
- Focused Vitest: 32 tests in four files (record page, record layout, DCP runtime fields, shell chrome).
  The customer host confirms reuse outside healthcare. Tests cover preserved drafts, preferences,
  disabled/hidden actions, missing row metadata and masked parents.
- `npm run build`: web production build and Vite desktop frontend build passed. Native binary execution
  was not tested.
- Shared component, form-control, generated library example and template gates passed.
- Documentation impact receipts checked; inherited 1,116 authoring/review backlog entries remain open.
- Healthcare packaged consumer: 17 unit tests, typecheck, 12 archive checks, production build and
  20 synthetic browser checks. Desktop/mobile screenshots reviewed. RTL layout is checked through
  saved language preferences; it is not native-language review.

[Retained local test output](evidence/record-components/component-tests.txt),
[typecheck](evidence/record-components/typecheck.txt), [build](evidence/record-components/build.txt),
[component gates](evidence/record-components/gates.txt).

No real patient data, live healthcare API acceptance, load benchmark, hosted upgrade or automatic
adoption by other applications is claimed. The components add no polling or storage. Application
APIs remain responsible for tenant authorization, validation and durable saves.
