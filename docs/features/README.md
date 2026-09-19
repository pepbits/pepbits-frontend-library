# Feature catalog

Reviewed 13 September 2026. See the [current delivery index](../releases/unreleased/README.md) for deployment status and the [documentation coverage](../README.md#current-status) for remaining authoring/review work. The [page-help audit](../documentation/reference-guide-audit-2026-09-11.md) maps the reference-only pages to their actual implementations and distinguishes platform instructions from missing domain workflows.

- [Own Settings and default module](own-settings.md): API-backed personal startup module with tenant controls.

- [Comprehensive Consultation](comprehensive-consultation.md): specialty documentation, linked orders, scoring, coding and demo signing.

This frontend is a reusable design and application framework. “Implemented” below means a frontend capability and its documented demo contract exist; it does not establish production ERP, clinical or school-service acceptance.

| Feature family | Guidance | Current boundary |
| --- | --- | --- |
| OP Consultation | [User and integration guide](op-consultation.md) | Focused OP workspace, shared consultation records and read-only triage context |
| Clinical Consultation | [User and integration guide](clinical-consultation.md) | Compact API-backed notes; production clinical integration remains separate |
| Clinical Triage | [User and integration guide](clinical-triage.md) | API drafts, manual triage and handoff; clinical acceptance remains separate |
| Billing Clinic | [User and integration guide](billing-clinic.md) | CSV-backed demo billing; real payer, gateway and accounting integration remain separate |
| Library preferences and component compliance | [Current detailed guide](library-preferences.md) | Implemented and deployed; historical checks and platform limits remain in the delivery records |
| Component examples and copyable code | [Component Library](../../desktop-clients/docs/component-library.md) | Shared demos; new preference behavior is described in the current guide |
| 97 configurable page templates | [Page Template Library](../../desktop-clients/docs/page-template-library.md) | Reusable engines and sample adapters; real domain services belong to applications |
| Patient Query, Record and 360 | [Clinical templates](../../desktop-clients/docs/clinical-page-templates.md) | Fictional demo data; not clinical validation or insurer integration |
| Tenant defaults and locks | [Preference policies](../../desktop-clients/docs/tenant-preference-policies.md) | Existing scoped API contract; real identity/authorization must be integrated |
| Localization and backend messages | [Localization](../../desktop-clients/docs/localization.md), [backend messages](../../desktop-clients/docs/backend-message-localization.md) | Catalog checks are distinct from native-speaker approval |
| Record editing | [Record editing](../../desktop-clients/docs/record-editing.md) | Adapter, validation, conflict and retry responsibilities are documented |
| Shared drafts | [Draft service](../../desktop-clients/docs/shared-draft-recovery.md), [recovery center](../../desktop-clients/docs/draft-recovery-center.md) | Tenant storage, retention and sensitive-field rules apply |
| Sentinel and user-facing errors | [Sentinel](../../desktop-clients/docs/sentinel-monitoring.md) | Demo collection contract; production monitoring integration remains explicit |
| Imports, approvals and related record panels | [Illustrated platform guide](../../desktop-clients/docs/handbook/frontend-platform-guide.md) | See the guide's feature-specific scope and API boundaries |
| Page help, releases and documentation alerts | [Implemented documentation lifecycle](../documentation/README.md) | Shared API articles, impact checks and review metadata; inherited authoring/native-review backlog remains explicit |

## For future features

Create a feature document using the [feature template](../releases/templates/feature.md). Include the trigger, user flow, settings and permissions, failure behavior, API/data ownership, integration example, accessibility/localization, test IDs, completed work and pending work. Link it from this catalog and the appropriate release record.

Never substitute a screenshot, an empty route or a passing build for functional acceptance. Keep planned, implemented, tested, deployed and accepted states distinct.

- [Registry design family](registry-design-family.md): worklist, small master, billing, claim and consultation templates.

- [Page Library CSV storage](page-templates-csv.md): API-backed query, main record and 360 data with CSV persistence.

- [Billing corrections and shared clinical workspaces](clinical-workspace-update.md)

- [Page Library: List of pages](page-library-catalog.md)

- [Shared help and documentation lifecycle](../documentation/README.md): API articles, new-page scaffolding, impact checks and translation-review evidence.

- [OP Registration](op-registration.md): one-page outpatient registration, care and checkout template with CSV-backed demo commands.

- [Barcode, QR and label printing](barcode-qr-printing.md)

- [Generic device integration library](device-integrations.md): scanners, document jobs, workstation routing and typed connector contracts.

- [Identity readers and patient verification](identity-devices.md): card/EID, passport and one-to-one biometric workflow demos.

- [Healthcare reference page templates](care-page-templates.md): emergency, inpatient and consultation reference designs with shared components and CSV-backed API records.

- [DCP Visual Designer](dcp-designer.md): shared visual authoring, dependent lookups/value sets, bounded CSV/XLSX staging, repeatable fields, preview, lifecycle, scoped recovery and backend v1 runtime demonstration; production host integration remains pending.

- [Shared lifecycle configuration](lifecycle-configuration.md): reusable catalogue, visual editor, validation, resolution preview, approval, publication and activation over a host lifecycle API, plus optional source registry browsing and governed source-to-event payload mappings; host adoption and live acceptance remain separate.

- [Master transfer and pricing expression components](master-transfer.md)
