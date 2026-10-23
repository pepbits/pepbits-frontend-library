# Healthcare 6b-1 source map

Sources remain untouched in the original desktop workspace. Destinations below are in this demo unless a public package is named. See the [release record](../../docs/releases/unreleased/restructure-phase-6b-1-2026-10-23.md) for actual validation and deferrals.

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
| Suite RCM workspaces and other healthcare reference products | Deferred to subsequent healthcare runs |
| Existing generic record-layout tests | Remain in page-engines; not duplicated in this app |

ClinicalPatientWorkspace's product migration into the Healthcare repository is separately owned and is not performed by this demo port.
