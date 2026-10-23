# @pepbits/patterns

Generic lifecycle administration, master-file transfer and server-authorized DCP fields. Phase 4a delivers the product-consumed subset; phase 4b adds approvals, drafts and imports. Priority 3 patterns remain deferred. Version `0.0.0` is an unpublished ESM TypeScript source package, requiring React/React DOM 19 or later. Existing applications keep using their original workspace.

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

There are no placeholder exports for `./form-designer`, `./spreadsheet`, `./label-printing`, `./identity-devices` or `./device-integrations`. Those areas have not been ported.

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

Phase 4b completed priority 2. Approvals, drafts, CSV/workbook options and worker now live here; their six original test files are ported. Remaining exclusions:

| Area/configuration | Reason |
| --- | --- |
| Spreadsheet and remaining form designer | Follow-up patterns work; designer types extend page-template field/section types and the screens own shell/document/AI integration. The independent DCP v1 runtime contract is the only designer configuration needed here. No upward dependency is added. |
| Label printing, identity devices, device integrations | Follow-up extraction of generic ports/UI. Label configuration contains product page/category maps; identity contracts name a specific subject type; device screens rely on product adapters and host station/policy behavior. |
| `dcp-designer*`, `dcp-rules`, `dcp-lifecycle`, repeating logic and `dcp-catalog` | Generic authoring/catalog logic is inspected but unused by DCP v1 fields; defer with the authoring UI and its page-template types. Repeating helpers currently live in `dcp-designer.ts`. |
| `form-rules` | Generic schema rules and their tests now live in page-engines; patterns imports use a minimal structural schema contract to avoid an upward dependency. |
| Product import/classification/inbox registries | Host-owned. Export policy now lives in page-engines and reads explicit column metadata. No product catalogues or seeded notifications/currencies are copied. |
| Developer-Library `library-page.tsx`, product screens, page engines | Showcase pages belong to phase 6; page engines belong to 4b; product definitions remain host-owned. |

The phase 4a package is extended in phase 4b. `LAYERS` is unchanged. No shell, AI, page-engine or original-workspace dependency is introduced.

## Dependency follow-up, testing and support

Master transfer imports `xlsx` using the source package's exact specification: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. npm-distributed XLSX versions have known advisories; retain a security/dependency review as follow-up without silently changing the pinned implementation. Root install currently reports three existing audit findings (one moderate, two critical). No DnD dependencies are needed by this subset. Phase 4b worklist exports use the same XLSX specification in page-engines. Hosts using workbook operations need the original browser APIs, including `DecompressionStream('deflate-raw')`; upload verifies actual expansion before synchronous decoding.

Lifecycle retries preserve the original operation fingerprint and expected revision; conflicts remain explicit. Master transfer retains its pending idempotency key across an uncertain commit response. Hosts enforce permissions, draft retention, sensitive-field policy and production durability. A `ScreenHost` callback or UI lock is not evidence that a server implements those policies.

Run `npm install` and `npm run ci` at the repository root, or the focused `npm run typecheck -w @pepbits/patterns` and `npm test -w @pepbits/patterns`. Tests use generic fixtures, mocked ports and all three providers. See the [phase 4a release record](../../docs/releases/unreleased/restructure-phase-4a-2026-10-22.md) for counts, every ported/deferred test file, source identity, failures/corrections and local evidence. Unit/jsdom checks do not establish compiled CSS, browser journeys, native devices, live services, accessibility-tool or native-speaker acceptance. No published artifact or migration is claimed. Rollback removes this independent increment; existing consumers and stored data are unchanged.

## Phase 4b workflow wiring and compatibility

Provide `<DraftHost adapter={draftAdapter} identity="verified-tenant:application:user" available={sessionAvailable}>` around shared draft, approval and import workflows. The adapter is the existing data-layer `DraftAdapter`; identity must change with the authenticated scope. Missing DraftHost throws instead of guessing transport/session authority. `available=false` prevents autosave and informs recovery UI. `useSharedDraft(scope, enabled, payload)` keeps its original signature, explicit restore/discard, retention/exclusions and identical retry operation identity. No default authenticated request function, token store or product context remains.

Approval props add `productId`, `adapter`, `actorId` and `roleOptions`. Hosts decide where to render `RecordApproval`; the old single-product page gate and fixed role list are removed. Adding a stage selects the first configured role, or leaves it empty until configured. `ApprovalWorkspace` paginates by effective page size instead of a fixed 25. The adapter remains authoritative for per-row eligibility/configuration; the UI does not infer roles. Navigation uses the platform provider and diagnostics use the platform monitor contract. The host localization provider supplies existing approval keys.

`CsvImportDialog` keeps open/close/page/product/onImported props and adds an explicit import adapter and definition (or null). Its page input is structural `{id,title}`; its definition contains the unique field and section fields used for mapping. There is no product registry or upward page-engine dependency. The workflow remounts on identity/application/page change. Original CSV bounds, required mapping, validation/confirmation, resumable jobs, row errors, formula-safe error export and mapping-draft recovery remain. `CsvOptionsEditor`, mapping and workbook helpers retain their APIs. The worker is copied with bounds, formula rejection, cancellation and timeout; hosts must support module workers and browser decompression.

`DraftRecoveryCenter` now receives `application:{id,name,pages}`, its adapter and optional `renderWorkflow(item,onClose)`. The host renders its configured import/approval dialogs through that slot after the service rechecks access; the center does not invent page definitions. It is keyed by verified draft identity/application. Navigation targets and metadata hiding/discard/retry behavior remain. Its 25-row pagination is the existing data-layer service limit (DraftCenterQuery has no page-size parameter); changing that wire protocol is not part of this copy. CSV-option review retains its bounded 50-row staging pages, independent of result-list preferences.

The shared testing export reuses phase 4a provider/catalog/presentation/navigation wiring; callers may add private test messages. The in-memory test document exposes focus, transient drafts, dirty guarding and close subscriptions without pretending to be durable storage or a native shell. Never bundle it as application runtime code.

See the [phase 4b record](../../docs/releases/unreleased/restructure-phase-4b-2026-10-23.md) for current counts and API differences. The earlier phase 4a record remains historical evidence. UI/service ports remain mocked in tests; browser workers, native execution and live server authorization are not certified.
