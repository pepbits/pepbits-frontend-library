# Reports source mapping

Phase 6e-1, base `5bbb130` (healthcare and ERP merged). The source package `desktop-clients/packages/reference-reports` and the demo API files (`reference-reports-store.mjs`, `reference-reports-engine.mjs`, `reference-reports-data.mjs`, `report-scheduler.mjs`, fixtures) are read-only references and remain unchanged. [App guide](README.md), [feature contract](../../docs/features/reports-demo.md) and [delivery record](../../docs/releases/unreleased/restructure-phase-6e-1-2026-10-24.md) state verification and limits.

| Original responsibility | Destination and treatment |
| --- | --- |
| `ReferenceReportsModule`, `routes.ts`, `navigation.ts` | `src/modules/reports/{module,routes,navigation}.ts(x)`: the same 19 route definitions, loaders, exemplars and sidebar data; the app maps each route to one page in `src/navigation.ts` and renders it through the public page-engines renderer registry |
| `@pepbits/reference-host` (host contract, link, router, scope key) | `src/modules/reports/host.tsx`: a small demo-owned context over public `PresentationProvider`; the application host supplies session, navigation and preferences |
| Desktop host adapter (`erp-screens` reference library page, `createReferenceTransport`) | `src/modules/reports/page.tsx` + `src/adapters/reports.ts`: configured `@pepbits/platform/http` request, namespace, routing headers, error/details mapping and raw downloads |
| `api/client.tsx` (typed client, page loader, refresh) | Same file, unchanged contract; uses the module host |
| `ui/primitives.tsx`, `ui/DataTable.tsx` (ops-ui bridges) | Same call signatures over `@pepbits/ui` and `@pepbits/components` (Button, fields, MultiSelect, Toggle, Badge, Card, Modal, Table, Pagination) |
| `ui/Toast.tsx` (module toast region) | Thin `useToast()` adapter over the shared ScreenHost `notify`, rendered by the shell toast viewport |
| `ui/preferences.ts` (page-size, export and shortcut controllers, formatters) | Same controllers over `@pepbits/preferences` types and `@pepbits/i18n` `createFormatters` |
| `charts/Charts.tsx` (module SVG bar/line/donut) | Maps the API chart payload to public `BarChart` (new, generic), `LineChart` and `DonutChart` |
| `reports/*`, `builder/*`, `dashboards/*`, `jobs/*`, `schedules/*`, `emailin/*`, `admin/*`, `pages/*`, `shell/ModuleBar.tsx` | Ported screens and reports-specific composition; window printing replaced by public `PrintDocument`; `ConfirmDialog`, `ActionMenu`, `SearchInput` and date/time inputs from the library |
| `lib/expression.ts`, `lib/dates.ts`, `types.ts`, `reports.css` | Copied; strict index assertions are type-only; the toast and SVG chart rules were removed from `reports.css` |
| `routes.test.ts` (5), `module.test.tsx` (17) | Ported with all assertions; providers adapted to `@pepbits/preferences` and the canonical catalog wrapper; the in-process demo store (loaded at test time from `mock-api`, never bundled) is the mocked API |
| Lucide icons | `@pepbits/icons`; nine missing primitives added (Blocks, FileBarChart, FolderDown, KeyRound, Library, MailPlus, ScrollText, Settings, Zap) |
| Local API/runtime startup and cleanup | Shared `tooling/scripts/run-demo-integration.mjs` (now accepting `reports`), called by `scripts/integration.mjs`; browser flows in `scripts/smoke.mjs` |

Generic additions live in packages: `BarChart` in `@pepbits/components` (tested, README listed, showcase example) and the icon exports. Everything reports-specific (route table, loaders, report/builder/dashboard/schedule screens, role visibility, transport namespace) stays in this app. Nothing is imported from another demo, `desktop-clients/` or an old package name.
