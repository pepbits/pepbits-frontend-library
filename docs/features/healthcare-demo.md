# Independent healthcare demo

Feature ID: HCD. State: implemented subset; local verification and outstanding checks are recorded in the [6b-2 delivery record](../releases/unreleased/restructure-phase-6b-2-2026-10-23.md). Test guide: [1.0.0](../testing/v1.0.0/PRE-COMMIT.md). No deployment or clinical acceptance.

## User problem and outcome

Healthcare product screens can now run in a separate Next.js app through public library exports, without importing the desktop workspace or another demo. The first subset covers the Healthcare Suite core, patient query/record/360, clinical documents, registration, billing and care-page designs. Phase 6b-2 adds all 55 LIS1/LIS2/RIS1 menu destinations and their detail/viewer/print routes. The [app guide](../../demo-apps/healthcare/README.md) lists all routes and setup.

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
| HCD-06 | Public package boundaries, forced root CI, builds, documentation and protected-path/source checks |

Exact case/file counts and failures are in the delivery record. Later runs cover pharmacy, RCM, teleconsult, quality, SurgiSuite and MedBand/MedSlot. The standalone four-layer consultation composer and ambient speech recorder are deferred; no empty destination is exposed. Native windows, a production speech/AI provider, licensed terminology and medical/domain sign-off remain out of scope. The Suite API has no generic versioned master-draft contract; no durable master draft or concurrency guarantee is added.

## Operations and support

Use Node 24 for the demo API. Missing generated API runtime files require the API's normal build environment or explicitly verified existing artifacts; the integration script records which method it used. Configuration errors, authorization failures and validation messages should be diagnosed through the API response and retained source-scoped evidence. No credentials, authorization headers or passwords belong in logs. Remove the new app/configuration to stop using this demonstration; original desktop consumers and backend files remain unchanged.

## Diagnostic user flow and boundaries

Select LIS1, LIS2 or RIS1 in the header and open the needed sidebar workflow. Register a fictional patient, search the saved record, then follow its order/sample or radiology worklist links. Laboratory collection, accession, result entry, validation/signing and critical alerts use the original API commands. RIS reception, scheduling, technologist and reading pages use the same authenticated branch. Read-only actors cannot gain authority through a browser control; server permissions remain decisive.

The product modules configure public TemplateFields/CollectionView and reuse shared controls, dialogs, tabs and notifications. The diagnostic adapter sets module/branch routing metadata on the host's authenticated HTTP callback. Changed resource paths and branch transports discard stale data. Patient validation failures preserve entered values and allow explicit retry. No new durable draft or transaction guarantee is introduced.

Effective table/font/format/motion preferences apply; locked page size cannot be changed locally. Work-queue/lookup service limits, print-template geometry, tube cap colors and DICOM pixels are domain-specific. Shared catalogs are fetched at runtime. Existing source wording without a canonical translation remains fallback text; automated Arabic/RTL checks are not native-speaker approval.

Phase 4c adoption is a post-merge follow-up for generic label-printing, form-designer and device-integration patterns/adapters. Printed output, report signing, all detailed DICOM tools, real analyzers, native hardware and domain acceptance are not established by route rendering or automated axe. The app guide and delivery record state the exact verified workflows.
