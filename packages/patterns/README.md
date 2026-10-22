# @pepbits/patterns

Generic lifecycle administration, master-file transfer and server-authorized DCP fields. Phase 4a delivers the required product-consumed subset; the remaining patterns are explicitly deferred. Version `0.0.0` is an unpublished ESM TypeScript source package, requiring React/React DOM 19 or later. Existing applications keep using their original workspace.

## Public API by area

The root barrel re-exports the following areas. Prefer subpaths to avoid loading unrelated UI or the workbook decoder.

| Subpath | Public API |
| --- | --- |
| `./lifecycle` | `LifecycleConfigurationPage`, its props/notification types; catalogue tree, worklist/status badge, definition/binding/applicability editors, governance, validation/resolve preview, host/version/source panels and source-catalog hook. Also the complete generic lifecycle contract, guards, model helpers, operation keys, `createLifecycleHttpApi`, `createLifecycleSourceHttpApi`, request/contract errors and source-mapping helpers formerly in the configuration package. |
| `./master-transfer` | `MasterTransferPanel`, `MasterTransferPanelProps`, `MasterTransferPort`, `MasterTransferPreview`, `PricingExpressionInput`, `MasterTransferData`, `MASTER_TRANSFER_LIMITS`, `parseMasterTransfer`, `readMasterTransfer`, `exportMasterTransfer`. |
| `./dcp-fields` | `DcpRuntimeFields`, `DcpSectionFields`, `DcpFieldRenderer`; the complete DCP v1 wire types, `DCP_RUNTIME_TYPES`, `isDcpRevision`, `isDcpNumber`, `isDcpValues`, `isDcpRuntimeView`, `isDcpLoaded`, `isDcpSaved`, `dcpWritablePatch`. |
| `./screen-host` | `ScreenHostProvider`, `useScreenHost`, `useFormatters`, `ScreenHost`, `ScreenHostValue`, `ScreenScope`, `ScreenDocument`. |

There are no placeholder exports for `./form-designer`, `./approvals`, `./drafts`, `./imports`, `./spreadsheet`, `./label-printing`, `./identity-devices` or `./device-integrations`. Those areas have not been ported.

## User and administrator flows

1. Lifecycle: supply a verified application namespace, permissions, actor and API port. Users search versions, open a definition, edit its structure/bindings/mappings, enter a change reason and save. Validation and resolution use the server; independent approval, publication and activation follow the existing governance rules. Read denial, unavailable configuration, loading, empty lists and recoverable failures remain distinct states. Leaving a dirty definition asks before discarding it.
2. Master transfer: download a CSV/XLSX template or current records, upload literal values, enter a reason, validate on the server and commit the reviewed rows. Editing the reason or file invalidates validation. `CREATE` and `UPSERT` modes, revision fields, row/byte/expansion limits, formula rejection, export cursor checks and retry operation identity are preserved. `PricingExpressionInput` edits expression text; it never evaluates scripts or authorizes prices.
3. DCP fields: render the supplied server-filtered view and retain changed values in the host. Masked values never reach a custom renderer. Existing collection rows require their own `rowFields`; create-field metadata never authorizes an existing row. Required collections cannot lose their final row. `DcpSectionFields` projects selected fields from the active row. Server validation/save, conflict recovery and durable drafts stay with the host.

Lifecycle draft releases are business configuration versions, not autosaved form drafts. Unsaved editor values remain in mounted React state after recoverable failures. No browser storage or durable draft service is added by this increment.

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

The host supplies accepted preference snapshots, policy, availability and the central `update(patch)` callback. There is no local preference persistence or optimistic preference store. `useFormatters()` memoizes `createFormatters(formatOptionsFrom(effectivePreferences))` by the actual formatting options. The host also applies effective theme, font, scales, radius and reduced motion to its surfaces. Lifecycle provides effective table presentation internally; standalone panels should use the surrounding `PresentationProvider` above. Managed/unavailable page-size settings override explicit lifecycle list-size props; unlocked props still select a server-supported limit. Permission hints and `can` are UI gating only (PREF-08); servers must enforce every read and write.

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

The included screens do not call AI slots. The AI layer can fill them after phase 5; no AI source or dependency is included. Shell implements document ownership/focus/drafts in phase 5. There is no invented error-monitor, documentation-center, tour-event or dashboard callback: the selected screens do not use those services.

## Differences from erp-screens

- Imports use the four area subpaths or root barrel; configuration contracts needed by the selected screens are co-located here and exported with their area. Primitives, composites, localization and CSV parsing use the existing lower-layer packages. There are no compatibility re-exports from the original workspace.
- `LifecycleConfigurationPageProps` no longer extends the old optional preference-prop interface: `preferences`, `preferencePolicy`, `preferencesAvailable` and `onPreferenceChange` move to the central `PreferenceHost` provider (`update` replaces the old setter). The page now requires that provider. Effective preferences drive presentation; absent `pageSize`/`sourcePageSize` props use effective `pageSize` (the current standalone preference default is 20, previously both were 25), and managed/unavailable settings take precedence over explicit size props. Server caps still apply. The lower-level standalone source-catalog hook retains its 25-row default.
- Lifecycle notifications and dirty-state callbacks retain their signatures and precedence; their absent-prop behavior now forwards to ScreenHost, whose defaults are no-ops. The detailed lifecycle notification's `operation` remains available through the explicit callback; the generic host notification intentionally receives only message/tone.
- `DcpRuntimeFields` now requires `PreferenceHost` for selected formatting. Read-only integer/decimal/date/date-time values use effective formatters instead of raw string conversion. Editable number and temporal inputs, wire values, rendering extensions, collection identity and server authorization checks are unchanged.
- Master transfer and pricing expression component props, workbook/CSV helpers, lifecycle HTTP/configuration contracts and DCP v1 types/guards retain their original signatures. `ScreenHost` and `useFormatters` are additive. No other retained API is changed.
- Strict indexed-access assertions are type-only and erase at runtime. Product-specific comment examples are generalized. Test-only fixture names are neutralized; original behavioral assertions remain, with providers/imports and an explicit source-list size adapted for the new preference boundary.

## Intentionally not included

The owner permits stopping after a smaller complete increment. This package includes all three mandatory areas and their eight existing generic test files. The rest of the requested scope is deferred:

| Area/configuration | Reason |
| --- | --- |
| Approvals | The screen includes hardcoded roles, a customer-page condition, product-service contexts and session/navigation ownership. A follow-up needs injected configuration and data ports. |
| Draft center and `use-shared-draft` | They depend on product request contexts, verified session/token state, page registries and the import/approval dialogs. Existing `@pepbits/data` draft contracts remain the intended storage boundary. |
| Imports, CSV/workbook options and worker | The dialog imports a customer-only import-definition registry and page/entity types. Defer the whole area, including standalone options helpers, to keep that workflow coherent. |
| Spreadsheet and remaining form designer | Follow-up patterns work; designer types extend page-template field/section types and the screens own shell/document/AI integration. The independent DCP v1 runtime contract is the only designer configuration needed here. No upward dependency is added. |
| Label printing, identity devices, device integrations | Follow-up extraction of generic ports/UI. Label configuration contains product page/category maps; identity contracts name a specific subject type; device screens rely on product adapters and host station/policy behavior. |
| `dcp-designer*`, `dcp-rules`, `dcp-lifecycle`, repeating logic and `dcp-catalog` | Generic authoring/catalog logic is inspected but unused by DCP v1 fields; defer with the authoring UI and its page-template types. Repeating helpers currently live in `dcp-designer.ts`. |
| `form-rules` | Generic but unused by the included screens; keep with future schema/import work. |
| `imports`, `export-policy`, `data-classification`, `inbox` configuration | Import-definition lookup is product-specific; export policy uses a product field-classification registry; inbox mixes generic types with hardcoded product notifications/currencies. None is required here, and no catalogs or seeded data are copied. |
| Developer-Library `library-page.tsx`, product screens, page engines | Showcase pages belong to phase 6; page engines belong to 4b; product definitions remain host-owned. |

Only `packages/patterns` is added. `LAYERS` is unchanged. No shell, AI, page-engine or original-workspace dependency is introduced.

## Dependency follow-up, testing and support

Master transfer imports `xlsx` using the source package's exact specification: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. npm-distributed XLSX versions have known advisories; retain a security/dependency review as follow-up without silently changing the pinned implementation. Root install currently reports three existing audit findings (one moderate, two critical). No DnD dependencies are needed by this subset and XLSX is not added to another package. Hosts using workbook operations need the original browser APIs, including `DecompressionStream('deflate-raw')`; upload verifies actual expansion before synchronous decoding.

Lifecycle retries preserve the original operation fingerprint and expected revision; conflicts remain explicit. Master transfer retains its pending idempotency key across an uncertain commit response. Hosts enforce permissions, draft retention, sensitive-field policy and production durability. A `ScreenHost` callback or UI lock is not evidence that a server implements those policies.

Run `npm install` and `npm run ci` at the repository root, or the focused `npm run typecheck -w @pepbits/patterns` and `npm test -w @pepbits/patterns`. Tests use generic fixtures, mocked ports and all three providers. See the [phase 4a release record](../../docs/releases/unreleased/restructure-phase-4a-2026-10-22.md) for counts, every ported/deferred test file, source identity, failures/corrections and local evidence. Unit/jsdom checks do not establish compiled CSS, browser journeys, native devices, live services, accessibility-tool or native-speaker acceptance. No published artifact or migration is claimed. Rollback removes this independent increment; existing consumers and stored data are unchanged.
