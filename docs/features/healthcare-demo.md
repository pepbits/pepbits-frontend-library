# Independent healthcare demo

Feature ID: HCD. State: implemented subset; local verification and outstanding checks are recorded in the [6b-9 delivery record](../releases/unreleased/restructure-phase-6b-9-2026-10-23.md). Test guide: [1.0.0](../testing/v1.0.0/PRE-COMMIT.md). No deployment or clinical acceptance.

## User problem and outcome

Healthcare product screens can now run in a separate Next.js app through public library exports, without importing the desktop workspace or another demo. The first subset covers the Healthcare Suite core, patient query/record/360, clinical documents, registration, billing and care-page designs. Phase 6b-2 adds all 55 LIS1/LIS2/RIS1 menu destinations and their detail/viewer/print routes. Phase 6b-3 adds the thirteen Pharmacy-1 destinations and record/query flows. Phase 6b-4 adds all forty RCM Workspace pages and their query workflows. Phases 6b-5 through 6b-7 add Teleconsult Provider/Patient, AllyVora Quality and SurgiSuite. Phase 6b-8 adds MedBand Patient Access. Phase 6b-9 adds all twelve MedSlot destinations and both record routes, bringing the app to 193 menu destinations. The [app guide](../../demo-apps/healthcare/README.md) lists all routes and setup.

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

Exact case/file counts and failures are in the delivery record. MedSlot is included in phase 6b-9 with twelve destinations, both detail routes and the booking flow. The standalone four-layer consultation composer and ambient speech recorder are deferred; no empty destination is exposed. Native windows, a production speech/AI provider, licensed terminology and medical/domain sign-off remain out of scope. The Suite API has no generic versioned master-draft contract; no durable master draft or concurrency guarantee is added.

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

Phase 6b-4 adds all forty RCM reference pages under `/rcm`, keeping eight sidebar categories and the original record/filter query links. The source inventory is [listed in the app](../../demo-apps/healthcare/src/modules/rcm/navigation.json); expected business behavior comes from the [RCM reference guide](rcm-reference.md). The [6b-7 delivery record](../releases/unreleased/restructure-phase-6b-7-2026-10-23.md) identifies the local source and test boundary.

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

## Quality increment

Phase 6b-6 adds AllyVora Quality with twelve sidebar destinations, two actual-record routes and the report designer, bringing healthcare to **166 menu destinations**. See the [app route and usage guide](../../demo-apps/healthcare/README.md#allyvora-quality--phase-6b-6), [source behavior](quality-reference.md) and [delivery record](../releases/unreleased/restructure-phase-6b-6-2026-10-23.md).

| Case | User flow and contract |
| --- | --- |
| HCD-24 | Header/sidebar and actual indicator/report/designer routes; trusted API identity and source inventory |
| HCD-25 | Shared Authority form create, persisted reload and authenticated branch isolation |
| HCD-26 | Designer metadata, report sections, shared indicator lookup, live preview and saved report |
| HCD-27 | Authenticated CSV, recorded report run and shared synthetic PDF output |
| HCD-28 | Frozen submission, self-approval refusal, independent approval and simulated transmission/acknowledgement |
| HCD-29 | Paused monthly schedule, explicit synthetic run and retained history |
| HCD-30 | Versioned result correction, idempotent replay, stale-edit refusal and separate submitter/verifier/approver |
| HCD-31 | Manual fictional Event Pulse ingestion and validation run |
| HCD-32 | Append-only audit hash-chain verification |
| HCD-33 | Restricted actions/sidebar, direct designer and server write/source-login denial |
| HCD-34 | Fifteen routes × default/Arabic RTL/reduced-motion/locked-density page-content axe; mounted language/editor, page-size/table and export-policy checks |

Choose Quality, select a period/facility and open a worklist record. Resolve blocking validation before submitting a result; another permitted actor verifies it and a separate actor approves it. Use Reports to design sections, preview actual demo data and save before printing or preparing a submission. Authority recipients, report delivery and clinical events are fictional. Review the frozen checksum/history and Audit after commands.

The existing provider chain and public renderer registry are extended without restructuring. Authority and report metadata configure typed public form-designer fields/panels. Report-section schemas, charts, event geometry and review orchestration remain product components. AsyncLookup, Source* controls, SourceDialog, tables/tabs, PrintDocument and ScreenHost are reused. The configured HTTP adapter supplies only the fixed namespace and routing metadata; the unchanged API establishes permissions, actor identity, scope, transactional replay, versions and separation of duties.

Host preferences govern applicable controls, formatting, typography, table presentation/page size, motion and direction. Managed values replace conflicting mounted presentation without discarding editor input. CSV actions disable when the effective export format is unsupported. Schedule zone/delivery format and analytical output geometry are domain contracts. There are no custom accelerators or physical-device workflows. Shared canonical catalogs are fetched at runtime; no local translation catalog is copied.

Validation and conflict refusals retain input and require explicit resolution. Ambiguous command retries keep their operation key. Read cancellation and response fencing prevent obsolete scope data from appearing. No new durable-draft service is claimed. All source tests are ported; generator parity checks verify frozen generated CSS/alias identities, and notification checks use the shared host.

No Quality destination is deferred. Real authority/event connectors, continuous production scheduling, native execution, human language/domain review and assistive-technology acceptance remain separate. Software checks over fictional data do not establish regulatory, clinical or financial acceptance. No deployment, commit or push is part of this increment.

## SurgiSuite increment

Phase 6b-7 ports eight sidebar destinations and the dynamic twelve-section case workspace into the existing app, now **174 menu destinations**. See the [app usage/routes](../../demo-apps/healthcare/README.md#surgisuite--phase-6b-7), [source behavior](surgisuite-reference.md) and [delivery record](../releases/unreleased/restructure-phase-6b-7-2026-10-23.md).

| Case | User flow and contract |
| --- | --- |
| HCD-35 | Header/sidebar, all twelve case sections, real identifier refresh and trusted API actor |
| HCD-36 | Patient registration, keyboard diagnosis/procedure lookups, team/equipment and theatre/time booking |
| HCD-37 | Conflict/incomplete-booking refusal, successful operation replay and retained failed editor input |
| HCD-38 | Case update and operative draft save/reload, readiness guards, simulated signing and archived amendments |
| HCD-39 | Inventory receipt, approval decision, procedure metadata save and cancellation with retained case/audit history |
| HCD-40 | Viewer presentation/server refusal, branch isolation and disabled module login |
| HCD-41 | Nine route patterns across default, Arabic RTL, reduced motion and tenant-locked density; case-section axe, shortcut cleanup and mounted editor retention |

Use Book case from the board or Schedule, complete all four steps and resolve reported conflicts. Open the case to review readiness before recording milestones, consent, checklist/counts, anesthesia, materials, scores, coding, report or claim actions. Signed reports require amendment before further editing. The API enforces source roles and workflow guards; UI visibility is not authority.

The provider chain stays SessionProvider → PreferenceHost → LocalizationProvider → ShellProvider. The public renderer registry dispatches the product module. CollectionView supplies Cases; TemplateFields supplies patient/procedure metadata; AsyncLookup, Source* controls, SourceDialog and ScreenHost replace duplicate infrastructure. Original surgical timeline/chart geometry and twelve-section orchestration stay demo-owned. The fixed API namespace is applied by the adapter to the configured authenticated HTTP callback. Scope disposal aborts requests; generation fences reject late reads. Ambiguous write retries keep their operation identity, definitive refusals release it, and recoverable failures preserve values. No new durable draft or concurrency contract is claimed.

Applicable presentation follows effective host preferences/tenant locks, including typography/scales/radius, table settings, formatting, direction, motion and shortcut enablement. Daily timelines and bounded source queues are not paginated; page size has no source contract here. USD remains the backend denomination. Preview/export/device settings are inapplicable where the source supplies no corresponding control. Canonical catalogs remain backend-owned and unchanged; local bundles replace the external source font request.

All destinations and original tests are included. Synthetic PINs, signatures, tariffs, inventory and clinical records demonstrate source behavior only. Production clinical authorization, real patient/payer/inventory/devices, native executables, human language/domain and assistive-technology review remain separate. No deployment, commit or push is part of this work.

## MedBand Patient Access — HCD-36

Seven sidebar destinations and two additional route patterns preserve Today, patient search/registration/wristband record, encounters, admission requests/queue and episodes/cases. Tenant Admin is outside this demo. The [app guide](../../demo-apps/healthcare/README.md#medband-patient-access) explains navigation, preferences and recovery; [delivery evidence](../releases/unreleased/restructure-phase-6b-8-2026-10-23.md) separates UI writes, direct HTTP checks and mocked tests.

| Case | Expected result |
| --- | --- |
| HCD-36-A | Header/sidebar and deep links resolve all nine patterns; malformed routes show not-found |
| HCD-36-B | Registration validates, preserves failed values, saves and reloads the wristband record; search and keyboard lookup select actual API records |
| HCD-36-C | New episode and outpatient encounter preserve patient/case/episode relationships; status progression persists |
| HCD-36-D | Admission request, clearance, bed allocation, discharge and case/episode closure follow source server guards |
| HCD-36-E | Same-key replay is stable; changed content, unauthorized commands and cross-branch reads are refused or isolated |
| HCD-36-F | Mounted edits survive effective preference/language changes; default, Arabic RTL, reduced-motion and locked-density routes pass automated page-content axe |

SessionProvider → PreferenceHost → LocalizationProvider → ShellProvider remains unchanged. The configured adapter maps module-relative requests to `/reference-modules/medband/api/...`; the server establishes identity/role/scope. Public CollectionView and TemplateFields own ordinary table/form rendering; AsyncLookup, Source* controls, SourceDialog and ScreenHost own shared interaction. The demo owns visit, coverage, admission and wristband composition under CMP-04. Errors retain backend status/code/field; ambiguous attempts retain retry identity; unmount aborts pending operations and fences obsolete responses. Counter choice is scoped workstation storage only. No durable clinical draft, live device, payer/bank, native executable, native-language/domain or clinical acceptance is inferred.

## MedSlot increment — HCD-42

All twelve original destinations, patient/resource details and the four-stage booking flow extend the existing healthcare app. See the [app usage/routes](../../demo-apps/healthcare/README.md#medslot-scheduling--phase-6b-9), [source behavior](medslot-reference.md) and [delivery record](../releases/unreleased/restructure-phase-6b-9-2026-10-23.md).

| Case | User flow and contract |
| --- | --- |
| HCD-42-A | Header/sidebar exposes twelve destinations including Calendar; patient/resource details retain real identifiers and refresh |
| HCD-42-B | Register with consent, retain failed input, persist the record and select patients by keyboard lookup |
| HCD-42-C | Patient → service → available resource/time → visit details → booking, with successful replay and conflict refusal |
| HCD-42-D | Confirm, change duration, reschedule and cancel; retain predecessor, reasons, audit and simulated notifications |
| HCD-42-E | Resource schedules, setup and administrator/scheduler/provider restrictions; branch and provider-resource isolation |
| HCD-42-F | Fourteen route patterns × default/Arabic RTL/reduced-motion/locked-density axe; mounted input, effective page size and shortcut cleanup |

Patient fields and collections configure public TemplateFields and CollectionView. AsyncLookup, Source* controls, SourceDialog and ScreenHost supply shared behavior; scheduling/calendar geometry and orchestration remain product components. SessionProvider → PreferenceHost → LocalizationProvider → ShellProvider stays unchanged. The adapter uses configured authenticated HTTP; the unchanged API owns trusted scope, authorization, serialization, validation, durable replay and actor attribution.

Use Book appointment to search/register, choose a service and available time, then enter a reason and book. Resolve a capacity/patient conflict by selecting refreshed availability. Other recoverable errors preserve input for explicit retry. Identical ambiguous retries keep their command identity; confirmed refusals release it. No new durable draft contract is introduced. Change permitted status, duration or time from the appointment drawer; cancellation and rescheduling keep historical evidence. Setup edits require the appropriate source role, and host identities cannot be changed through the source roster.

Applicable host presentation and policy locks govern forms, results, tables, formatting, motion, direction and accelerators. Facility clocks remain wall-clock values. Appointment/audit pagination follows effective page size; bounded calendars/lookups do not add pagination. Resource/status colors and timeline geometry remain domain data. Canonical catalogs are loaded from the backend, and bundled host fonts replace the external source request. No export/designer/device workflow is inherited here.

No MedSlot destination is deferred. Automated software checks over fictional records do not establish clinical/financial, live notification/provider, physical-device, native executable, human language/domain or assistive-technology acceptance. The earlier consultation composer/ambient recorder and later backend relocation/consumer migration/publication remain separate.

MedSlot’s four observed registration fallback labels are Emergency contact name, Emergency contact phone, Insurance provider and Policy or member number. Their canonical entries are absent in all four languages. This inherited catalog gap remains explicit; the 505-alias coverage check does not claim every source string is translated.

Regression corrections in 6b-9: the Suite appointment board remains reachable by Tab when past slots provide no interactive children; RCM removes disabled shortcut listeners in the same commit as accepted preferences.

## AllyVora Patients — HCD-AV

The fourteenth header app is AllyVora Patients (short label Patients), with Patient register and Register a patient: healthcare now has 195 menu destinations. The [app guide](../../demo-apps/healthcare/README.md#allyvora-patients--fourteenth-app) gives URLs, setup and user steps; the [standalone feature](allyvora-patients-demo.md) defines the same 99-field form, nine sections, five layouts, wristband, rules drawer, activity and confirmed status changes. [Delivery evidence](../releases/unreleased/healthcare-allyvora-patients-2026-10-26.md) records local verification only.

The existing healthcare host provides session/preferences/localization/shell exactly once. Module-specific API state and UI grants are scoped to the authenticated identity. Effective preferences and tenant locks remain authoritative; the shared Forms preferences replace the removed organisation layout setup. UI registration permissions match standalone; the unchanged API's simulated user and lack of server role enforcement remain visible limitations. API failures, 422 fields and stale 409 edits preserve entered values; transient drafts disappear on module exit/reload/identity changes.

| Acceptance | Contract |
| --- | --- |
| HCD-AV-01 | Fourteen header apps; two patient entries, collision-free prefixed routes and query modes; Suite URLs unchanged |
| HCD-AV-03/04 | Register filters/search/refresh, record wristband, section editing, saved values and activity |
| HCD-AV-06/07 | Rules drawer, duplicate warnings, memory draft/signature restore, validated registration and MRN |
| HCD-AV-08/09 | Confirmed status changes; shared Preferences Forms, new/edit/view in five layouts and tenant locks |
| HCD-AV-10 | Shared preference updates and EN/AR browser axe; four-profile unit/host matrix includes managed preferences |
| HCD-AV-PACK | Self-contained schema 2 backend with Node 24 Linux SQLite prebuild; packaged same-origin register/create/view/edit/status/audit/layout smoke |

The healthcare Layout setup page is removed; use Preferences → Forms. The standalone app retains its original settings workflow. Original standalone deferrals, human language/accessibility review, clinical acceptance and production identity enforcement remain outside this software demo. Local archives and smoke checks do not deploy it. The reviewer must add the [documented Compose service and web environment](../development/TEST-SITE.md#allyvora-patients-backend-in-schema-2) before activating its workflows on the test site.
