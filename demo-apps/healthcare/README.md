# Healthcare demo

Private `@pepbits-demo/healthcare`: Next.js 16.3.3, React 19.2 and Tailwind 4.1. Phases 6b-1 through 6b-4 provide the Healthcare Suite core, clinical workspaces and LIS1/LIS2/RIS1 diagnostics, Pharmacy-1 and RCM Workspace through public `@pepbits/*` exports. All patient and operational data is fictional and comes from the existing demo HTTP API. This is a software demonstration, **not clinical acceptance**, a production health record system or a deployed release.

## Run locally

From the repository root:

```sh
npm install
# In another terminal, with Node 24 and the API runtime dependencies available:
node dummy-api/server.mjs
# Direct API mode; use the API's configured port and allowed frontend origin:
NEXT_PUBLIC_API_URL=http://localhost:3330 npm run dev -w @pepbits-demo/healthcare
```

Read the [API setup guide](../../dummy-api/README.md) for its actual port/environment and generated runtime requirements. The existing desktop `dev:api` script supplies its development defaults; it is not run by this app. Dev/start use port **3310**. Sign in using an account from the local API fixtures; credentials are deliberately absent from this guide and evidence.

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

Build before integration. `HEALTHCARE_BUILD_DIR` optionally isolates Next output from a concurrent dev server. Integration starts both services on free loopback ports with temporary API storage and stops its own process groups. Set `HEALTHCARE_API_NODE` if the default Node executable is older than 24. If generated API runtimes are missing, `HEALTHCARE_RUNTIME_ARTIFACTS` may point to an existing `dummy-api` checkout: the script first compares every tracked API source file, then records hashes of reused runtime entry points. This is artifact reuse, not a runtime rebuild. It never edits the original API or desktop sources. On this machine Chromium requires `LD_LIBRARY_PATH=$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu`.

## Modules and routes

There are **145 menu destinations**, plus patient/encounter/master creation and record links and patient-specific clinical links. [Source mapping](source-mapping.md) records the port and exclusions. [Navigation](src/navigation.ts) is the route/page registry; [renderer](src/renderer.tsx) registers suite, clinical, diagnostic, pharmacy, RCM and preferences engines. Unknown paths show a not-found state. The root uses the effective default module; deep links retain their destination.

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
| Settings | `/preferences`, public shell preferences page; shared shell login appears before authentication |

`src/domain` owns product types/configuration. `src/adapters` owns the unchanged API contracts. No runtime import reaches an old package, another demo or a library's internal source. The Suite's generic master renderer, table renderer, tabs, toasts and CSV writer were replaced with public engines/components. Small missing library capabilities are documented in the release record.

## Host contract

SessionProvider uses token-mode `/auth` endpoints. PreferenceHost loads preferences and tenant policy from `/preferences`, serializes updates with accepted revisions, and refreshes policy on focus or `pepbits-preference-policy-changed`. Failed saves keep accepted settings and disable further setting changes until reload. Every local preference control calls this host path and obeys locks/allowed values.

LocalizationProvider combines the core catalog with `/localization?productId=nexora&language=…` at runtime; no shared translation catalog is copied into the app. Before authentication the protected shared catalog is unavailable, so login identifiers receive a readable literal fallback. Language changes keep editors mounted. Canonical translation content and human wording review remain API responsibilities.

ShellProvider receives app-owned healthcare navigation and the authenticated branch/role. `nexora`, `reference-healthcare-suite` and `library` are existing API scope identifiers, not extra product destinations. The Suite loads its authorized facility list and write capability from its API session. Browser gates are presentation controls; the API enforces authority. AI is off. Preference-backed form/result presentation and formatting use library hosts. Appointment calendar queries load the daily schedule as required by that API; they are not paginated worklist requests.

## Limits and verification

The [feature guide](../../docs/features/healthcare-demo.md) defines flows and case IDs. The [6b-4 record](../../docs/releases/unreleased/restructure-phase-6b-4-2026-10-23.md) records RCM and the latest verification. The [6b-3 record](../../docs/releases/unreleased/restructure-phase-6b-3-2026-10-23.md) records Pharmacy. The [6b-2 record](../../docs/releases/unreleased/restructure-phase-6b-2-2026-10-23.md) records the diagnostics increment and rechecks the earlier shell finding. The [6b-1 record](../../docs/releases/unreleased/restructure-phase-6b-1-2026-10-23.md) contains exact counts, source identity and known failures. Mocked component tests use synthetic HTTP responses; a separate script signs in, searches, opens a record, saves/reloads a consultation draft and runs browser axe over routes. These checks do not establish medical, payer, accessibility-assistive-technology or native executable acceptance.

ClinicalPatientWorkspace is ported here as a demo module. Moving its product copy into the Healthcare repository is a separate step. The standalone four-layer `consultation` composer and ambient speech recorder are deferred; the compact clinical, OP and comprehensive consultation workspaces are included. No speech provider or AI credentials are configured. Teleconsult, quality, SurgiSuite and MedBand/MedSlot remain later healthcare runs. Suite hospital/pharmacy billing is the existing core workflow, not those later product modules.

Unsaved clinical edits, explicit completion, API validation/conflicts and retry identity retain their original product behavior. Suite patient/master editors preserve input on failed saves; the Suite API does not provide the generic record engine's versioned draft contract, so durable master drafts and cross-window concurrency acceptance are not claimed. Routed web pages replace the old Suite master tab manager; no native or detached-window behavior is claimed. Full-shell and page-content axe results are reported separately in the latest delivery record.

Visual review also found the canonical shared catalog missing `template.clinical.internalCode`, which appears as a key in the patient record. Its translation belongs in the protected backend catalog; this app does not maintain a substitute shared catalog.

## Diagnostics

Choose LIS1, LIS2 or RIS1 in the shared header, then a sidebar destination. The original 55 menu entries and 16 detail/viewer/print patterns are listed in each module's `routes.json`. Registration, orders, sample collection/accession/results/signing, billing, critical alerts, masters and integration pages retain their synthetic API contracts. RIS also includes reception, schedule, technologist, reading and PACS workflows. Report documents and DICOM image geometry remain specialized product UI; generic masters and tables delegate to public engines/components.

Diagnostic requests use `/reference-modules/{lis1,lis2,ris1}/api/...` through the configured host transport. Authenticated identity, branch and module are supplied by the host; no module login, token store, role switch or cross-branch cache is added. Resource generations fence stale responses. Save failures keep patient form input for retry. Browser role checks are presentation only; the API authorizes commands.

Presentation consumes effective theme/font/scales/radius, table density/stripes/wrap/sticky headers and reduced motion. LIS2 paginated requests use effective page size and its locked control. API-bounded lookup lists and clinical work queues keep their contract limits. Printed templates, sample cap colors and DICOM pixels/windowing are domain output, not theme colors. The API owns report template settings and terminology. Keyboard accelerators respect the effective shortcut preference.

Phase 4c is merged: public spreadsheet, form-designer, label-printing, identity-devices and device-integrations are available. Adoption by the earlier diagnostic workflows remains separate. Pharmacy uses a thermal receipt preview/PrintDocument; it has no source designer, spreadsheet or physical-device workflow requiring those engines. Physical printers/analyzers, external DICOM services, detailed viewer/clinical workflows and native-language/domain review are not accepted by this port.

Integration accepts `HEALTHCARE_RESULT`, `HEALTHCARE_IDENTITY` and `HEALTHCARE_SCREENSHOTS_DIR` for receipts. `HEALTHCARE_ROUTE_FILTER` limits a route rerun; omit it for the full healthcare sweep. `HEALTHCARE_CAPTURE` captures redacted synthetic read responses and `HEALTHCARE_DICOM_FIXTURE` captures one synthetic DICOM instance for unit fixtures; never use either against real data. Services and browser are stopped in cleanup, including on failure. Keep one server/API/test tree active at a time.

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
