# @pepbits/page-engines

Generic record, worklist, form and template engines composed from typed definitions and injected adapters. Version `0.0.0` is an unpublished React 19 TypeScript source package. It contains no application catalogue, entity instances, module registry, navigation tree, default API endpoint or runtime sample data.

## Public API by area

The root barrel exports every included area. Prefer subpaths to avoid loading unrelated engines or the XLSX decoder.

| Subpath | API |
| --- | --- |
| `./record-page` | `RecordPage`, `RecordPageSection`, `RecordPageAction` (type), `RecordActionBar`, `RecordIdentity`, `RecordNotice` |
| `./record-layout` | `RecordSectionLayout`, `RecordSectionCard`; generic section rail/tabs/wizard, keyboard navigation, mounted section retention and CSS modules |
| `./types` | `PageDefinition`, open `PageKind`, opaque `ModuleKey`, `DataColumn`, `WorklistConfig`, entity/form field/section types; `PageTemplateDefinition`, `TemplateConfiguration`, engine/layout/view/document/line/value types; `withSchemaLocalization`; form visibility/options/validation helpers; filter classification/partition/URL/storage helpers; export review/audit types and functions |
| `./worklist` | `WorklistPage`, `WorklistPageProps`, `WorklistAdapter`, `WorklistRequest`; `DataTable`, `CardGrid`, `ColumnManager`, `FilterBar`, `PersonalViews`, `SavedViewScreen`, `RecordPreview`, preview components; `useColumnLayout`, `useFilterSync`, `searchWorklist`, `buildSearchBody`, `exportRows` and their types |
| `./records` | `RecordAdapterProvider`, `RecordHostValue`, `useRecordHost`, `useRecordEditor`, `useSavedRecords`, `useRecordField`, `RecordSaveStatus`, `RecordPanelsPanel`, `RecordPanelsProps` |
| `./forms` | `DynamicRecordForm`, `DynamicRecordFormProps`, `FormNavigationControl` |
| `./templates` | `PageTemplateWorkspace`/props, `ConfiguredTemplatePage`/props, `RegistryTemplateBody`, template fields/summary/timeline/checklist/board, lines/list/booking/report/reconciliation/administration/chart and schedule/matrix/hierarchy/import/document parts |
| `./template-state` | `TemplateScope`, `TemplateSaveRequest`, `PageTemplateAdapter`, `lineTotals`, `validateTemplate` |
| `./renderer` | `createPageRenderer`, `createEngineRenderers`, `PageRenderContext`, `PageRenderers`, `EngineRegistrations`, `UnsupportedPage`, `SkeletonFor` |

There are no placeholder `./reports`, `./dashboard` or `./inbox` exports. The generic template report/dashboard engines are included through templates; the old standalone pages use product fixtures and are excluded.

## Host flow: definition, adapter, registration

A host supplies definitions for pages the authenticated user may access, implements the adapters, and registers renderers. For example, this fictional Item worklist has no seeded rows or endpoint:

```tsx
import {createEngineRenderers, createPageRenderer} from '@pepbits/page-engines/renderer';
import type {PageDefinition, WorklistConfig} from '@pepbits/page-engines/types';
import type {WorklistAdapter} from '@pepbits/page-engines/worklist';

export const itemPage: PageDefinition = {
  id: 'items', title: 'Items', subtitle: '', kind: 'worklist', module: 'records', entity: 'item',
};
const itemList: WorklistConfig = {
  id: 'items', entity: 'item', title: 'Items', description: '', rows: [],
  primaryKey: 'id', displayKey: 'name', advancedFilters: [],
  basicFilters: [{key: 'status', label: 'Status', type: 'text', classification: 'operational'}],
  columns: [
    {key: 'id', label: 'ID', classification: 'operational'},
    {key: 'name', label: 'Name', classification: 'pii'},
  ],
};
export function itemRenderer(adapter: WorklistAdapter) {
  return createPageRenderer({renderers: createEngineRenderers({
    worklist: () => ({config: itemList, adapter}),
  })});
}
// Construct once per host adapter identity, then render <Renderer page={itemPage}/>.
```

`adapter.request(path, init)` is the host's authenticated `Promise<Response>` transport. Worklist paths remain `/worklists/search`, `/worklists/archive`, `/worklists/{page}/{record}`, `/personal-views`, `/views`, `/exports`, optional `/reference?keys=…`, and account `/layouts`. The host translates/routes these paths as needed. Search sends classified filters in a POST body, not query parameters. The server returns authoritative rows/total/page; `config.rows` remains a compatible field but is not used as a failed-request fallback. `identity` must include verified tenant/application/user; `applicationId` is routing metadata, never authority. `actor` supplies print attribution; `sessionAvailable` controls recovery UI. `referenceKeys` explicitly maps filter keys to host reference lists.

Users search, filter, select, preview, edit or open records, choose columns, save views, and export/print subject to host capabilities. Writes, read permission, scope and field visibility must be enforced by the server. `ScreenHost.can('create'|'edit'|'export'|'archive', page)` gates worklist actions. Related panels use `can('edit', scope)` and `can('remove-comment', item)` plus server write metadata. UI guards are not authorization. The route host owns access checks before passing definitions to the renderer.

`createPageRenderer` snapshots the supplied maps. A registered `templateDefinition.id` or `templateId` wins over `kind`; unknown keys (including inherited object names) render the shared `EmptyState`. It never silently substitutes a worklist. `createEngineRenderers` registers only configured worklist/form/template engines. A worklist target with a mode uses the form registration when supplied. Hosts can register any additional kind, including a configured `RecordPage`, with a component accepting `PageRenderContext`. No preferences, login, AI, product or showcase page is hard-imported.

## Providers, preferences and styling

Use the existing [patterns provider wiring](../patterns/README.md#host-integration-and-styling): `PreferenceHost` → host `LocalizationProvider` → `ScreenHostProvider`; add `NavigationProvider` from platform for navigating engines. The host owns accepted preference snapshots, policy, availability and the single `update(patch)` persistence callback. Apply effective theme/font/scales/radius/reduced motion and direction at the host surface. Engine tables use effective `PresentationProvider` values internally. Standalone table/part consumers must provide the surrounding presentation provider too.

Effective density, page size, stripes, sticky headers, wrapping, result view, preview, filter memory, column storage scope, export format and formatters are retained. Managed settings replace conflicting values while mounted. Locked/unavailable controls are disabled and updates are guarded centrally. Allowed page sizes are passed into shared Pagination, which omits unavailable options and guards its callback; allowed result views disable their segment. The form Alt+S listener exists only while shortcuts are enabled and saves only the focused document. Native date/time values remain standardized machine values.

Record hooks additionally require `RecordAdapterProvider` with `{adapter, identity, applicationId, sessionAvailable}`. Its adapter is the existing `@pepbits/data` `RecordAdapter`; there is no implicit HTTP fallback. Use the same verified identity for the lifetime of a document and remount on an identity change. `DynamicRecordForm` requires the host `schema` and accepts `initialValues`, with schema defaults filling absent fields. The adapter remains authoritative for loaded records and recovery drafts. Panels receive an explicit adapter, actor ID and allowed related-page list.

Import/approval workflows are optional worklist props and come from `@pepbits/patterns/imports` and `@pepbits/patterns/approvals`. When enabled, supply the patterns `DraftHost` with an authenticated data-layer draft adapter and verified session identity. Patterns owns the CSV dialog, approval workspace and draft recovery UI; engines do not duplicate them.

Import tokens once and scan all source packages for Tailwind utilities (paths relative to the host stylesheet):

```css
@import "@pepbits/tokens/tokens.css";
@source "../node_modules/@pepbits/ui/src";
@source "../node_modules/@pepbits/components/src";
@source "../node_modules/@pepbits/patterns/src";
@source "../node_modules/@pepbits/page-engines/src";
```

The host must support CSS modules and transpile source. Record-page, record-layout and registry-template CSS/declarations are copied byte-for-byte and remain CSS side effects. Existing class names, ARIA and keyboard behavior are retained. Legacy `data-clinical-section` and `template.clinical.*` localization keys are compatibility identifiers for generic section/read/discard labels, not domain implementations. Hosts provide canonical messages for the unchanged `ui.*`, `recovery.*`, `draft.*`, `template.*` keys and literal labels. Private test messages are not a runtime fallback. No original catalog or example is regenerated.

## Editing, templates, recovery and extension slots

Record editors live in host document transient state across suspension. `document.subscribeClose` distinguishes explicit closure from unmount: closure calls the data editor's `close()`, while standalone unmount flushes an API draft and stops the editor. The host must keep the close subscription alive during suspension and close/dispose all documents on sign-out. `reportDirty` enables host navigation guards. `useScreenDraftState` stores only transient document values; durable drafts are the data service's responsibility, with retention and sensitive-field exclusions. Recovery remains an explicit restore/discard choice; uncertain writes keep their operation IDs, and conflicts require review.

Templates receive `initialDocument` plus `PageTemplateAdapter.save`, optionally `load`. The configured page receives a verified identity, adapter and definitions (or `page.templateDefinition`); missing identity denies access, missing integration uses the shared error state, and malformed/wrong-record responses are refused. `can('create'|'edit', page)` controls configured-template editing. Standalone workspaces retain their explicit `readOnly`/adapter contract. Save acknowledgement/version checks, explicit conflict replacement and discard confirmation are preserved.

No sample document generator is exported. `TemplateConfiguration` supplies resources, slots with explicit end times/availability, schedule-day labels, capacity/unavailability and administration roles. Missing configuration yields empty choices instead of fabricated availability. Report date ranges derive from supplied document values/rows; staged import dates derive from the document, not a fixed sample date. Existing generic template specialization IDs (hierarchy, split list, document/conversation, import, permissions/policy) remain supported. Template row/line conventions (`code`, `name`, `date`, `amount`, `status`, `resource`) remain unchanged. The form’s legacy duplicate/audit menu entries remain presentation controls, and its approval menu only emits the original notification; it does not execute an approval adapter. Hosts needing an approval workflow use patterns. Template document/import parts stage document metadata/rows; they do not claim to upload files or execute a production import. Use the patterns import adapter for that workflow.

AI is represented only by ScreenHost's optional `renderInlineAction` and `publishSources` slots. Sources use opaque `{id, sources}` objects; effect cleanup calls the disposer returned by the host. The slots are absent by default. No AI dependency is included.

## Differences from erp-screens

- Imports use the root/area exports above. There is no compatibility shim or original-workspace dependency. The generic record-layout export is included despite its original folder name.
- `RecordPage` and `RecordSectionLayout` remove their `preferences` prop and consume effective `PreferenceHost` values. `PageTemplateWorkspace` removes `preferences`, `preferencePolicy`, `preferencesAvailable`, `onPreferenceChange`; layout overrides still work only when form navigation is editable. Template parts use the same provider rather than a local preference-choice store. Other record presentation props remain unchanged.
- `PageDefinition.kind` is extensible and `ModuleKey` is an opaque string. The optional `ai` metadata remains an opaque enabled/use-case contract. Product module unions, navigation/toast/workspace types, entity instances, `ENTITY_SCHEMAS`, `getEntitySchema`, `PAGE_TEMPLATES`, `TEMPLATE_BY_ID`, group/registry catalogues and template samples are omitted. Schema types and `withSchemaLocalization` retain their semantics.
- Worklist now requires `config` and `adapter`; optional imports/approvals contain explicit adapters/configuration. `onReturn`/`onPreferences` replace assumed dashboard/preferences destinations. `PersonalViews` requires `request`; `useColumnLayout` adds a fifth `{identity, request}` argument. Its account cache is scoped to both identity and transport, and late responses cannot replace another identity's cache. Browser namespaces change from `nexora-*` to `pepbits-*`; old browser layouts/filter/pending-view state is not migrated.
- `DataColumn.classification` is additive and filters use `FilterDefinition`. `reviewExport`/`exportRows` keep their signatures but read column metadata rather than a product field-name catalogue; absent classification is withheld. `phi`, `pii`, `clinical`, credential and operational classification identifiers retain their wire meanings. No product classifier is exported. Formula protection, XLSX string cells, formatted values, withheld-column review, print stamps and value-free audit records remain.
- `RecordAdapterProvider.value` changes from an adapter alone to `RecordHostValue`. Hooks use ScreenHost document lifecycle instead of workspace/session/product contexts. Forms require a schema and optional initial values rather than looking up product schemas and preview rows. Panels require adapter/actor/related-page props and use an opaque removal capability instead of an administrator role name.
- `ConfiguredTemplatePage` takes `identity`, `adapter` and optional `definitions` explicitly. `TemplateConfiguration` replaces seeded resource/slot/role data; report/import dates no longer use sample dates. The template report subtitle is the host description. The renderer becomes the registration factories described above; `showTabPreferences` and implicit product routing disappear.
- Notifications now pass localized combined title/message text with tone to ScreenHost. Reference keys, scope, session availability, identity and ports come from the host. Existing localization/formatter hooks replace ERP context. No new persistence or authorization inference is introduced.
- Strict indexed-access assertions erase at runtime. Product examples in comments and tests are generalized. The README and release inventory identify the two source test cases that tested the removed product catalogue/local preference store and their replacements.

## Exclusions and completion boundary

Standalone reports/dashboard/inbox/billing still combine product datasets, seeded lines/currencies, module navigation or notification fixtures: phase 6 demos must own those pages. Preferences → shell phase 5; login → shell/platform phase 5; reference-module wrappers → demo routing; consultation/OP/clinical/comprehensive/clinic-billing/care pages → Healthcare repository and healthcare demo; Developer-Library/page-library/template-library/template-demo/generated examples → showcase phase 6. Spreadsheet, designer authoring, label printing and identity/device patterns remain deferred from phase 4a priority 3.

XLSX retains the exact original 0.20.3 tarball specification. The inherited advisory history and npm audit findings remain a dependency-review follow-up; no dependency upgrade is included. No DnD packages are needed by the selected engines.

Run root `npm install`, `npm run ci`, and the requested jiti documentation checker. Tests use fictional generic definitions, mocked requests/ports, and the shared `@pepbits/patterns/testing` providers/document helper. The 84-definition test matrix covers all twelve engine IDs across six views, five generic registry fixtures and seven specialization fixtures; it is not the original 102 product templates. See the [phase 4b record](../../docs/releases/unreleased/restructure-phase-4b-2026-10-23.md) for per-file counts, deviations and source identity. Unit/jsdom and source typechecks do not establish browser/native/live-provider acceptance or a deployed release. No consumer migration, commit, push, publication or deployment is included.

## Phase 6a record-layout accessibility

RecordSectionLayout tab names include the visible step number followed by the localized section title (for example, `01 Details`). Checkmark decoration remains hidden. Consumers querying exact names should include the index or match the title suffix. Regressions cover names and keyboard/navigation behavior.

Worklist print provenance omits the timestamp during server/initial client rendering, sets it after mount, and refreshes synchronously for native `beforeprint`. This avoids build-time/client-time hydration differences and stale print timestamps. A regression checks stable server markup and the actual print event. The existing 84-template/two-density preference matrix runs as 168 individual cases to isolate timeouts during concurrent app builds.

## ERP configuration additions (phase 6c-1)

`./templates` adds controlled `FieldRows` (stable row IDs, TemplateFields, host-owned defaults/calculation) and `EditableMatrix` (CollectionView, host-supplied dimensions/options/cell updates). Both consume public controls and effective presentation; neither knows an ERP endpoint. Tests cover controlled edits/additions, disabled rows and empty matrix values. TemplateReport accepts `configuration.reportDateKey` and `reportAmountKey`; `null` omits that concept, while omission preserves existing date/amount defaults. Reports use row identity with a positional fallback and format numeric cells through the host.

WorklistPage adds `personalViews={false}` for adapters without that service contract, and `rowClick="open"` for row/keyboard record navigation; defaults preserve existing behaviour. Column layout/reset and preview continue through the shared engine. A component case covers hidden personal views and keyboard opening. `./worklist` exports `csvOf`, `xlsxOf` and `exportFileName`, retaining formula-safe string cells and numeric workbook types; the existing export path uses the same workbook encoder. ERP's original core cases exercise these exports.

ColumnManager visibility buttons expose their column names and pressed state for assistive technology. The ERP browser driver exercises visibility and reset.

## Analytical controls (phase 6c-3)

`TemplateReport` accepts optional `groupBy`, `totals`, `footerLabel` and `onRowClick`. Grouping operates on supplied rows; the host supplies authoritative totals for the full filtered result. Keyboard-operable row drill-downs use TableRow. Effective `resultView` chooses table/cards; table presentation continues through the shared provider. The host owns period/filter semantics, pagination and authorization. This is grouped reporting, not a pivot designer.

`EditableMatrix` adds optional `max`, `step`, `dimensionLabel` and trailing `summaryColumns`. Numeric edits clamp to zero/max; empty stays null and zero stays numeric. A mounted `disabled` value fences callbacks. The host owns summaries, bulk fill, partial saves, operation identity and explicit discard/reload. Unit tests cover bounds, denial, grouping/totals and keyboard drill-down.

`./worklist` adds `downloadGrid(headers, rows, format, name)` for an explicitly reviewed grid. It preserves numeric XLSX cells, applies formula-safe CSV escaping, normalizes the extension and releases the object URL. It does not classify raw columns or grant export permission: callers must review their schema and apply effective export preferences and authorization before calling it. Use `exportRows` when column classification is required. A test decodes the workbook and checks formula-safe CSV output.

## Record context (phase 6c-4)

`RecordPage` accepts optional `summary` and `aside` React slots for host-owned statistics and related information. A container query places the aside beside wide forms and below narrow forms; context remains mounted across section navigation and preference changes. The existing layout is unchanged when no aside is supplied. Fetching, authority, draft retention and domain calculations remain with the host. The record-page tests cover context input retention and effective density changes.

WorklistPage adds optional `renderViewControls` and `renderFilters` slots with public typed state/action contracts. Hosts with a different personal-view protocol compose their controls without replacing search, results, paging, selection or column layout. Applying snapshots validates columns/sort and respects current page-size locks and allowed values. The default personal-view and filter UI is unchanged. `worklist/preference-compliance.test.tsx` covers these slots and mounted policy.
