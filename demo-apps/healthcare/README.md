# Healthcare demo

Private `@pepbits-demo/healthcare`: Next.js 16.3.3, React 19.2 and Tailwind 4.1. Phases 6b-1 through 6b-9 provide the Healthcare Suite core, clinical workspaces and LIS1/LIS2/RIS1 diagnostics, Pharmacy-1, RCM Workspace, Teleconsult Provider/Patient, AllyVora Quality, SurgiSuite, MedBand Patient Access and MedSlot through public `@pepbits/*` exports. All patient and operational data is fictional. The existing demo HTTP API serves the reference modules; AllyVora Patients uses its separate Express/SQLite API. This is a software demonstration, **not clinical acceptance**, a production health record system or a deployed release.

## Run locally

From the repository root:

```sh
npm install
# In another terminal, with Node 24 and the API runtime dependencies available:
node mock-api/server.mjs
# Direct API mode; use the API's configured port and allowed frontend origin:
NEXT_PUBLIC_API_URL=http://localhost:3330 npm run dev -w @pepbits-demo/healthcare
```

Read the [API setup guide](../../mock-api/README.md) for its actual port/environment and generated runtime requirements. The existing desktop `dev:api` script supplies its development defaults; it is not run by this app. Dev/start use port **3310**. Sign in using an account from the local API fixtures; credentials are deliberately absent from this guide and evidence.

An optional same-origin proxy avoids cross-origin configuration. Put these environment variables in an ignored `.env.local` file inside this app, using your actual API port:

```dotenv
NEXT_PUBLIC_API_URL=/api
HEALTHCARE_API_URL=http://127.0.0.1:3330
```

`NEXT_PUBLIC_API_URL` is required at build time. `HEALTHCARE_API_URL` is server configuration for the optional proxy; it is never sent to a component. The proxy forwards only the API contract headers and does not follow redirects. Do not expose this synthetic API as a production service.

```sh
npm run typecheck -w @pepbits-demo/healthcare
npm test -w @pepbits-demo/healthcare
npm run build -w @pepbits-demo/healthcare
npm run start -w @pepbits-demo/healthcare
npm run test:integration -w @pepbits-demo/healthcare
```

Build before integration. `HEALTHCARE_BUILD_DIR` optionally isolates Next output from a concurrent dev server. Integration starts the shared API, AllyVora API and web server on free loopback ports with temporary API storage and stops its own process groups. Set `HEALTHCARE_API_NODE` if the default Node executable is older than 24. If generated API runtimes are missing, `HEALTHCARE_RUNTIME_ARTIFACTS` may point to an existing `mock-api` checkout: the script first compares every tracked API source file, then records hashes of reused runtime entry points. This is artifact reuse, not a runtime rebuild. It never edits the original API or desktop sources. On this machine Chromium requires `LD_LIBRARY_PATH=$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu`.

## Modules and routes

There are **196 menu destinations** across fourteen header apps, plus patient/encounter/master creation and record links and patient-specific clinical links. [Source mapping](source-mapping.md) records the port and exclusions. [Navigation](src/navigation.ts) is the route/page registry; [renderer](src/renderer.tsx) registers suite, clinical, diagnostic, pharmacy, RCM, Teleconsult, Quality, SurgiSuite, MedBand, MedSlot and preferences engines. Unknown paths show a not-found state. The root uses the effective default module; deep links retain their destination.

| Module | Destinations and implementation |
| --- | --- |
| Suite core | `/suite`, `/suite/patients`, `/suite/appointments`, `/suite/encounters`, `/suite/approvals`, `/suite/billing/hospital`, `/suite/billing/pharmacy`, `/suite/billing/invoices`, `/suite/contracts`; product components in `src/modules/suite` |
| Suite masters | `/suite/masters/{facilities,departments,specialties,providers,payers,tpas,insurance-plans,networks,price-lists,items,services,resources,resource-schedules,resource-blocks}`; configurations use public WorklistPage, RecordPage and TemplateFields |
| Patient workspace | `/patient-query`, `/patient-record`, `/patient-360`; `src/modules/clinical-templates`, including ClinicalPatientWorkspace |
| Clinical documents | `/clinical-triage`, `/clinical-consultation`, `/op-consultation`, `/comprehensive-consultation`; clinical product definitions compose shared record layouts and controls |
| Registration/billing | `/op-registration`, `/clinic-billing` |
| Care pages | `/emergency-registration`, `/inpatient-admission`, `/consultation-entry-design`, `/consultation-entry-v2` |
| LIS1 | `/lis1`: 19 laboratory destinations, plus order/billing/report/master details |
| LIS2 | `/lis2`: 22 laboratory destinations, plus patient/order/master/sample details and print pages |
| RIS1 | `/ris1`: 14 radiology destinations, plus patient/order/reading details, DICOM viewer and report/invoice print pages |
| Pharmacy-1 | `/pharmacy`: all thirteen Phial destinations, including query links to prescriptions, patients, stock, orders, sales, purchases, authorizations, claims and remittances |
| RCM Workspace | `/rcm`: forty destinations in eight categories, plus creation, record, status, search and overdue query links |
| Teleconsult Provider | `/teleconsult-provider`: Today, Schedule, Patients and Visit notes; consultation record `/consult/:id` |
| Teleconsult Patient | `/teleconsult-patient`: Welcome, Registration, Home, Book a visit and My health; visit `/visit/:id` and signed summary `/visit/:id/summary` |
| AllyVora Quality | `/quality`: twelve original destinations; `/indicators/:id`, `/reports/:id` and `/reports/designer` relative to that prefix |
| SurgiSuite | `/surgisuite`: Theatre board, Schedule, Cases, Approvals, Patients, Inventory, Analytics and Masters & coding; case `/surgisuite/cases/:id` has twelve sections |
| MedBand Patient Access | `/medband`: Today, Find patient, Register patient, New encounter, Admissions, Encounters, Episodes and cases; `/medband/patients/:id` wristband record and `/medband/admissions/new` |
| MedSlot | `/medslot`: Dashboard, Book appointment, Calendar, Appointments, Patients, Resources & schedules, Services, Departments, Holidays, Notifications, Users & settings and Audit log; `/medslot/patients/:id` and `/medslot/resources/:id` |
| Settings | `/preferences`, public shell preferences page; shared shell login appears before authentication |

`src/domain` owns product types/configuration. `src/adapters` owns the unchanged API contracts. No runtime import reaches an old package, another demo or a library's internal source. The Suite's generic master renderer, table renderer, tabs, toasts and CSV writer were replaced with public engines/components. Small missing library capabilities are documented in the release record.

## Host contract

SessionProvider uses token-mode `/auth` endpoints. PreferenceHost loads preferences and tenant policy from `/preferences`, serializes updates with accepted revisions, and refreshes policy on focus or `pepbits-preference-policy-changed`. Failed saves keep accepted settings and disable further setting changes until reload. Every local preference control calls this host path and obeys locks/allowed values.

LocalizationProvider combines the core catalog with `/localization?productId=nexora&language=…` at runtime; no shared translation catalog is copied into the app. Before authentication the protected shared catalog is unavailable, so login identifiers receive a readable literal fallback. Language changes keep editors mounted. Canonical translation content and human wording review remain API responsibilities.

ShellProvider receives app-owned healthcare navigation and the authenticated branch/role. `nexora`, `reference-healthcare-suite` and `library` are existing API scope identifiers, not extra product destinations. The Suite loads its authorized facility list and write capability from its API session. Browser gates are presentation controls; the API enforces authority. AI is off. Preference-backed form/result presentation and formatting use library hosts. Appointment calendar queries load the daily schedule as required by that API; they are not paginated worklist requests.

## Limits and verification

The [feature guide](../../docs/features/healthcare-demo.md) defines flows and case IDs. The [6b-9 record](../../docs/releases/unreleased/restructure-phase-6b-9-2026-10-23.md) records MedSlot and current verification. The [6b-8 record](../../docs/releases/unreleased/restructure-phase-6b-8-2026-10-23.md) records MedBand and its verification. The [6b-7 record](../../docs/releases/unreleased/restructure-phase-6b-7-2026-10-23.md) records SurgiSuite and its verification. The [6b-6 record](../../docs/releases/unreleased/restructure-phase-6b-6-2026-10-23.md) records Quality and its verification. The [6b-5 record](../../docs/releases/unreleased/restructure-phase-6b-5-2026-10-23.md) records Teleconsult and its verification. The [6b-4 record](../../docs/releases/unreleased/restructure-phase-6b-4-2026-10-23.md) records RCM. The [6b-3 record](../../docs/releases/unreleased/restructure-phase-6b-3-2026-10-23.md) records Pharmacy. The [6b-2 record](../../docs/releases/unreleased/restructure-phase-6b-2-2026-10-23.md) records the diagnostics increment and rechecks the earlier shell finding. The [6b-1 record](../../docs/releases/unreleased/restructure-phase-6b-1-2026-10-23.md) contains exact counts, source identity and known failures. Mocked component tests use synthetic HTTP responses; a separate script signs in, searches, opens a record, saves/reloads a consultation draft and runs browser axe over routes. These checks do not establish medical, payer, accessibility-assistive-technology or native executable acceptance.

ClinicalPatientWorkspace is ported here as a demo module. Moving its product copy into the Healthcare repository is a separate step. The standalone four-layer `consultation` composer and ambient speech recorder are deferred; the compact clinical, OP and comprehensive consultation workspaces are included. No speech provider or AI credentials are configured. All twelve MedSlot destinations and both detail routes are included in phase 6b-9. Tenant Admin belongs to the separate tenant-admin demo. Suite hospital/pharmacy billing is the existing core workflow, not those later product modules.

Unsaved clinical edits, explicit completion, API validation/conflicts and retry identity retain their original product behavior. Suite patient/master editors preserve input on failed saves; the Suite API does not provide the generic record engine's versioned draft contract, so durable master drafts and cross-window concurrency acceptance are not claimed. Routed web pages replace the old Suite master tab manager; no native or detached-window behavior is claimed. Full-shell and page-content axe results are reported separately in the latest delivery record.

Visual review also found the canonical shared catalog missing `template.clinical.internalCode`, which appears as a key in the patient record. Its translation belongs in the protected backend catalog; this app does not maintain a substitute shared catalog.

## Diagnostics

Choose LIS1, LIS2 or RIS1 in the shared header, then a sidebar destination. The original 55 menu entries and 16 detail/viewer/print patterns are listed in each module's `routes.json`. Registration, orders, sample collection/accession/results/signing, billing, critical alerts, masters and integration pages retain their synthetic API contracts. RIS also includes reception, schedule, technologist, reading and PACS workflows. Report documents and DICOM image geometry remain specialized product UI; generic masters and tables delegate to public engines/components.

Diagnostic requests use `/reference-modules/{lis1,lis2,ris1}/api/...` through the configured host transport. Authenticated identity, branch and module are supplied by the host; no module login, token store, role switch or cross-branch cache is added. Resource generations fence stale responses. Save failures keep patient form input for retry. Browser role checks are presentation only; the API authorizes commands.

Presentation consumes effective theme/font/scales/radius, table density/stripes/wrap/sticky headers and reduced motion. LIS2 paginated requests use effective page size and its locked control. API-bounded lookup lists and clinical work queues keep their contract limits. Printed templates, sample cap colors and DICOM pixels/windowing are domain output, not theme colors. The API owns report template settings and terminology. Keyboard accelerators respect the effective shortcut preference.

Phase 4c is merged: public spreadsheet, form-designer, label-printing, identity-devices and device-integrations are available. Adoption by the earlier diagnostic workflows remains separate. Pharmacy uses a thermal receipt preview/PrintDocument; it has no source designer, spreadsheet or physical-device workflow requiring those engines. Physical printers/analyzers, external DICOM services, detailed viewer/clinical workflows and native-language/domain review are not accepted by this port.

Integration accepts `HEALTHCARE_RESULT`, `HEALTHCARE_IDENTITY` and `HEALTHCARE_SCREENSHOTS_DIR` for receipts. `HEALTHCARE_ROUTE_FILTER` limits a route rerun; omit it for the full healthcare sweep. `HEALTHCARE_CAPTURE` captures redacted synthetic read responses and `HEALTHCARE_DICOM_FIXTURE` captures one synthetic DICOM instance for unit fixtures; never use either against real data. Services and browser are stopped in cleanup, including on failure. `HEALTHCARE_STOP_FILE` optionally names a cooperative cancellation file; create it to stop all owned services even when a command wrapper has a separate process namespace. `HEALTHCARE_TIMEOUT_MS` bounds the whole run (default 30 minutes). Keep one server/API/test tree active at a time.

## Pharmacy-1

Choose Pharmacy-1 in the shared header. Its thirteen sidebar destinations are Command center, Rx workbench, Counter sale, Customer orders, Sales and returns, Inventory, Purchasing, Prior authorizations, Claims, Remittance & payments, Patients, Audit trail and Settings. Query parameters select records and tabs; for example `/pharmacy/workbench?rx=…` and `/pharmacy/patients?id=…`. Unknown paths show not-found.

Register a fictional patient under Patients, use the search palette to find the profile, and create a prescription with a prescriber and medicine. The workbench supports intake → review → verification → supply → final check → handover, with server validation and documented reasons where required. Counter sale produces an invoice and shared receipt preview; Sales supports returns. Purchasing receives batches, authorizations record simulated decisions, and claims/remittance demonstrate simulated payer adjudication and payment posting. These are demonstrations, **not clinical or financial acceptance**.

`src/modules/pharmacy` owns product definitions, orchestration and tests. The audit collection configures public CollectionView; patient registration configures TemplateFields. Public native-layout controls, tables, cards, tabs, dialogs and PrintDocument supply shared behavior. Notifications use ScreenHost. Product queue/detail composition, prescription chain, charts and thermal receipt geometry stay in the demo. `src/adapters/pharmacy.ts` maps module-relative requests to `/reference-modules/pharmacy/api/...` over the configured authenticated HTTP callback. It never supplies an independent token store or origin.

Each authenticated tenant/application/branch/user/role scope owns a separate request/cache instance. Reads abort on unmount and discard stale replies. Commands carry an Idempotency-Key; ambiguous failures retain the key for an identical explicit retry, and definitive failures release it. Forms retain values on recoverable failure. This is transient editor state; no new durable-draft contract is claimed. Server permission checks, actor attribution and transactional replay remain API-owned.

Effective theme, font/scales/radius, table density/stripes/wrapping/sticky headers, page size, locale/formatting, motion and shortcuts follow the host. Pharmacy Settings calls the central preference update path and obeys current locks/allowed values. Currency comes from pharmacy API settings; number/date/time presentation comes from host preferences. Native date inputs retain ISO values. Receipt geometry and synthetic stock/safety statuses are domain output. Preview-mode preference applies to supported generic record-preview controls; the explicit thermal receipt command has a fixed preview dialog. No spreadsheet export or device connection is added.

All eight original test files (63 cases) are retained with public-host adaptations, plus HTTP/path, mounted preference/editor, failure/retry, route/RTL/axe tests. The integration driver reports UI workflows separately from direct HTTP commands. Canonical copy remains backend-owned; inherited aliases `Configuration` and `Pharmacy, people, appearance` have no catalog entry in any of the four languages and fall back to their source text. Native-speaker/domain review remains pending.

Pharmacy lookup adapters supply product endpoints and row content to public `@pepbits/ui` AsyncLookup. The shared control owns keyboard selection, popup semantics and stale-read cancellation; the app continues to own its authenticated transport.

## RCM Workspace — phase 6b-4

Choose **RCM Workspace** in the header. Its forty destinations keep the eight original categories: Front office, Charges and documents, Money, Insurance, Receivables, Coding and models, Accounting and Cross-cutting. The four dashboards are `/rcm`, `/rcm/aging`, `/rcm/reports` and `/rcm/approvals`; the thirty-six worklists are `/rcm/w/{resource}`. [Navigation configuration](src/modules/rcm/navigation.json) lists every destination. Query links preserve `new=1`, `open=<id>|first`, `q`, `status` and `overdue=1`. Unknown resources and malformed paths show not-found.

The module composes public TemplateFields for creation, edits and action inputs, CollectionView for resource lists, AsyncLookup for reference choices, Source* native controls and shared cards/tables. Product boards, charts, lifecycle maps, financial document geometry and command-palette orchestration remain demo components. `src/adapters/rcm.ts` binds the unchanged `/reference-modules/rcm/api/...` API to the configured authenticated request. No second session store, origin, business-data fallback or library-internal import is added.

Use the palette to open an invoice by reference, issue an eligible draft, register a receipt and allocate it, or prepare a credit note for a second person to approve. Claims support simulated submission, acknowledgements, denials and correction. The backend owns row versions, durable idempotency, actor attribution, independent approvals and branch isolation. Recoverable failures retain editor values; ambiguous command retries reuse their operation key. Browser disabled states are presentation only. Operational SAR/AED scope filters narrow the reference data without changing authenticated branch authority.

Effective host typography, theme, form/result scales, radius, table density/stripes/wrapping/sticky headers, page size, formatting, motion and shortcuts apply. Board queries retain the API's 300-record maximum to display all stages; paginated list queries follow the host page-size setting. This source has no spreadsheet/designer/device workflow. Financial documents are on-screen previews; no physical printing, live payer/bank/accounting service, certified DRG, financial acceptance, native executable or human language/domain acceptance is claimed. See the [6b-4 record](../../docs/releases/unreleased/restructure-phase-6b-4-2026-10-23.md) for exact verification and limits.

## Teleconsult Provider and Patient

Choose one of the two header modules. Provider has Today, Schedule, Patients and Visit notes under `/teleconsult-provider`; consultation records use `/teleconsult-provider/consult/:id`. Patient has Welcome, Registration, Home, Book a visit and My health under `/teleconsult-patient`; visit and signed-summary routes use `/teleconsult-patient/visit/:id` and `/teleconsult-patient/visit/:id/summary`. These are actual appointment identifiers. The phone and bottom navigation fill the remaining shell viewport.

Working modes and beneficiaries come from the authenticated API session. A Nurse completes triage and hands off to a Doctor; only an authorized Doctor can sign. Patient booking waits for current server advice, then selects a clinician, slot and allowed visit mode. The signed note becomes the own-patient summary and uses shared printing. Registration is an administrator demonstration grant, not public enrollment. Refused commands preserve inputs; unknown-outcome retries retain replay keys, and version conflicts require explicit resolution. Branch/scope changes abort obsolete reads.

The unchanged API is reached through `src/adapters/teleconsult.ts`; the same-origin proxy forwards role, patient and replay headers. Registration fields configure TemplateFields; patient collections configure CollectionView with effective managed page size. AsyncLookup, Source* controls, SourceDialog and notifications reuse the public library. Fonts, scales, dates, table presentation, shortcuts and motion consume effective host preferences. CareCall retains the source light palette; video, device frames, transcript, advice and scribe are simulations. Browser media previews stay local. No real prescription/order/charge is posted.

The [6b-5 delivery record](../../docs/releases/unreleased/restructure-phase-6b-5-2026-10-23.md) records exact tests and local HTTP evidence. Original source behavior is documented in the [Teleconsult guide](../../docs/features/teleconsult-reference/README.md). No live identity/media/signalling, secure attachments, physical devices, native executable, clinical acceptance or human language review is established.

## AllyVora Quality — phase 6b-6

Choose **Quality** (AllyVora Quality) in the header. The twelve sidebar destinations retain the original groups: Dashboard; Indicators, Turnaround times and Event Pulse; Verification and Validation; Reports, Schedules and Submissions; Authorities, Users and roles, and Audit trail. Users/Audit and the designer follow authenticated role grants; the API independently authorizes reads and commands. Record links carry actual indicator/report IDs. Query links preserve designer `id`, verification `queue`, submission `open` and audit `user`.

Use Authorities → Add authority to enter a fictional recipient through shared TemplateFields and SourceDialog. The designer uses public `@pepbits/patterns/form-designer` metadata fields and panels, and `@pepbits/ui` AsyncLookup for indicators. Its eight report section kinds, preview and source report schema remain product components: they describe analytical output rather than the DCP data-entry schema. Report rendering, KPI bands, event stages, review queues and schedules retain specialized product composition (CMP-04). Tables, tabs, controls, printing and notifications use public library components.

`src/adapters/quality.ts` maps the host's configured authenticated HTTP callback to `/reference-modules/quality/api/...`. No independent session or business-data fallback is added. Identity and page reads abort on scope changes; obsolete responses are fenced. Commands retain operation keys after ambiguous failures, release them after definitive responses and preserve editor values on recoverable refusal. Result versions and independent review/approval remain API responsibilities. Transient editor retention is not a new durable draft contract.

Effective fonts, form/result scales, radii, table density/stripes/wrapping/sticky headers/page size, date/number formats, language/direction and reduced motion follow the existing host. CSV output is disabled when the effective export format is unsupported. Report print is an explicit shared document command; generic record-preview mode is not applicable. Schedule frequency/time zone, delivery format and chart/target geometry are business data. This module adds no custom keyboard accelerator, spreadsheet, label printer or identity/device workflow.

Results support correction → submit → independent verify → independent approve. Reports support design, live preview, save, recorded runs, authenticated CSV and shared printing. Schedules run synthetic reports; submissions freeze a checksum before separate approval and simulated delivery/acknowledgement. Event Pulse and validation use fictional data; Audit verifies the hash chain. Canonical localization remains backend-owned. All ten original test files are retained with host adaptations, plus configured transport, mounted policy/editor, route/preference/RTL/axe and real local HTTP checks.

Illustrative indicators and authority delivery are demonstrations, **not regulatory, clinical or financial acceptance**. Real authority/event connectors, continuous production scheduling, human language/domain review, assistive-technology acceptance and native executables remain separate. No Quality destination is deferred. The original app/API sources are unchanged.

## SurgiSuite — phase 6b-7

Select **SurgiSuite** in the header, then one of its eight original sidebar pages. Open a case from the board, Schedule or Cases to reach Overview; Team & equipment; Diagnosis & CPT; Approvals & consent; Checklist & counts; Anesthesia record; Imaging, lab & blood; Materials & implants; Risk scores; Operative report; Charges & claim; Activity & audit. The actual numeric case identifier survives navigation and refresh. Patient `id` and inventory `flag=low` queries keep their original meaning.

Book case guides you through an existing or new fictional patient, ICD diagnosis/CPT procedures, anesthesia, team/equipment and theatre/time. Review source conflict/readiness messages before booking. Case edits and operative drafts save through HTTP. Signing uses the source simulated PIN and readiness guards; an amendment archives the previous signed version. Inventory receives synthetic stock. Masters maintains coding and preference cards; it does not change host preferences. Search opens through the toolbar or the enabled Ctrl/Cmd+K shortcut.

`src/modules/surgisuite` supplies product orchestration and definitions. Cases configures public CollectionView; patient registration and procedure metadata configure TemplateFields. Code lookups use AsyncLookup, overlays use SourceDialog, controls use Source*, and notifications use ScreenHost. Timeline, vitals, analytical geometry, clinical sections and the booking sequence remain demo components under CMP-04. Three direct primitive icon exports are the only library additions. No duplicated spreadsheet, designer, label or device engine is added.

`src/adapters/surgisuite.ts` maps to the unchanged `/reference-modules/surgisuite/api/...` over the configured host HTTP transport. Authenticated scopes own request/cache lifetimes. Reads abort and fence obsolete replies. Identical explicit command retries retain their operation key after ambiguous failures; definitive failures release it. Recoverable errors retain form values. This is transient editor retention, with API-backed explicit saves, not a new durable-draft service. Server authorization, role mapping, conflicts, transaction rollback, audit and signature/replay persistence remain API-owned.

Effective theme, font, form/result scales, radius, table density/stripes/wrapping/sticky headers, number/date/time presentation, direction, reduced motion and shortcuts follow the host and tenant locks. The source API returns bounded complete queues (cases up to 500) and daily timelines, without a paging contract; host page size is not applied to these domain queues. Native date/time inputs keep machine values. Monetary amounts retain the API's USD denomination; presentation does not convert currency. Explicit source report/claim views have no generic record-preview/export control. No physical device workflow is present. Fonts use the existing local host bundles; the external source font request is removed.

All 20 original component cases and the original browser scenarios are ported, with transport, recovery, mounted preference/editor, route/RTL/axe and actual HTTP workflow checks. All 564 alias keys exist in the unchanged English, Arabic, Hindi and Malayalam catalogs. No source/backend edits or translation regeneration is required. See the [delivery record](../../docs/releases/unreleased/restructure-phase-6b-7-2026-10-23.md) for exact results. No SurgiSuite destination is deferred. Real clinical authorization/signatures, patient/inventory/payer/device integration, human language/domain and assistive-technology review, deployment and native executable testing remain outside this fictional demonstration.

## MedBand Patient Access

Choose **MedBand Patient Access** in the header. Today shows the desk and visit queues. Find patient searches the API by identity, insurance or care criteria; open the wristband record to inspect encounters, admissions, episodes and cases. Register patient has Identity, Contact, Insurance and Review steps. New encounter uses the current workstation counter's allowed visit types and keeps the Episode → Case → Encounter relationship. Admission requests link a case or existing encounter; the queue supports authorization, deposit, rescheduling, cancellation and admission. The backend enforces coverage, follow-up and occupied-bed rules. These are fictional source simulations, not payer/bank or clinical acceptance.

The adapter uses configured authenticated HTTP at `/reference-modules/medband/api/...`. Bootstrap supplies masters, records and the trusted actor. Tenant/branch/user/role changes discard the prior store and abort requests. Ambiguous writes retain their operation key for an identical retry; refused saves retain input and show the backend error. Counter selection is scoped browser workstation state, not a presentation preference or durable clinical draft.

Encounter collections use CollectionView, contact fields use TemplateFields, patient selection uses AsyncLookup, overlays use SourceDialog and notifications use ScreenHost. Effective fonts/scales/radius, table settings/page size, formatting, direction, shortcuts and motion apply; tenant locks take precedence. Source wristband/barcode geometry and visit-type colors remain product presentation. The barcode is decorative demonstration output; no scanner, patient-identity device or label-printing acceptance is claimed. API-bounded search and dashboard queues have no pagination control. The canonical catalogs and alias map remain unchanged. Native-language/domain and assistive-technology review remain separate.

## MedSlot scheduling — phase 6b-9

Choose **MedSlot** in the shared header. The twelve original sidebar destinations include Calendar; patient and resource detail links retain numeric identifiers and survive refresh. In Book appointment, find or register a fictional patient, select a service, review its preparation/resource requirements, choose an available slot and enter visit details. Open the booking from Calendar or Appointments to confirm, check in, change its duration, reschedule or cancel when permitted. Rescheduling preserves the original booking and links the replacement. Resource details edit weekly schedules and temporary blocks; setup pages retain service/department/holiday/notification/roster rules.

`src/modules/medslot` extends the existing app structure. Patient metadata configures public TemplateFields; the patient collection configures CollectionView. Patient and header lookup use AsyncLookup, controls use Source*, overlays use SourceDialog and notifications use ScreenHost. Calendar day/week/month geometry, availability, resource composition and booking orchestration remain demo components under CMP-04. The configured HTTP adapter maps relative paths to `/reference-modules/medslot/api/...`; authentication, trusted branch/role/provider resource assignment, validation, transactions, replay and audit remain in the unchanged API.

Effective host typography, independent scales, radius, theme, table density/stripes/wrapping/sticky headers, formatting, direction, motion and shortcuts apply. Appointment and audit pagination use effective page size. Daily calendars and bounded patient/search/notification queues have no page-size control. Facility date/time strings preserve their wall-clock meaning; native inputs preserve machine values. Clinical status/resource colors and calendar positions express source data. No spreadsheet, designer, export, printer or device workflow is added. Bundled host fonts replace the external source font stylesheet.

Administrator and scheduler actions follow their server roles; mapped providers see only their assigned resource's records/calendar. Source roster credentials do not create host access. UI visibility is presentation, and direct API guards remain authoritative. Validation errors retain editor values; booking conflicts refresh availability for explicit reselection. Ambiguous identical command retries retain their operation key, definitive refusals release it, and disposal aborts pending reads and rejects obsolete replies. This is transient editor state, not a new durable draft service. Notification delivery/reminders are backend simulations.

All original component tests and browser scenario contracts are ported, alongside configured-adapter, navigation, preference/policy, keyboard, recovery and four-profile route/axe checks. See the delivery record for exact counts and live workflow boundaries. Canonical backend catalogs remain unchanged; Arabic/Hindi/Malayalam coverage does not establish human review. Fictional software demonstration only; no clinical/financial, live notification/provider, physical-device, native executable or assistive-technology acceptance, deployment, commit or push.

MedSlot registration retains four inherited English fallback labels: Emergency contact name, Emergency contact phone, Insurance provider and Policy or member number. They have no module alias or canonical entry in any supported language. Correcting these belongs in the protected backend catalog; the demo does not add a substitute translation catalog.

The 6b-9 regression sweep also makes the Suite appointment board keyboard-scrollable when all slots are past and applies RCM shortcut disablement before the next paint. These corrections preserve their existing API contracts.

## Shared host extraction in phase 6c-1

The app now consumes public `@pepbits/shell/application-providers`, `@pepbits/platform/http` and `@pepbits/platform/preference-service`. Its existing provider tests retain the preference revision, policy and language/editor contracts. The integration wrapper delegates service lifecycle to `tooling/scripts/run-demo-integration.mjs`; all `HEALTHCARE_*` environment options remain supported. ERP uses the same library/tooling exports without importing this app. The [6c-1 record](../../docs/releases/unreleased/restructure-phase-6c-1-2026-10-23.md) records the regression scope.

Phase 6d's full repository verification exposed a timing-sensitive MedSlot shortcut assertion. The test now waits for the authenticated shell's accelerator to become active, then checks that disabling shortcuts removes event cancellation and focus behavior; application code and backend contracts are unchanged. See the [6d record](../../docs/releases/unreleased/restructure-phase-6d-2026-10-24.md).

## AllyVora Outpatient — nurse intake on @pepbits/clinical

Choose **Outpatient** (AllyVora Outpatient) in the header, then Nurse intake. Module `reference-allyvora-outpatient` in `src/modules/outpatient` renders the shared [`@pepbits/clinical`](../../packages/clinical/README.md) `IntakeQueue` and `IntakeForm` with the outpatient profile.

| Healthcare URL | Workflow |
| --- | --- |
| `/allyvora-outpatient/intake` | Visits waiting for intake (arrived or in intake), stage counts for the whole clinic, safety badges; nurses start or continue intake |
| `/allyvora-outpatient/intake/<encounter>` | Intake for one visit: arrival and complaint, vital signs with live NEWS2, allergy review, screening; saving sends the patient to the doctor |

`adapter.ts` implements the clinical data port over the AllyVora clinical workspace API paths (`/encounters`, `/encounters/{id}`, `/encounters/{id}/status`, `/encounters/{id}/intake`, `/encounters/esi/preview`, `/catalog/{kind}`, `/scores/news2/calculate`, `/patients/{id}/allergies`, `/auth/me`) under `/allyvora-clinical`, sent with the demo's signed-in request client. The mock API serves fictional data there ([allyvora-clinical-store.mjs](../../mock-api/allyvora-clinical-store.mjs): six outpatient and six emergency visits, reset when the API restarts); a host with the real workspace API changes only the prefix. Clinician actions follow `/auth/me` (UI only): demo accounts act as nurses, accounts with a doctor role as doctors. See `provenance.json` for the source files, hashes and what is not ported.

## AllyVora Emergency — triage on @pepbits/clinical

Choose **Emergency** (AllyVora Emergency) in the header, then Triage. Module `reference-allyvora-emergency` in `src/modules/emergency` renders the shared `TriageQueue` and `IntakeForm` with the `EMERGENCY_TRIAGE` profile, over the same clinical data port as AllyVora Outpatient.

| Healthcare URL | Workflow |
| --- | --- |
| `/allyvora-emergency/triage` | Patients waiting for triage, longest wait first (red after 15 minutes); nurses and doctors get Triage now |
| `/allyvora-emergency/triage/<encounter>` | Triage for one visit: arrival (including how the patient arrived) and required complaint, vital signs with NEWS2, allergy review, screening, ESI decision points with the calculated level, optional override with reason, and area |

The ESI level comes from `POST /allyvora-clinical/encounters/esi/preview`; saving posts `mode: "er"` to `/allyvora-clinical/encounters/{id}/intake`. Both are served by the mock API with three patients waiting for triage. See `provenance.json` for source files, hashes, deliberate differences and what is not ported.

## AllyVora Patients — fourteenth app

Choose **Patients** (AllyVora Patients) in the header, then Patient register or Register a patient. This is module `reference-allyvora-patients` in the existing healthcare SessionProvider → PreferenceHost → LocalizationProvider → Shell. The registration context owns only API lookups and volatile drafts. No second application host is mounted.

| Healthcare URL | Workflow |
| --- | --- |
| `/allyvora-patients` or `/allyvora-patients/patients` | Register, counts, URL search/filter/sort/paging |
| `/allyvora-patients/patients/new` | New registration; optional `?section=contact` |
| `/allyvora-patients/patients/12` | Patient record: wristband, recorded values, missing details, activity and status change |
| `/allyvora-patients/patients/12/edit?section=contact` | Version-aware edit and section deep link |

Create, record and edit are dedicated pages (`allyvora-patient-new`, `allyvora-patient-view`, `allyvora-patient-edit`). Links saved before this change, `/allyvora-patients/patients?mode=new|view|edit&id=12` (with optional `&section=`), still open the matching page; the app always writes the new URLs.

The same 99-field, nine-section definition and all five layouts from the [standalone guide](../allyvora-patients/README.md) apply: single page, tabs, guided steps, side steps and accordion. Register → New patient → complete required fields/consent → Save opens the record with its MRN. Edit a section, inspect Activity and confirm Mark inactive/Make active. Check form rules opens the rules drawer and jumps to missing fields. Every user chooses these options in **Preferences → Forms**, subject to tenant defaults, locks and allowed values. Layout setup has been removed from healthcare. `RecordForm`, `RecordSectionCard`, `RecordSummaryBand` and `FormRulesDrawer` provide the presentation from public packages; new/edit/view all follow the five layouts.

Shared presentation, formatting, table/card view, page size, language direction, reduced motion and shortcut settings use effective healthcare preferences and tenant locks. Module UI grants match standalone: registration/edit/status for enterprise-admin, admin, operations-analyst and finance-manager. The unchanged AllyVora API has simulated identity and no role enforcement: its audit names its seeded user, not the shell actor. Its English form copy and standalone limitations remain explicit in the [feature contract](../../docs/features/allyvora-patients-demo.md).

Recoverable failures retain form values, 422 errors identify fields, and stale 409 saves keep edits for resolution. Drafts are memory only, cleared by reload, sign-out, identity/branch/role change or leaving the registration module (including another header app or Preferences). No patient values enter browser storage. Unknown prefixed routes show not found, including malformed record paths such as `/allyvora-patients/patients/abc` or `/allyvora-patients/patients/0/edit`; a legacy `?mode=` link with a malformed `id` returns to the register.

Build with `NEXT_PUBLIC_ALLYVORA_API_URL=/allyvora-api` alongside `NEXT_PUBLIC_API_URL=/api`. At runtime set `ALLYVORA_API_URL=http://127.0.0.1:33415` and the existing `HEALTHCARE_API_URL` for shared authentication/preferences. The new same-origin proxy forwards `/allyvora-api/*` to the backend's `/api/*`; the server target is never public configuration. Start the packaged backend with `node dist/server.js`, working directory `src/allyvora-backend`, `PORT=33415` and a persistent `DB_PATH`. See the exact [test-site Compose contract](../../docs/development/TEST-SITE.md#allyvora-patients-backend-in-schema-2).

`node tooling/scripts/run-demo-integration.mjs healthcare` builds the backend from a temporary copy, installs the locked prebuilt SQLite dependency, uses free ports and temporary databases, runs existing and new browser journeys/axe, and stops all services. It never writes into `source/`. The source mapping explains why the module was copied; standalone UI stays independent. [Delivery and exact verification](../../docs/releases/unreleased/healthcare-allyvora-patients-2026-10-26.md).

See the [0.2.0 record-form delivery](../../docs/releases/unreleased/record-form-engine-2026-10-26.md) for the current package APIs, migration and verification. The editor retains its hidden title, compact summary and 8px top gap.
