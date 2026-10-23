# Independent healthcare demo

Feature ID: HCD. State: implemented subset; local verification and outstanding checks are recorded in the [6b-4 delivery record](../releases/unreleased/restructure-phase-6b-4-2026-10-23.md). Test guide: [1.0.0](../testing/v1.0.0/PRE-COMMIT.md). No deployment or clinical acceptance.

## User problem and outcome

Healthcare product screens can now run in a separate Next.js app through public library exports, without importing the desktop workspace or another demo. The first subset covers the Healthcare Suite core, patient query/record/360, clinical documents, registration, billing and care-page designs. Phase 6b-2 adds all 55 LIS1/LIS2/RIS1 menu destinations and their detail/viewer/print routes. Phase 6b-3 adds the thirteen Pharmacy-1 destinations and record/query flows. Phase 6b-4 adds all forty RCM Workspace pages and their query workflows. The [app guide](../../demo-apps/healthcare/README.md) lists all routes and setup.

## User and administrator flows

1. Start the unchanged synthetic demo API and the app, then sign in through the shared login screen. A failed login stays on the form; authenticated requests use the platform token transport.
2. Choose Healthcare Suite or Healthcare in the shared shell. Open Patients or Patient search, enter criteria, then open a record or a patient-specific consultation link. Suite facilities and role capabilities come from the API session.
3. Enter fictional documentation, save a draft, reload it, or explicitly complete a document after validation. A failed save retains values; retry identity and conflicts follow the source adapter contracts. Completion is a demonstration, not a medical decision or signature acceptance.
4. Open Preferences. Changes pass through one serialized API-backed host path. Tenant locks and allowed values govern controls; focus/policy-change refresh can replace effective values. Failed preference saves retain accepted values and require reload before further changes.
5. Change language, density, motion or form/result presentation. Formatting and layouts consume effective library preferences. Runtime catalog loading keeps the editor mounted so a language change retains unsaved input.

## Technical contract and integration

The provider order is SessionProvider → PreferenceHost → LocalizationProvider → ShellProvider and EnterpriseShell. Runtime configuration supplies the API URL. The optional Next proxy supports same-origin requests without baking a backend URL into components. `src/navigation.ts` defines pages and deep links; the public page-renderer registry composes product modules. Masters configure public WorklistPage, RecordPage and TemplateFields. Clinical forms use public record-section layouts and shared primitives. Suite lists use public CollectionView and Pagination, and exports use the worklist export policy.

A product adapter takes a request callback rather than knowing credentials or an origin:

```ts
import {createAuthedFetch} from '@pepbits/platform/auth';
const request = createAuthedFetch({apiBaseUrl: configuredBaseUrl});
```

The unchanged API owns synthetic data, authorization, policy revisions, validation, shared catalogs and durable clinical commands. Browser role gates do not establish permission. The demo owns product workflows and scope metadata. Tests read canonical fixture/catalog files only in test code and mock HTTP clients; runtime catalogs are fetched from the API.

## Compatibility, localization and accessibility

No original source or backend migration occurs. ClinicalPatientWorkspace is a demo module here; its Healthcare repository product copy is a separate migration. API scope identifiers remain compatible with existing fixtures. Full shell login/preferences are public exports and AI is off. Before login, the shared catalog is protected, so unresolved shared login keys receive readable literal fallback wording.

Route matrices cover default, Arabic RTL, reduced motion and locked density. Jsdom axe checks cannot measure contrast; browser checks include contrast. Neither replaces native-speaker, keyboard/assistive-technology, clinical or production acceptance. The 6b-2 record confirms the merged profile-button accessible-name fix: 122 local real-HTTP route cases have zero page-content and full-shell axe violations.

## Acceptance, completed and pending work

| ID | Contract and verification |
| --- | --- |
| HCD-01 | Provider chain, accepted preference revisions, serialized writes, lock refresh and editor retention during language loading |
| HCD-02 | API-backed patient search, including criteria, empty/error states and cancellation |
| HCD-03 | Patient record/360 and Suite patient/master/encounter deep links |
| HCD-04 | Clinical consultation draft save and reload over the real local HTTP API; mocked validation/conflict/retry cases per ported workspace |
| HCD-05 | Every static page under four preference profiles with page-body axe; full-browser axe results separately identify shell and product findings |
| HCD-07 | All 55 diagnostic destinations, strict detail routing and configured HTTP scope; original diagnostic client cases and three patient failure/retry cases |
| HCD-08 | Diagnostic route preference/RTL/axe matrix, effective page size/locks and synthetic HTTP browser navigation |
| HCD-09 | Pharmacy destinations/query links, patient registration, search, trusted identity and branch isolation |
| HCD-10 | Prescription dispensing chain, counter sale, receipt and return workflows over real local HTTP |
| HCD-11 | Synthetic customer orders, purchasing/stock receipt, prior authorization and claims/remittance workflows |
| HCD-12 | Pharmacy command replay, structured failure/retry, mounted preferences and cache scope |
| HCD-06 | Public package boundaries, forced root CI, builds, documentation and protected-path/source checks |

Exact case/file counts and failures are in the delivery record. Later runs cover quality, SurgiSuite and MedBand/MedSlot. The standalone four-layer consultation composer and ambient speech recorder are deferred; no empty destination is exposed. Native windows, a production speech/AI provider, licensed terminology and medical/domain sign-off remain out of scope. The Suite API has no generic versioned master-draft contract; no durable master draft or concurrency guarantee is added.

## Operations and support

Use Node 24 for the demo API. Missing generated API runtime files require the API's normal build environment or explicitly verified existing artifacts; the integration script records which method it used. Configuration errors, authorization failures and validation messages should be diagnosed through the API response and retained source-scoped evidence. No credentials, authorization headers or passwords belong in logs. Remove the new app/configuration to stop using this demonstration; original desktop consumers and backend files remain unchanged.

## Diagnostic user flow and boundaries

Select LIS1, LIS2 or RIS1 in the header and open the needed sidebar workflow. Register a fictional patient, search the saved record, then follow its order/sample or radiology worklist links. Laboratory collection, accession, result entry, validation/signing and critical alerts use the original API commands. RIS reception, scheduling, technologist and reading pages use the same authenticated branch. Read-only actors cannot gain authority through a browser control; server permissions remain decisive.

The product modules configure public TemplateFields/CollectionView and reuse shared controls, dialogs, tabs and notifications. The diagnostic adapter sets module/branch routing metadata on the host's authenticated HTTP callback. Changed resource paths and branch transports discard stale data. Patient validation failures preserve entered values and allow explicit retry. No new durable draft or transaction guarantee is introduced.

Effective table/font/format/motion preferences apply; locked page size cannot be changed locally. Work-queue/lookup service limits, print-template geometry, tube cap colors and DICOM pixels are domain-specific. Shared catalogs are fetched at runtime. Existing source wording without a canonical translation remains fallback text; automated Arabic/RTL checks are not native-speaker approval.

Phase 4c is merged; adoption by existing diagnostic workflows remains a follow-up for generic label-printing, form-designer and device-integration patterns/adapters. Printed output, report signing, all detailed DICOM tools, real analyzers, native hardware and domain acceptance are not established by route rendering or automated axe. The app guide and delivery record state the exact verified workflows.

## Pharmacy user flow and boundaries

Select Pharmacy-1, register a fictional patient and use the command palette to open the profile. New prescription selects a patient, prescriber and medicine; the workbench progresses through review, verification, stock reservation, final check and handover. Validation errors retain the form; stock conflicts and refused commands remain visible through shared notifications. A retry of a command whose response was lost retains its operation key. A confirmed rejection allows a fresh corrected attempt. Scope changes discard cached data and pending reads.

Counter sale takes a synthetic payment and opens its invoice; Receipt previews the thermal document and Print uses the shared print surface. Sales records returns. Purchasing receives stock batches. Prior authorizations records simulated payer decisions. Claims submits/adjudicates synthetic claims; Remittance posts their simulated payment. Audit identifies the signed-in actor. Settings lists staff without impersonation and routes appearance changes through the same policy-controlled preference host. Browser controls do not authorize these operations; the unchanged API does.

The port configures typed TemplateFields and CollectionView and uses public UI, tabs, dialogs, notifications and printing. Specialized queues, prescription chain, charts and receipt geometry remain product components. Effective presentation, formatting, shortcuts and managed table settings apply; currency comes from API pharmacy settings. No new durable draft, physical label printer, identity device, designer, external payer, bank or prescribing service is introduced. Phase 4c patterns are available where their contracts fit future work.

All thirteen destinations receive default, Arabic RTL, reduced-motion and locked-density page-content axe coverage. Original pharmacy tests are preserved with explicit adaptation of generation checks to frozen CSS provenance/canonical alias checks, and notification assertions to the shared ScreenHost. The release record separates mocked tests, real HTTP/UI workflows and direct API commands, with exact counts and retained failures. The backend catalog still lacks the two inherited aliases `Configuration` and `Pharmacy, people, appearance`; English fallback is explicit. Demonstration only, not clinical/financial, native-language, assistive-technology or native executable acceptance.

Pharmacy lookup adapters supply product endpoints and row content to public `@pepbits/ui` AsyncLookup. The shared control owns keyboard selection, popup semantics and stale-read cancellation; the app continues to own its authenticated transport.

## RCM Workspace increment

Phase 6b-4 adds all forty RCM reference pages under `/rcm`, keeping eight sidebar categories and the original record/filter query links. The source inventory is [listed in the app](../../demo-apps/healthcare/src/modules/rcm/navigation.json); expected business behavior comes from the [RCM reference guide](rcm-reference.md). The [6b-4 delivery record](../releases/unreleased/restructure-phase-6b-4-2026-10-23.md) identifies the local source and test boundary.

| Case | User flow and verification |
| --- | --- |
| HCD-13 | Choose RCM Workspace, visit forty sidebar destinations, open a reference with the command palette; navigation and API registry agree across eight categories |
| HCD-14 | Issue an eligible invoice, reload its financial document, create a receipt with shared fields/lookups and allocate it to an open invoice |
| HCD-15 | Prepare a credit note, retain retry identity, reject stale edits and same-person approval, issue through a second authenticated person, inspect audit and enforce read-only roles/branch isolation |
| HCD-16 | Submit a claim, record simulated acknowledgement/denial/correction, use currency scope and approvals; real HTTP workflows are distinguished from UI actions |
| HCD-17 | Default, Arabic RTL, reduced motion and tenant-locked density route/axe matrix; mounted editors retain input during accepted preference changes; browser presentation and focus checks |

Creation/edit/action forms configure TemplateFields; metadata-driven worklists configure CollectionView. Product financial documents, boards, charts and lifecycle/palette behavior stay in `src/modules/rcm`. Public AsyncLookup and Source* controls are reused. SourceDialog provides generic focus semantics for the original specialized overlay frames; it is exported from components with lifecycle tests. Host settings remain authoritative for the composed presentation, including the default settings.

The configured HTTP adapter supplies existing product/module/branch routing metadata. Authenticated server context establishes permissions, trusted actors and transaction isolation. Data caches are scoped and disposed on identity changes; obsolete reads are aborted/fenced. Commands carry idempotency keys and row versions. Validation failures preserve values; stale-version conflicts reload the current record and explain the conflict. Independent approval failures remain visible. Transient editor state is not a new durable draft service.

Fictional software demonstration only. Payer, payout, accounting and DRG outcomes remain API simulations. Export/device/designer adoption is not applicable to this source workflow. Native, clinical/financial, assistive-technology and human language/domain review remain outside local test acceptance. Original applications and historical evidence remain intact.

## Teleconsult increment

Phase 6b-5 ports Clinic Desk and CareCall as exactly two header modules, with all nine sidebar destinations and three appointment record routes. The [app guide](../../demo-apps/healthcare/README.md#teleconsult-provider-and-patient) gives routes and usage; the [delivery record](../releases/unreleased/restructure-phase-6b-5-2026-10-23.md) separates mocked tests, real local HTTP, browser rendering and remaining acceptance.

| Case | User flow and contract |
| --- | --- |
| HCD-18 | Choose Provider or Patient; server-granted Doctor/Nurse modes and beneficiary selection |
| HCD-19 | Book through patient lookup or patient symptom advice, clinician and available slot; effective branch modes/durations |
| HCD-20 | Nurse admits, records triage and simulated vitals, then hands off to Doctor |
| HCD-21 | Replay/stale-version handling, Doctor signing, own-patient summary after reload and shared synthetic printing |
| HCD-22 | Dedicated-role and cross-patient restrictions; administrator-only registration; branch isolation |
| HCD-23 | All twelve route patterns across default/Arabic RTL/reduced-motion/locked-density profiles; mounted form retention and managed page size; phone and bottom-nav viewport fit |

The existing provider chain and public renderer registry are unchanged. Product components retain consultation, schedule, patient phone, notes and simulated media layouts. Registration and worklists configure TemplateFields and CollectionView. Public AsyncLookup, Source* controls, SourceDialog, shared printing and ScreenHost notifications replace duplicate infrastructure. The HTTP adapter uses the configured base URL and fixed namespace/scope metadata; the server validates identity, role, ownership, state, consent, idempotency and versions.

Recoverable failures retain unsaved edits; an ambiguous retry uses the original operation key. Conflicts require explicit reload/reapply decisions and signed history stays immutable. This is transient editor retention, not a new durable draft service. Shared canonical catalogs remain backend-owned; English literal source keys resolve against the runtime catalog. CareCall retains its source light palette, with scoped contrast corrections. Effective formatters, typography, form/result scales, table settings, reduced motion and shortcut preferences apply.

This is a fictional software demonstration. Remote media, transcript, scribe, scores and advice remain simulations, and no real prescription/order/billing transaction is posted. Identity/media providers, secure attachments, devices, clinical governance, human language/domain review, assistive-technology acceptance and native executables are outside this port. The phase 4c patterns are available; none is required by the original Teleconsult workflows.
