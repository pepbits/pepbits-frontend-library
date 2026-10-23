# Healthcare source map

Sources remain untouched in the original desktop workspace. Destinations below are in this demo unless a public package is named. See the [6b-1 record](../../docs/releases/unreleased/restructure-phase-6b-1-2026-10-23.md) and [6b-2 record](../../docs/releases/unreleased/restructure-phase-6b-2-2026-10-23.md) for source-scoped validation and deferrals.

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
| LIS2 report designer, labels and integration consoles | Retained product/API-specific workflows. After merging main phase 4c, assess adoption of public form-designer, label-printing and device-integration patterns/adapters; none are recreated here |

The three product packages contain no source unit tests. Both original diagnostic client cases are ported, with additional transport, stale resource, patient failure/retry, route, preference and accessibility cases. The route tables retain 71 patterns (55 menu destinations and 16 detail/viewer/print patterns). The API's clinical/provider simulations and their data remain backend-owned. DICOM canvas/windowing and print report geometry are product behavior, with shared controls; no reusable spreadsheet/designer/device engine is copied. Full detailed clinical, physical print and DICOM/analyzer acceptance remain separate.
