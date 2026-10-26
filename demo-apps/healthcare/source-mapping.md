# Healthcare source map

Phase 8 note: original-tree paths below describe the historical import source at the recorded base. That tree is now retired; current runtime uses this demo and public root packages.

Sources remain untouched in the original desktop workspace. Destinations below are in this demo unless a public package is named. See the [current 6b-7 record](../../docs/releases/unreleased/restructure-phase-6b-7-2026-10-23.md) and the increment records below for source-scoped validation and deferrals.

| Original source | Destination / treatment |
| --- | --- |
| `reference-healthcare-suite/src/app`: dashboard, patients, appointments, encounters, approvals, billing, contracts | `src/modules/suite/app`; original product workflows and API contracts |
| Suite master definitions, reference pickers, day fields | `src/modules/suite/lib/masters.ts`, `components/masters`; generic master workspace replaced by `master-page.tsx` configuring public WorklistPage/RecordPage/TemplateFields |
| Suite generic DataTable, tabs, toast and CSV writer | Thin public CollectionView/Pagination, Tabs, ScreenHost and worklist export adapters; no copied generic renderer/writer |
| Suite API/session/cache/hooks/format | Demo-scoped host and HTTP adapters; session/facility/write authority remains API-owned |
| `erp-screens/src/clinical-templates` | `src/modules/clinical-templates`, including ClinicalPatientWorkspace, query, record, 360 and product helpers/tests |
| `clinical-templates/record-layout` | Uses existing public `@pepbits/page-engines/record-layout`; no second layout renderer; product field styling retained |
| `clinical-triage`, `clinical-consultation`, `comprehensive-consultation`, `op-consultation`, `op-registration`, `clinic-billing`, `care-pages`, `clinical-document` | Matching `src/modules` directories and adapted component tests; product definitions and orchestration use public layouts/components |
| Corresponding `erp-data` healthcare adapters | `src/adapters`; host-injected HTTP transport, structured failures, patient search cancellation |
| Corresponding `erp-config` types and product definitions | `src/domain`; product-owned, not library exports |
| Clinical library-page launchers | Replaced by app navigation and renderer registry, rather than nesting the old page library |
| `erp-screens/src/consultation` (composer and recorder) | Deferred together with its specialized-editor cases; no dead route exposed |
| RCM, Pharmacy, Teleconsult, Quality and SurgiSuite | Ported in the increments below |
| MedBand/MedSlot | Remaining healthcare increment |
| Existing generic record-layout tests | Remain in page-engines; not duplicated in this app |

ClinicalPatientWorkspace's product migration into the Healthcare repository is separately owned and is not performed by this demo port.

## Phase 6b-2 diagnostics

| Original source | Destination / treatment |
| --- | --- |
| `reference-lis1/src` | `src/modules/lis1`: all 19 menu destinations and four detail routes |
| `reference-lis2/src` | `src/modules/lis2`: all 22 menu destinations, patient/order/master/sample detail and two print routes |
| `reference-ris1/src` | `src/modules/ris1`: all 14 menu destinations, patient/order/reading details, viewer and two print routes |
| `reference-diagnostics/src` | `src/modules/diagnostics`: scoped HTTP client/resource hooks, host routing/identity, barcode request, route matcher and original two client tests |
| Diagnostic transport | `src/adapters/diagnostics.ts`: configured authenticated HTTP callback, fixed module/branch headers; API remains unchanged |
| Product master lists/editors | Public CollectionView and typed TemplateFields configurations; no generic renderer copied |
| Original UI controls, tables, modal, tabs, pagination, toast | Thin product wrappers around public UI/components and ScreenHost; effective host presentation and updates |
| Original standalone login, role switching and outer shell | Excluded; public session and shell own authentication, role, module selection and sidebar |
| LIS2 report designer, labels and integration consoles | Retained product/API-specific workflows. With main phase 4c merged, assess adoption of public form-designer, label-printing and device-integration patterns/adapters; none are recreated here |

The three product packages contain no source unit tests. Both original diagnostic client cases are ported, with additional transport, stale resource, patient failure/retry, route, preference and accessibility cases. The route tables retain 71 patterns (55 menu destinations and 16 detail/viewer/print patterns). The API's clinical/provider simulations and their data remain backend-owned. DICOM canvas/windowing and print report geometry are product behavior, with shared controls; no reusable spreadsheet/designer/device engine is copied. Full detailed clinical, physical print and DICOM/analyzer acceptance remain separate.

## Phase 6b-3 Pharmacy

| Original source | Destination / treatment |
| --- | --- |
| `reference-pharmacy/src` | `src/modules/pharmacy`, all thirteen destinations and query-based record selection |
| Generic patient form and audit table | Public TemplateFields and CollectionView definitions; command mapping and filters stay product-owned |
| Generic controls, tabs, toasts, dialogs and print | Public UI/components, ScreenHost notification adapter and PrintDocument; native-layout controls added to UI |
| API client, retry keys, cache, module-relative navigation | Product client/host with `src/adapters/pharmacy.ts` using configured host HTTP, fixed namespace/branch metadata and structured failures |
| Eight original test files | All 63 cases retained/adapted; new transport, mounted preference, recovery, route/RTL/axe cases added |
| Source CSS and copy aliases | Frozen scoped stylesheet plus demo overrides, canonical message-key aliases; no backend translation catalog copied |

Receipt geometry, chart bars, stock/prescription stages and multi-pane product orchestration remain specialized demo components. No phase 4c renderer is copied. The earlier source CSS generation check becomes a frozen-baseline hash check; source-copy generation becomes canonical alias/placeholder and explicit catalog-gap verification. No standalone identity or staff switcher is imported.

The reusable Pharmacy lookup interaction lives in public `@pepbits/ui` AsyncLookup; its demo wrapper supplies only product endpoints and row content. Five native-layout field/button primitives and seventeen icon exports are the other library additions.

## Phase 6b-4 RCM Workspace

`desktop-clients/packages/reference-rcm` maps to `src/modules/rcm`; all forty original destinations and eight groups are retained. Four dashboards plus thirty-six metadata resources use the existing host renderer. Original nine test files are retained with public-host adaptations (the real-browser wrapper reads the integration receipt). Creation/edit/action field layouts use TemplateFields, list columns use CollectionView, lookup behavior uses AsyncLookup, notifications use ScreenHost and specialized overlay frames use public SourceDialog. The configured adapter maps to the unchanged RCM API. Source CSS is retained as a provenance baseline with host-preference overrides; exact old default pixel geometry is replaced by shared-engine presentation. Financial document, chart, board and lifecycle geometry remains product UI. No source/backend relocation or deletion occurs.

## Phase 6b-5

`reference-teleconsult/src` maps to `src/modules/teleconsult` with all nine original module test files plus the four host-registry cases. The module retains Provider and Patient workflow components, typed route/session/command contracts and scoped source CSS. The app owns host navigation and configured HTTP adapters. Patient collections and registration forms configure public engines; lookup, source controls, overlays, notifications and printing reuse public components. The nineteen primitive icon exports are the only library addition. No original source or backend is edited. [Delivery](../../docs/releases/unreleased/restructure-phase-6b-5-2026-10-23.md).

## Phase 6b-6 Quality

`reference-quality/src` maps to `src/modules/quality`; all twelve sidebar destinations, the indicator/report records and designer retain their API contracts. The configured HTTP adapter and thin product host connect the existing session/navigation/preferences. All ten source test files (79 original cases) are retained with public-host adaptations. Frozen CSS and alias identity checks replace desktop-only generators; notification assertions target ScreenHost. Authority and report metadata configure public form-designer TemplateFields; report-section panels reuse DesignerPanel and the indicator chooser uses AsyncLookup. SourceDialog supplies modal lifecycle; shared tables/tabs/printing/notifications are reused. KPI/report section geometry, event timelines, assurance orchestration and schedule definitions remain product UI. Five direct icon exports and keyboard access for shared table rows/scroll containers are the library additions. No original source, backend or generated canonical catalog is changed. [Delivery](../../docs/releases/unreleased/restructure-phase-6b-6-2026-10-23.md).

## Phase 6b-7 SurgiSuite

`reference-surgisuite/src` maps to `src/modules/surgisuite`: eight original sidebar pages and the twelve-section case workspace. The single original test file retains all 20 cases with public-host/catalog adaptations; the original browser scenario inventory is covered by the real-HTTP driver and sidebar sweep. Product host and configured HTTP adapter replace the old package dependencies. Cases uses public CollectionView; patient/procedure forms use TemplateFields; code lookups use AsyncLookup; dialogs and notifications use SourceDialog and ScreenHost. Surgical timelines, charts, sections and booking orchestration remain demo-owned. Source CSS/alias provenance is retained; separate overrides apply effective preferences. Three direct icon exports replace the source icon renderer. No protected source or canonical catalog changes. [Delivery](../../docs/releases/unreleased/restructure-phase-6b-7-2026-10-23.md).

## Phase 6b-8 MedBand Patient Access

`reference-medband/src` maps to `src/modules/medband`; all seven sidebar destinations, the admission-request form and dynamic wristband record retain their source API behavior. The configured adapter and product host reuse the existing provider chain. Encounter rows configure CollectionView; registration contact metadata configures TemplateFields; patient picking uses AsyncLookup; native controls, dialog lifecycle and notifications use Source*, SourceDialog and ScreenHost. Clinical workflow composition, wristband/visit geometry and filter content remain demo-owned.

All thirteen source test files are ported. Generator checks compare frozen stylesheet/alias provenance; class checks exclude the specifically engine-owned layouts; the optional machine-specific merge checks now compare all 106 source calls and every pair of 238 utilities against a retained tailwind-merge oracle. The browser wrapper validates the real-HTTP receipt instead of starting another server inside Vitest. Default pixel parity is not claimed for shared engines, notifications or accessibility corrections. Six direct icon exports are the only library additions. Tenant Admin, protected paths and canonical catalogs remain unchanged. [Delivery](../../docs/releases/unreleased/restructure-phase-6b-8-2026-10-23.md).

## Phase 6b-9 MedSlot

`reference-medslot/src` maps to `src/modules/medslot`: twelve original sidebar pages including Calendar, patient/resource details and booking. Both original test files retain all 19 cases with public host/navigation adaptations. The original browser sidebar/detail/dialog/actor/role scenarios run through the independent real-HTTP launcher; shared controls intentionally use effective host geometry rather than a fixed 40-pixel acceptance rule. New tests cover malformed paths, configured HTTP, retries/cancellation, managed page size, keyboard lookup, mounted edits and 56 route/profile cases.

Patient registration metadata configures public TemplateFields, patient rows configure CollectionView, and patient/global search use AsyncLookup. Source* controls, SourceDialog and ScreenHost replace duplicate infrastructure. Calendar and scheduling composition remain demo-owned. Frozen scoped CSS and alias mappings retain source provenance; separate overrides enforce host presentation. Two temporal SourceInput wrappers and seven direct icon exports are the generic additions. The app pins the source's `tailwind-merge` 3.7.0 utility instead of cloning its resolver. Protected source/backend/catalogs are unchanged. [Delivery](../../docs/releases/unreleased/restructure-phase-6b-9-2026-10-23.md).

Phase 6b-9 also fixes shared shell solid-notification contrast, discovered with a live reschedule dialog and visible success toast. Chromium regression checks all four tones in both light and dark themes.

## AllyVora Patients — 26 October 2026

Provenance: standalone `demo-apps/allyvora-patients` at `b3cc2e357e0b419d1c6f00946736e7c6a133c688`, itself adapted from the read-only `source/allyvora-patients`. The [standalone mapping](../allyvora-patients/source-mapping.md) lists original responsibilities; [module provenance](src/modules/registration/provenance.json) retains original hashes. The dependency gate explicitly forbids demo-to-demo runtime imports. We therefore use the owner-authorized copy fallback rather than add a private-demo dependency or put a healthcare-specific feature into a generic public library. Standalone runtime UI is unchanged; its integration wrapper now shares the root service launcher.

| Input | Healthcare destination / adaptation |
| --- | --- |
| Standalone `src/modules/registration` | Same path: form, five layouts, list, editor, record, wristband, rules drawer and organisation setup; navigation imports use module `routes.ts` |
| Standalone navigation and renderer | Module `routes.ts`, healthcare navigation/renderer and `host.tsx`; `/allyvora-patients` prefix, three entries, one existing application host; original UI roles registered as `allyvora-*` actions on the existing screen host, with no nested host context |
| Standalone typed client and proxy | `src/adapters/allyvora.ts`, `src/app/allyvora-api/[...segments]/route.ts`; same error/HTTP contract |
| `@allyvora/shared` | Unchanged `file:../../source/allyvora-patients/packages/shared`, transpiled by Next; same TypeScript compatibility setting as standalone |
| Standalone adapter/workflow/profile/host tests and fictional fixtures | Healthcare adapter tests, registration tests and `src/test/allyvora`; prefixed UI URLs, unchanged API expectations |
| Standalone Chromium journeys | `scripts/allyvora-flows.mjs`: current healthcare session, fourteen-app selector, real HTTP create/view/edit/status/layout, rules/draft and EN/AR axe; expected concurrent 409 remains tested in standalone and unit cases |
| Source backend build and lockfile | Root `tooling/deployment/allyvora-backend.mjs` builds a disposable copy and packages `dist`, production modules and build/native provenance; protected inputs unchanged |

Existing healthcare modules/routes and original inputs are preserved. All standalone adaptations (simulated API authority, memory-only drafts, English-specific wording, pointer signature and no global patient command source) remain applicable.
