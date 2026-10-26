# Shared record form engine

Feature ID: `RECORD-FORM`. Status: implemented for local 0.2.0 preparation; verification is recorded in the [delivery record](../releases/unreleased/record-form-engine-2026-10-26.md). No publication or production product integration is implied.

## User flow

Open a new, editable or read-only record. The compact summary shows host-supplied facts, an alert, decorative code and completion. Choose the arrangement in Preferences → Forms: Single page shows all sections with a scroll-following list; Tabs, Guided steps and Side steps show a selected section; Accordion folds sections. Section cards and navigation show required counts, completion and errors. Inputs remain mounted when changing sections or layouts. Check form rules opens the shared drawer; select a rule to focus its field. The host supplies Back, Save and any domain-specific labels/actions. Read-only mode omits Save, while the host renderer displays recorded values.

The healthcare Patients module uses these components for new/edit/view, retains its compact band, hidden title and 8px top gap, and removes Layout setup. Its patient list and API remain unchanged. The separate standalone demo retains its own organisation designer.

## Integration and preferences

Use `RecordForm`/`RecordSectionCard` from `@pepbits/page-engines/record-layout`, and `RecordSummaryBand`/`FormRulesDrawer` from `@pepbits/patterns/record-form`. Supply sections, controlled values, per-section progress, renderers, validation and actions. Render context includes mode/readOnly, effective preferences, columns, validateOn and keepUnsaved. Respect readOnly in custom renderers. Reuse PreferenceHost → LocalizationProvider and the existing ScreenHost document dirty contract; the engine reports dirty without adding storage or transport. See [engine API](../../packages/page-engines/README.md#shared-record-forms--020-preparation) and [pattern API](../../packages/patterns/README.md#record-summary-and-rules--020-preparation).

| Key | Values / default |
| --- | --- |
| formNavigation | scroll (default), tabs, wizard, stepper, accordion |
| density | compact, comfortable (default), spacious; shared with other surfaces |
| formColumns | 2, 3 (default), 4 |
| formShowSummary | true (default), false |
| formValidateOn | blur (default), change, submit |
| formKeepUnsaved | true (default), false |

All values use existing user overrides and tenant defaults, locks and allowed sets. Legacy rail is normalized to scroll in storage, imports, policies and allowed sets. No new local preference store is introduced. Forms controls are built into the shared PreferencesPage, including search, reset, import/export and policy administration.

## Permissions, failures and completion boundary

The host authenticates record requests, applies field/action permissions, validates domain rules and decides whether a guided step can advance. Presentation locks are not server authorization. Validation timing controls when the healthcare host reveals field problems; Save always validates. Recoverable API/422/409 errors retain edits. Keep-unsaved requests host retention: healthcare uses memory only, clears retained drafts when disabled, and clears them on reload, module exit or identity change. There is no durable patient browser storage. Mounted input retention is independent of draft retention.

Part B must upgrade its package lockfile after owner publication, provide the canonical en/ar/hi/ml labels and backend preference validators, accept new values and normalize old rail policies/allowed lists before resolving them. Supply patient sections/fields, authoritative validation/progress, real read/create/update adapters and existing draft/dirty contracts. It must not import demo code. Human language/domain review, clinical authorization and Healthcare Enterprise production integration remain separate acceptance work.
