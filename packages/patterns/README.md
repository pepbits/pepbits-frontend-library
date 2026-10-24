# @pepbits/patterns

Generic lifecycle administration, master-file transfer and server-authorized DCP fields. Phase 4a delivers the product-consumed subset; phase 4b adds approvals, drafts and imports. Phase 4c completes priority 3. Version `0.0.0` is an unpublished ESM TypeScript source package, requiring React/React DOM 19 or later. Existing applications keep using their original workspace.

## Public API by area

The root barrel re-exports the following areas. Prefer subpaths to avoid loading unrelated UI or the workbook decoder.

| Subpath | Public API |
| --- | --- |
| `./lifecycle` | `LifecycleConfigurationPage`, its props/notification types; catalogue tree, worklist/status badge, definition/binding/applicability editors, governance, validation/resolve preview, host/version/source panels and source-catalog hook. Also the complete generic lifecycle contract, guards, model helpers, operation keys, `createLifecycleHttpApi`, `createLifecycleSourceHttpApi`, request/contract errors and source-mapping helpers formerly in the configuration package. |
| `./master-transfer` | `MasterTransferPanel`, `MasterTransferPanelProps`, `MasterTransferPort`, `MasterTransferPreview`, `PricingExpressionInput`, `MasterTransferData`, `MASTER_TRANSFER_LIMITS`, `parseMasterTransfer`, `readMasterTransfer`, `exportMasterTransfer`. |
| `./dcp-fields` | `DcpRuntimeFields`, `DcpSectionFields`, `DcpFieldRenderer`; the complete DCP v1 wire types, `DCP_RUNTIME_TYPES`, `isDcpRevision`, `isDcpNumber`, `isDcpValues`, `isDcpRuntimeView`, `isDcpLoaded`, `isDcpSaved`, `dcpWritablePatch`. |
| `./screen-host` | `ScreenHostProvider`, `useScreenHost`, `useFormatters`, `ScreenHost`, `ScreenHostValue`, `ScreenScope`, `ScreenDocument`, `useScreenDraftState`. |
| `./approvals` | `ApprovalWorkspace`, `ApprovalWorkspaceProps`, `RecordApproval`; explicit approval adapter, role choices and actor/application/page identity. |
| `./drafts` | `DraftHost`, `DraftHostValue`, `useDraftHost`, `useSharedDraft`, `DraftRecovery`, `DraftRecoveryCenter` and props. |
| `./imports` | `CsvImportDialog`, structural `ImportDefinition`/`ImportPage`/`ImportField`, `CsvOptionsEditor`, `mapCsvOptions`, `readOptionsWorkbook`, workbook sheet type and isolated worker. |
| `./testing` | Shared `TestHost`, render wrapper and `createTestDocument` for tests only; not exported by the runtime root. |

Phase 4c adds `./form-designer`, `./spreadsheet`, `./label-printing`, `./identity-devices` and `./device-integrations`; see the complete API and differences below. Phase 6e-3 adds [`./wizard`](#multi-step-wizard-phase-6e-3).

## User and administrator flows

1. Lifecycle: supply a verified application namespace, permissions, actor and API port. Users search versions, open a definition, edit its structure/bindings/mappings, enter a change reason and save. Validation and resolution use the server; independent approval, publication and activation follow the existing governance rules. Read denial, unavailable configuration, loading, empty lists and recoverable failures remain distinct states. Leaving a dirty definition asks before discarding it.
2. Master transfer: download a CSV/XLSX template or current records, upload literal values, enter a reason, validate on the server and commit the reviewed rows. Editing the reason or file invalidates validation. `CREATE` and `UPSERT` modes, revision fields, row/byte/expansion limits, formula rejection, export cursor checks and retry operation identity are preserved. `PricingExpressionInput` edits expression text; it never evaluates scripts or authorizes prices.
3. DCP fields: render the supplied server-filtered view and retain changed values in the host. Masked values never reach a custom renderer. Existing collection rows require their own `rowFields`; create-field metadata never authorizes an existing row. Required collections cannot lose their final row. `DcpSectionFields` projects selected fields from the active row. Server validation/save, conflict recovery and durable drafts stay with the host.

Lifecycle draft releases are business configuration versions, not autosaved form drafts. Unsaved editor values remain in mounted React state after recoverable failures. Lifecycle itself adds no browser storage or durable draft service; the phase 4b draft workflows use an explicit data-layer adapter.

## Host integration and styling

```tsx
import React from 'react';
import {createTranslator, directionOf, type TranslationCatalog} from '@pepbits/i18n';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {PreferenceHost, usePreferences, type PreferenceHostProps} from '@pepbits/preferences/react';
import {PresentationProvider} from '@pepbits/components';
import {ScreenHostProvider, useFormatters, type ScreenHostValue} from '@pepbits/patterns/screen-host';
import {LifecycleConfigurationPage, type LifecycleConfigurationPageProps} from '@pepbits/patterns/lifecycle';
import '@pepbits/tokens/tokens.css';

export function LifecycleHost({settings, catalogs, screenHost, page}: {
  settings: Omit<PreferenceHostProps, 'children'>;
  catalogs: TranslationCatalog;
  screenHost: ScreenHostValue;
  page: LifecycleConfigurationPageProps;
}) {
  return <PreferenceHost {...settings}>
    <Surface catalogs={catalogs} screenHost={screenHost} page={page}/>
  </PreferenceHost>;
}
function Surface({catalogs, screenHost, page}: {
  catalogs: TranslationCatalog; screenHost: ScreenHostValue; page: LifecycleConfigurationPageProps;
}) {
  const {preferences} = usePreferences();
  const format = useFormatters();
  const localization = {language: preferences.language, direction: directionOf(preferences.language),
    t: createTranslator({language: preferences.language, catalogs}), dateTime: format.dateTime};
  return <LocalizationProvider value={localization}>
    <PresentationProvider value={preferences}>
      <ScreenHostProvider value={screenHost}>
        <div dir={localization.direction}><LifecycleConfigurationPage {...page}/></div>
      </ScreenHostProvider>
    </PresentationProvider>
  </LocalizationProvider>;
}
```

The host supplies accepted preference snapshots, policy, availability and the central `update(patch)` callback. There is no local preference persistence or optimistic preference store. `useFormatters()` memoizes `createFormatters(formatOptionsFrom(effectivePreferences))` by the actual formatting options. The host also applies effective theme, font, scales, radius and reduced motion to its surfaces. Lifecycle provides effective table presentation internally; standalone panels should use the surrounding `PresentationProvider` above. The draft center projects effective table presentation internally. Managed/unavailable page-size settings override explicit lifecycle list-size props; unlocked props still select a server-supported limit. Permission hints and `can` are UI gating only (PREF-08); servers must enforce every read and write.

Use `scopeKey` containing the verified tenant, application and user to remount lifecycle when identity changes. `ScreenHost.scope` is opaque routing metadata and does not replace that key or establish authorization. Supply request functions to the lifecycle HTTP factories and authenticated implementations of `MasterTransferPort`. There is no URL, product registry or network default. Lifecycle `notify` and `onDirtyChange` props take precedence over the ScreenHost fallback and keep their existing signatures.

Hosts must support **CSS modules**: the lifecycle `.module.css` and its declarations are copied unchanged. Keep package CSS as a side effect. Import tokens CSS once and scan all three UI source directories in Tailwind (paths relative to the host stylesheet):

```css
@import "@pepbits/tokens/tokens.css";
@source "../node_modules/@pepbits/ui/src";
@source "../node_modules/@pepbits/components/src";
@source "../node_modules/@pepbits/patterns/src";
```

No precompiled CSS or library bundle is emitted. Hosts transpile source and provide the existing global utilities. Markup, classes, labels, ARIA, keyboard controls and CSS-module names are preserved. Localization uses `@pepbits/i18n/react`; hosts supply canonical `lifecycle.*`, `designer.v1.*`, `designer.invalidValues`, shared `ui.*`/`recovery.*` keys and literal transfer labels. Missing non-core translations display their key/literal. The private test catalog is not a runtime fallback. Canonical catalogs and generated application examples remain unchanged.

## ScreenHost contract

`ScreenHostProvider` accepts an optional `value: ScreenHostValue`. Omitted fields receive the same defaults as `useScreenHost()` outside a provider. Partial document values also receive defaults; supplying a provider replaces its enclosing host contract rather than merging scopes.

| Field | Meaning and default |
| --- | --- |
| `notify(message, {tone})` | Already localized text; tone is `success`, `error`, `info` or `warning`. Default no-op. Lifecycle uses it when its detailed notification callback is absent. |
| `can(action, subject?)` | Opaque host capability check, default `false`. Does not infer roles or permissions. The included lifecycle/transfer screens retain their explicit permission/capability props; no action-name mapping is invented. |
| `scope.module`, `scope.branch` | Optional opaque strings, default empty object. No module/branch catalogs or default IDs. |
| `document.id` | Host document identity or `null` by default. |
| `document.focused` | Whether this document is focused; standalone default `true`. |
| `document.draftState` | Host-owned transient state keyed by string; default empty object. This is neither a second preference store nor durable drafts. |
| `document.setDraftState(key, value)` | Host callback for transient document state; default no-op. The provider does not store the value or force persistence. |
| `document.reportDirty(dirty)` | Host navigation-guard notification; default no-op. Lifecycle uses it when `onDirtyChange` is absent. |
| `renderInlineAction?(props)` | Optional opaque React extension slot; absent by default. |
| `publishSources?(sources)` | Optional opaque source-publication callback, optionally returning cleanup; absent by default. Callers own cleanup. |

Page engines now call these slots; the patterns themselves do not. The AI layer can fill them after phase 5; no AI source or dependency is included. Shell implements document ownership/focus/drafts in phase 5. `document.subscribeClose(listener)` is an optional explicit-close subscription added for record editors in phase 4b; absent by default. It distinguishes document closure from component suspension. The host retains the subscription during suspension and closes/disposes documents at sign-out. `useScreenDraftState(key, initial)` uses the existing document dictionary/write callback and local state for standalone rendering; it resets on document/key changes and never writes browser storage. There is no error-monitor, documentation-center, tour or dashboard callback.

## Differences from erp-screens

- Imports use the documented area subpaths or root barrel; configuration contracts needed by the selected screens are co-located here and exported with their area. Primitives, composites, localization and CSV parsing use the existing lower-layer packages. There are no compatibility re-exports from the original workspace.
- `LifecycleConfigurationPageProps` no longer extends the old optional preference-prop interface: `preferences`, `preferencePolicy`, `preferencesAvailable` and `onPreferenceChange` move to the central `PreferenceHost` provider (`update` replaces the old setter). The page now requires that provider. Effective preferences drive presentation; absent `pageSize`/`sourcePageSize` props use effective `pageSize` (the current standalone preference default is 20, previously both were 25), and managed/unavailable settings take precedence over explicit size props. Server caps still apply. The lower-level standalone source-catalog hook retains its 25-row default.
- Lifecycle notifications and dirty-state callbacks retain their signatures and precedence; their absent-prop behavior now forwards to ScreenHost, whose defaults are no-ops. The detailed lifecycle notification's `operation` remains available through the explicit callback; the generic host notification intentionally receives only message/tone.
- `DcpRuntimeFields` now requires `PreferenceHost` for selected formatting. Read-only integer/decimal/date/date-time values use effective formatters instead of raw string conversion. Editable number and temporal inputs, wire values, rendering extensions, collection identity and server authorization checks are unchanged.
- Master transfer and pricing expression component props, workbook/CSV helpers, lifecycle HTTP/configuration contracts and DCP v1 types/guards retain their original signatures. `ScreenHost` and `useFormatters` are additive. The later phase 4b workflow additions are described below.
- Strict indexed-access assertions are type-only and erase at runtime. Product-specific comment examples are generalized. Test-only fixture names are neutralized; original behavioral assertions remain, with providers/imports and an explicit source-list size adapted for the new preference boundary.

## Intentionally not included

Phase 4b completed priority 2. Approvals, drafts, CSV/workbook options and worker now live here; their six original test files are ported. Historical deferrals, resolved below in phase 4c where generic:

| Area/configuration | Reason |
| --- | --- |
| Spreadsheet and remaining form designer | Completed in phase 4c with structural field contracts and explicit host inputs. |
| Label printing, identity devices, device integrations | Generic UI/contracts/adapters completed in phase 4c; product page/category maps and subject data remain excluded. |
| `dcp-designer*`, `dcp-rules`, `dcp-lifecycle`, repeating logic and `dcp-catalog` | Completed in phase 4c; shared contracts/helpers live in data. Repeating helpers remain in `dcp-designer.ts`. |
| `form-rules` | Generic schema rules and their tests now live in page-engines; patterns imports use a minimal structural schema contract to avoid an upward dependency. |
| Product import/classification/inbox registries | Host-owned. Export policy now lives in page-engines and reads explicit column metadata. No product catalogues or seeded notifications/currencies are copied. |
| Developer-Library `library-page.tsx`, product screens, page engines | Showcase pages belong to phase 6; page engines belong to 4b; product definitions remain host-owned. |

The phase 4a package is extended in phase 4b. `LAYERS` is unchanged. No shell, AI, page-engine or original-workspace dependency is introduced.

## Dependency follow-up, testing and support

Master transfer imports `xlsx` using the source package's exact specification: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. npm-distributed XLSX versions have known advisories; retain a security/dependency review as follow-up without silently changing the pinned implementation. The phase 4c root install reports four audit findings (one moderate, three critical); this port does not remediate them. The earlier subset needed no DnD dependencies; phase 4c adds the original pinned designer dependencies. Phase 4b worklist exports use the same XLSX specification in page-engines. Hosts using workbook operations need the original browser APIs, including `DecompressionStream('deflate-raw')`; upload verifies actual expansion before synchronous decoding.

Lifecycle retries preserve the original operation fingerprint and expected revision; conflicts remain explicit. Master transfer retains its pending idempotency key across an uncertain commit response. Hosts enforce permissions, draft retention, sensitive-field policy and production durability. A `ScreenHost` callback or UI lock is not evidence that a server implements those policies.

Run `npm install` and `npm run ci` at the repository root, or the focused `npm run typecheck -w @pepbits/patterns` and `npm test -w @pepbits/patterns`. Tests use generic fixtures, mocked ports and all three providers. See the [phase 4a release record](../../docs/releases/unreleased/restructure-phase-4a-2026-10-22.md) for counts, every ported/deferred test file, source identity, failures/corrections and local evidence. Unit/jsdom checks do not establish compiled CSS, browser journeys, native devices, live services, accessibility-tool or native-speaker acceptance. No published artifact or migration is claimed. Rollback removes this independent increment; existing consumers and stored data are unchanged.

## Phase 4b workflow wiring and compatibility

Provide `<DraftHost adapter={draftAdapter} identity="verified-tenant:application:user" available={sessionAvailable}>` around shared draft, approval and import workflows. The adapter is the existing data-layer `DraftAdapter`; identity must change with the authenticated scope. Missing DraftHost throws instead of guessing transport/session authority. `available=false` prevents autosave and informs recovery UI. `useSharedDraft(scope, enabled, payload)` keeps its original signature, explicit restore/discard, retention/exclusions and identical retry operation identity. No default authenticated request function, token store or product context remains.

Approval props add `productId`, `adapter`, `actorId` and `roleOptions`. Hosts decide where to render `RecordApproval`; the old single-product page gate and fixed role list are removed. Adding a stage selects the first configured role, or leaves it empty until configured. `ApprovalWorkspace` paginates by effective page size instead of a fixed 25. The adapter remains authoritative for per-row eligibility/configuration; the UI does not infer roles. Navigation uses the platform provider and diagnostics use the platform monitor contract. The host localization provider supplies existing approval keys.

`CsvImportDialog` keeps open/close/page/product/onImported props and adds an explicit import adapter and definition (or null). Its page input is structural `{id,title}`; its definition contains the unique field and section fields used for mapping. There is no product registry or upward page-engine dependency. The workflow remounts on identity/application/page change. Original CSV bounds, required mapping, validation/confirmation, resumable jobs, row errors, formula-safe error export and mapping-draft recovery remain. `CsvOptionsEditor`, mapping and workbook helpers retain their APIs. The worker is copied with bounds, formula rejection, cancellation and timeout; hosts must support module workers and browser decompression.

`DraftRecoveryCenter` now receives `application:{id,name,pages}`, its adapter and optional `renderWorkflow(item,onClose)`. The host renders its configured import/approval dialogs through that slot after the service rechecks access; the center does not invent page definitions. It is keyed by verified draft identity/application. Navigation targets and metadata hiding/discard/retry behavior remain. Its 25-row pagination is the existing data-layer service limit (DraftCenterQuery has no page-size parameter); changing that wire protocol is not part of this copy. CSV-option review retains its bounded 50-row staging pages, independent of result-list preferences.

The shared testing export reuses phase 4a provider/catalog/presentation/navigation wiring; callers may add private test messages. The in-memory test document exposes focus, transient drafts, dirty guarding and close subscriptions without pretending to be durable storage or a native shell. Never bundle it as application runtime code.

See the [phase 4b record](../../docs/releases/unreleased/restructure-phase-4b-2026-10-23.md) for current counts and API differences. The earlier phase 4a record remains historical evidence. UI/service ports remain mocked in tests; browser workers, native execution and live server authorization are not certified.

## Phase 6a embedding accessibility corrections

Composed gallery axe checks found nested landmarks and labels. Lifecycle's inner content container is now a `div` (same CSS class), leaving the host responsible for its single `main` landmark. MasterTransferPanel passes `label` directly to shared Select/Input controls for format, file and reason; it no longer nests an outer label around FieldShell's label. Tests verify a single host landmark and the three accessible control names without nested labels. No lifecycle, transfer or persistence protocol changes.

Lifecycle worklist card names include their visible record details, with the localized open action as a screen-reader prefix. They no longer replace visible content with a shorter `aria-label`; exact-name consumers should use a prefix matcher.

## Phase 4c: remaining priority 3 patterns

Priority 3 is implemented. All areas below are also available from the root barrel. The [phase 4c record](../../docs/releases/unreleased/restructure-phase-4c-2026-10-23.md) retains source identity, per-file test mappings, exact verification and exclusions.

| Subpath | Public API and flow |
| --- | --- |
| `./spreadsheet` | `SpreadsheetPage`, `SpreadsheetPageProps`, `SheetCell`, `SHEET_FIELDS`, `SHEET_COLUMNS`, `importSheet`, `reviewSheetExport`, `exportAudit`, `ExportAudit`. Edit eight-column costing sheets, import validated headers/rows, recalculate costs, then record a value-free audit before download. |
| `./form-designer` | `DcpDesignerWorkspace`/`DcpDesignerProps`; `DesignerSections`, `DesignerPreview`, `DesignerPresentationField`, `RepeatingDesignerSection`, `TemplateFields`/`TemplateFieldState`, `useDesignerLookups`; designer panel/palette/sortable/field controls; catalog source/mapping/manager, rule/label/multi-parent properties, lifecycle panel, release comparison, runtime panel, `DcpHostRuntime`, `DcpRuntimeDraft`; complete designer/rule/catalog/lifecycle contracts and helpers, `DesignerAdapter`, `createDesignerAdapter`. |
| `./label-printing` | `LabelPrintingWorkspace`/`LabelWorkspaceProps`, `CodePreview`, `LabelPreview`, `WristbandPreview`, `PrintSheet`, `LabelPrintDialog`; label contracts, `labelFitsProfile`, `LabelAdapter`, `createLabelAdapter`. Select compatible stock and records, generate server artwork, review/reprint with a reason, inspect job history and permitted policy controls. |
| `./identity-devices` | `IdentityDeviceWorkspace`/`IdentityWorkspaceProps`, `IdentityResultPanel`, `IdentityHistory`; subject/device/policy/attempt/command contracts, `IdentityAdapter`, `createIdentityAdapter`. Choose a subject and reader, consent, start/resume/cancel, simulate or route to manual review. Results retain `authenticated: false`. |
| `./device-integrations` | `DeviceIntegrationWorkspace`/`DeviceWorkspaceProps`, `DeviceJobList`, `DeviceDocument`; integration contracts, `IntegrationAdapter`, `createIntegrationAdapter`. Select workstation/destination/source, queue, dispatch, scan within a host context, inspect history and permitted automation/policy controls. |

The existing provider example applies to every workspace. Adapters are explicit and receive authenticated host requests; the new HTTP factories live in data. For example:

```tsx
import {createDesignerAdapter} from '@pepbits/data/dcp-designer';
import {DcpDesignerWorkspace} from '@pepbits/patterns/form-designer';
// Mount inside the PreferenceHost, LocalizationProvider and ScreenHostProvider shown above.
const adapter = createDesignerAdapter(authenticatedRequest, applicationId, '/host/designer');
<DcpDesignerWorkspace adapter={adapter} scopeKey={JSON.stringify([tenantId, applicationId, userId])}/>;
```

Designer users add/reorder sections and fields using drag handles or the existing keyboard/up/down controls, edit rules and pinned catalog mappings, preview unsaved values, and save a draft. Review/approval/publication/retirement remain server-authorized operations; runtime answers bind a release to a host entity. Repeating rows retain identity, limits and independent values. Catalog and save retries retain the same operation/revision. Backend v1 runtime uses the existing `./dcp-fields` contract and renderer, per-row write authorization, filtered preview violations, explicit conflict reload and optional `DraftHost` recovery. The helper `TemplateFields` is the original structural field renderer needed by designer sections; no page engine or product template registry is imported.

### Priority 3 API differences

- Preference props (`preferences`, `preferencePolicy`, `preferencesAvailable`, `onPreferenceChange`) are removed from the four old workspace prop interfaces. Use `PreferenceHost`. Effective density, table settings, history size and formatters are applied. Managed form navigation overrides authored preview/runtime layout and disables/guards the corresponding authoring control; unlocked definitions retain their authored layout. Read-only designer number/date/time controls use effective formatters. Physical label dimensions remain server stock geometry, independent of screen density.
- `DcpDesignerWorkspace` reports dirty state through ScreenHost, preserving its before-unload/discard controls. `DcpHostRuntime.onDirtyChange` still takes precedence; absent callbacks forward to ScreenHost. Scope keys remount state when identity changes. Authoring values otherwise remain mounted state; only `DcpRuntimeDraft` uses the existing explicit shared draft service.
- Shared serializable designer/configuration and v1 runtime contracts live in `@pepbits/data`, with area re-exports here. `./dcp-fields` keeps exactly its original public exports. The three structural `TemplateField`, `TemplateSection`, `TemplateValue` types are independent of page engines. No original-workspace compatibility shim exists.
- `IdentityPatient`, `patients`, `patientId` become `IdentitySubject`, `subjects`, `subjectId`. Hosts must map old product wire schemas. `pageId` becomes `mode: 'card' | 'passport' | 'biometric'`; `stationId` is required. Existing canonical `identity.patient` and biometric heading localization keys remain for host compatibility; hosts supply appropriate subject wording. No subject data or identity page registry is shipped.
- Device integrations replace `pageId` with `mode: 'workbench' | 'automation'`, require `stationId`, and accept explicit `contexts: {value,label}[]`. The first context initializes lookup; there is no product context list or demo workstation fallback. Native execution is supplied through platform `withDeviceConnector` / `withIdentityConnector` and their validated device ports. Browser printing remains `window.print`; no native import is used.
- Labels add optional `isWristband(job)` instead of checking a product template ID. Omit it for the standard label preview. Product `LABEL_PAGES`, `IDENTITY_PAGES`, `DEVICE_PAGES` maps are not exported. Generic `batch`/`profiles` display modes, payment-state polling and policy contracts remain.
- `SpreadsheetPage` accepts `initialRows`, required `audit(entry)`, optional `pageId` and `filename`. Empty rows replace product seeds. ScreenHost controls `can('export', {pageId})`, notifications and transient document rows. There is no product request or export endpoint default. The audit must resolve before download; failures retain edited rows. Explicit operational schema classifications replace product lookup; unknown classifications still require review. Effective `exportFormat` selects CSV/XLSX and replaces the filename extension (default `pepbits-costing-workbook.xlsx`); sticky header and radius follow host presentation. Eight-column math, import limits, header validation, markup and ARIA remain.
- Embedded informational integration panels retain their structure but refer to the new provider/adapter boundary; complete executable snippets belong to showcase. CSS modules and declarations are byte-identical. Strict indexed-access assertions are type-only; tests use neutral local fixtures and shared providers. Icons are routed through `@pepbits/icons`.

Install adds the original DnD specifications (`@dnd-kit/core` 6.3.1, sortable 10.0.0, utilities 3.2.2). XLSX remains the exact 0.20.3 CDN tarball. Hosts must scan pattern source and load tokens/CSS modules as above. Canonical catalogs remain unchanged; showcase regenerates its read-only subset. Missing translations are a host integration responsibility.

No Developer-Library launcher, product page/category/context/subject registry, product row seed or DCP demo endpoint wrapper is included. The showcase supplies five independent in-memory examples. Native output, real identity verification, live backends, durable storage, deployment and native-speaker review remain host acceptance, not results of these local package tests. Rollback removes this independent increment without changing protected applications or stored data.

## Scoped resources

`@pepbits/patterns/resources` exports `ResourceScope`, `JsonRequest`, `useJsonRequest`, `useFetch`, `useScopedResource`, `useScopeMemory`/`useViewMemory` and `useStoredState`. Supply an authenticated request callback, a verified identity key and an explicit state endpoint. A changed scope/request gets a fresh store. Fetches abort and fence stale responses; shared resource promises deduplicate reads within a scope. Stored state hydrates with GET only, protects user edits from late hydration, serializes PUTs and retains values with retry on failure. Caches are ephemeral; this is not a durable business-draft engine. Package tests cover abort/stale completion and scope deduplication. ERP's ported core cases verify hydration, StrictMode, failures and tenant/module separation.

## Hierarchy and workflow board

| Public export | Contract |
| --- | --- |
| `@pepbits/patterns/tree` | `HierarchyView`, `HierarchyViewProps`, `HierarchyNode`, `HierarchyEntry`, `hierarchyEntries`: searchable hierarchy with ancestor retention, expand/collapse, visible-ID callback, controlled selection, optional columns/actions and cycle/orphan handling. |
| `@pepbits/patterns/board` | `WorkflowBoard`, `WorkflowBoardProps`, `BoardColumn`: controlled status columns, pointer drag and accessible select moves, item slots and read-only gating. |

Supply nodes/items and command callbacks inside the existing PreferenceHost, LocalizationProvider and presentation host. Neither area fetches data, grants permissions, mutates records or persists drafts. Density, result scale, semantic colors/radii, localized labels and number formatting follow the effective host; table columns reuse CollectionView. Hierarchy indentation uses logical padding for RTL. There is no custom motion or shortcut binding. The host acknowledges board moves, handles failures and sets `disabled` while pending or unauthorized; changing it fences an in-progress drag. Direct tests cover search/ancestors, malformed hierarchies, selection, visible neighbours, keyboard/pointer commands and mounted permission revocation. ERP owns all entity/route/field configuration.

Structural hierarchy and status-board layouts do not apply the generic table/card `resultView` or split their groups by `pageSize`; hosts supply the complete nodes/groups they intend to display. A host's optional List view should use its ordinary preference-aware worklist. The canvases have no preference persistence or automatic animation, so reduced motion and shortcut disablement require no extra bindings.

## Resource calendar (phase 6c-3)

`@pepbits/patterns/calendar` (also root) exports `ResourceTimeline`, `ResourceTimelineProps`, `TimelineResource`, `ResourceEvent`, `TimelineInterval`, `timelineLayout`, `timeMinutes`, `minuteTime` and `overlaps`. Supply minute intervals, resource IDs, slot labels and open/create callbacks. The default window is 08:00–18:30 at 30-minute intervals; hosts may configure it. Clipped intervals retain identity and overlapping events receive separate lanes. Active events disable intersecting free-slot buttons; cancelled/inactive events remain openable. The host must revalidate availability before writing; this canvas is not concurrency control.

Density controls slot height, time labels use effective formatting, and geometry uses logical inset/start placement for RTL. Result font scale and semantic colors/radius follow the host. The complete time/resource canvas is independent of table page size/resultView; offer a preference-aware List mode when applicable. Native buttons provide keyboard access; there are no custom shortcuts, animations, data fetches or persistence. `disabled` fences slot callbacks after mounted permission changes while preserving read access. Four tests cover half-open intervals, overlap lanes/clipping, occupancy/cancellation and mounted policy/RTL behavior. ERP owns day navigation, resource selection, commands and source-specific details.

## Measured print pagination (phase 6c-5)

`@pepbits/patterns/print-pagination` exports `paginatePrintRows` and `PrintPageRange`. Supply row heights and a page capacity after repeated header/footer space, plus brought-forward, carried-forward and final-summary heights in the same units. It returns ordered, exclusive-end row ranges with one final page, including a summary-only page when necessary. Empty documents retain one final page. Invalid measurements and content taller than a page fail explicitly rather than clipping. The host measures rendered content after fonts load, recalculates on presentation/content changes, supplies repeated headers/page numbers and financial calculations, and gates print until ready. Four pure tests cover exact boundaries, variable rows, carry reservations, summary-only pages and oversized content. This helper owns no currency, paper size, data, styling, persistence or print command.

`@pepbits/patterns/drafts` also exports `useUnsavedWarning(dirty)`: a mounted browser close/refresh warning, detached when clean or unmounted. It does not retain values, guard client-side routes, or imply durable draft storage. `drafts/use-unsaved-warning.test.tsx` verifies attachment and cleanup.

## Multi-step wizard (phase 6e-3)

`@pepbits/patterns/wizard` (also root) is the generic stepper/wizard the plan assigns from `registration-wizard`; product screens stay in their demo. It exports:

| Export | Contract |
| --- | --- |
| `useWizard`, `UseWizardOptions`, `WizardController`, `WizardStep`, `WizardErrors`, `WizardSnapshot` | Controlled step state over host-visible steps: current/completed/reached sets, per-step `validate(id, data)`, `next`/`back`/`goTo`, stepper `jump` (backward free, forward validates the current step, unreached refused), `firstInvalid` for a final submit check, `fail`, `completeAll`, `restore`/`snapshot`, `progress`, and `failures`/`moves` counters for host focus and announcements. Errors are cleared as their values become valid; new errors appear only on an explicit attempt. Steps may appear or disappear with the data. |
| `WizardStepper`, `WizardStepperProps`, `WizardStepperClassNames` | Vertical `nav` of step buttons with `aria-current="step"`, a hidden "(completed)" suffix and reachable-only jumping. Defaults use semantic tokens; hosts replace class slots (state slots are mutually exclusive) to keep a brand presentation. |
| `WizardProgress`, `WizardProgressProps` | Determinate progressbar (0–1) with logical width for RTL. |
| `focusFirstInvalid(container, reducedMotion)` | Focuses the first `aria-invalid="true"`/`data-invalid="true"` element; scrolling is instant under reduced motion. |

The hook renders nothing, fetches nothing and stores nothing: data, drafts, submission and server validation stay with the host. Labels are translated through the host localization; motion follows the effective reduced-motion preference. There are no custom keyboard shortcuts. Four direct tests cover validation/clearing/focus, jump rules and `onEnter`, data-dependent steps and restoration, and read-only/RTL/reduced-motion rendering. The onboarding demo's Orvia registration composes it with its own steps, rules and device draft.

ResourceTimeline accepts optional baseline `geometry`, `labelEvery`, `renderResource` and `eventClassName` for host composition. Slot height still scales with effective density (compact ×0.8, comfortable ×1, spacious ×1.2 for configured geometry); the default layout is unchanged. Dates/resources/status semantics remain host-owned. Calendar tests cover dimensions, overlap lanes and managed density.
