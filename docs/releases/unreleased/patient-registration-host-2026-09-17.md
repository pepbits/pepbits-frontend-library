# Patient registration host presentation — 17 September 2026

Source change, private healthcare package handoff. Not a public Library demo deployment.

## Changed

The healthcare host now uses the existing AllyVora nine-section record layout. `RecordSectionCard`
is exported with `RecordSectionLayout`; the Library patient template uses the same numbered card.
Its slots keep product fields and API transactions outside the shared presentation component.
`DcpRuntimeFields` accepts a responsive column choice and preserves it in repeated rows.

`RecordSectionLayout.keepMounted` retains host-owned section state while non-active tab/wizard
panes are hidden. It defaults off for existing consumers. A consent draft no longer needs to live
outside the visual record to survive section navigation. Inactive pane controls remain hidden.

The desktop rail remains 203 px. On narrow displays it becomes horizontal steps; cards and footer
use the available width. Existing theme, typography, density, reduced-motion and direction rules
continue to apply. Tenant preferences stay in the existing provider; no new preference store exists.

## How to consume

Import `RecordSectionLayout` and `RecordSectionCard` from `@pepbits/erp-screens/record-layout`.
Supply section IDs/headings, the effective preferences, actual identity, footer actions and a field
renderer. Use `keepMounted` for section-local draft state. Authorization, DCP field availability,
required-field semantics, commands and completion policy stay with the host/server. A visual meter
must not be treated as a server registration-completeness decision.

## Verification and boundaries

Targeted clinical/DCP tests passed (21); the new tests exercise retained section drafts and shared
card read actions. All package/desktop type checks passed except a test-only unsupported Testing
Library `exact` option; that option was removed and the screens package was rechecked separately.
The healthcare consumer has its own production build and synthetic-browser acceptance. Final
consumer results and exact private package identity are recorded in its HC-062 release document.

No authenticated live-reference pixel diff, native-device test, translation review, public package
publication or public Library deployment is claimed. The reference source and existing 9 September
alignment remain documented in `desktop-clients/docs/patient-record-parity.md`.
