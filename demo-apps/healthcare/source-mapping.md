# Healthcare source map

Sources remain untouched in the original desktop workspace. Destinations below are in this demo unless a public package is named. See the [6b-1 record](../../docs/releases/unreleased/restructure-phase-6b-1-2026-10-23.md) [6b-2 record](../../docs/releases/unreleased/restructure-phase-6b-2-2026-10-23.md) and [6b-3 record](../../docs/releases/unreleased/restructure-phase-6b-3-2026-10-23.md) plus the [6b-4 record](../../docs/releases/unreleased/restructure-phase-6b-4-2026-10-23.md) for source-scoped validation and deferrals.

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
| Suite RCM workspaces and remaining healthcare reference products | Deferred to subsequent healthcare runs |
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
