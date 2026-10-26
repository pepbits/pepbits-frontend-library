# @pepbits/components

Reusable React composites: cards, tables, overlays, inline editing and recovery. Version `0.1.0`. The public exports resolve to ESM JavaScript and declarations in `dist`; no application migration is included. React 19 or later is required (and React DOM 19 or later for printing).

Published at **0.1.0** on GitHub Packages. Install with `npm install @pepbits/components` after adding the `@pepbits` registry `.npmrc` and a read token — see the [developer quick start](../../docs/development/PUBLISHING.md#developer-quick-start-for-product-apps). Working examples: the [component showcase](../../demo-apps/showcase/README.md) and the [demo apps](../../demo-apps/README.md).

## Public API

| Group | Exports |
| --- | --- |
| Cards and grids | `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`, `CardGrid` |
| Statistics | `StatTrend`, `StatCard` |
| Tabs |  |
| Dropdowns and actions | `DropdownOption`, `DropdownSelect`, `ActionMenu`, `MenuButton` |
| Overlays | `Modal`, `Drawer`, `CenterRecordCard`, `ConfirmDialog` |
| Tables | `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`, `TableContainer` |
| Presentation |  |
| Pagination |  |
| Calendar | `CalendarProps`, `Calendar` |
| States | `EmptyState`, `ErrorState`, `NotFoundState`, `ConflictState`, `SessionExpiredState`, `LoadingState`, `AccessDenied` |
| Values and descriptions | `DataValue`, `DescriptionItem`, `DescriptionList` |
| Inline editors | `InlineEdit`, `InlineEditNumber`, `InlineEditSelect`, `InlineEditDate`, `InlineEditStatus` |
| Reference data |  |
| Form errors | `FormErrorItem`, `FormErrorSummary` |
| Printing | `PrintDocument` |
| Recovery | `failureFromError`, `RecoveryNotice` |
| Failure descriptors |  |

## Host integration and styling

```tsx
import type {ReactNode} from 'react';
import {createFormatters, createTranslator, directionOf, type TranslationCatalog} from '@pepbits/i18n';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {formatOptionsFrom} from '@pepbits/preferences';
import {PreferenceHost, usePreferences, type PreferenceHostProps} from '@pepbits/preferences/react';
import {PresentationProvider, presentationFromPreferences} from '@pepbits/components';
import {Button, Input} from '@pepbits/ui';
import '@pepbits/tokens/tokens.css';

export function Host({catalogs, children, ...settings}: PreferenceHostProps & {catalogs: TranslationCatalog}) {
  return <PreferenceHost {...settings}><Surface catalogs={catalogs}>{children}</Surface></PreferenceHost>;
}
function Surface({catalogs, children}: {catalogs: TranslationCatalog; children: ReactNode}) {
  const {preferences} = usePreferences();
  const format = createFormatters(formatOptionsFrom(preferences));
  const localization = {language: preferences.language, direction: directionOf(preferences.language),
    t: createTranslator({language: preferences.language, catalogs}), dateTime: format.dateTime};
  return <LocalizationProvider value={localization}>
    <PresentationProvider value={presentationFromPreferences(preferences)}>
      <div dir={localization.direction}>
        <Input label="Name" /><Button>{localization.t('save')}</Button>{children}
      </div>
    </PresentationProvider>
  </LocalizationProvider>;
}
```

The host supplies accepted preference snapshots, tenant policy, availability and its central `update` callback to `Host`. `usePreferences()` resolves effective values, including live locks. The host applies effective theme, font, scale, radius and reduced-motion settings to its surfaces; these components do not persist preferences. Authorization remains a server responsibility. Hosts supply their catalogs, load failures/retries and selected formatters for values; native temporal inputs keep ISO machine values.

Hosts must add **both packages' `dist` directories** to Tailwind's `content` (v3) or `@source` (v4), and import **`@pepbits/tokens/tokens.css`** once. Paths are relative to the host stylesheet/config; for example:

```css
@import "@pepbits/tokens/tokens.css";
@source "../node_modules/@pepbits/ui/dist";
@source "../node_modules/@pepbits/components/dist";
```

The utility classes, semantic tokens and existing `nex-scrollbar` compatibility class are preserved. No precompiled CSS is emitted. The host owns its Tailwind setup and global utilities. Components retain their existing keyboard, focus, ARIA, RTL and reduced-motion behavior; jsdom tests do not establish visual, screen-reader or native-speaker acceptance.

## Differences from ops-ui

- Import this package's assigned exports from `@pepbits/components`; the other layer has its own barrel. There are no deep component subpaths or compatibility re-exports.
- `Localization`, `MessageValues`, `LocalizationProvider`, `useLocalization`, `LocalizedText` and `LocalizationAliasProvider` now come from `@pepbits/i18n/react`. Its default translator uses the 18-key English core catalog, then the literal message, with the same placeholder substitution and default date-time formatting. There is no generated product-catalog fallback. Hosts must supply the unchanged `ui.*`/`recovery.*` message keys used by components (see below); otherwise those keys display literally.
- `formatCurrency` is omitted. Supply formatted strings/callbacks using `createFormatters(formatOptionsFrom(effectivePreferences))`; no currency default is added. `cn` and the original English-only `formatCompact` remain in `ui` for compatibility; hosted regional values should use the host formatter.
- `SourceInput`, `SourceTextarea`, `SourceSelect`, `SourceButton`, `SourceDateInput`, `SourceTimeInput`, `SourceDateTimeInput`, `SourceDialog` and `SourceDialogProps` are excluded. Inspection found only imported reference-design consumers plus their matching Library gallery demo/catalog; their source-parity purpose stays outside this port.
- `presentationFromPreferences(UserPreferences)` is additive. It projects `density`, `zebraStripes`, `stickyTableHeader`, `wrapCellText` and `pageSize` from an already effective snapshot; it neither resolves policy nor stores settings. `PresentationProvider`, its hook and interface are otherwise unchanged.

All retained component signatures, markup, classes, event behavior and explanatory comments are preserved except one product-specific dropdown comment is generalized. Strict root TypeScript settings require non-null assertions after existing bounds/length checks; these erase at runtime. Lucide imports use `@pepbits/icons`; all 16 required icons were already exported and covered by phase 1 tests. The requested split needs no implementation-layer adjustment.

## Preferences, failures and completion boundary

`Table` consumes `PresentationProvider` exactly as before: provided density, stripes, sticky header and wrapping override local table props, including on rerender. `Pagination` remains a controlled component; it does not read the provider itself. Pass the same effective `pageSize` into the data controller and pagination, set `pageSizeDisabled` from policy/availability, and route `onPageSizeChange` through the central guarded update path. The helper does not introduce a second store.

Inline editors retain drafts and show rejected-save errors. Reference fields retain empty/failed/unknown states and host retry callbacks. `classifyFailure` maps a plain `FailureInput` into a UI descriptor; it does not parse HTTP responses or API envelopes. `failureFromError` reads only an error's status/name/reference. Recovery actions belong to the host, preserving operation identity; these components do not perform retries, authentication or durable draft storage. UI locks are not authorization.

No product pages/data, API clients, source-parity controls, schema engines or persistence are included. Error mapping and recovery stay here; no phase 3 transport code is pulled in. Printing retains the React DOM portal behavior and relies on host print styling.

`npm test -w @pepbits/components` runs ported unit/jsdom tests with Testing Library and jest-dom; `npm run typecheck -w @pepbits/components` checks the public source contract. There were no axe-core checks in the original ops-ui unit tests, so none are claimed here. Browser journeys, compiled host CSS, native execution, production services and publication remain outside this increment. See the [phase 2 record](../../docs/releases/unreleased/restructure-phase-2-2026-10-22.md) for exact test counts, adaptations and retained evidence.

## Host message keys

These keys retain their original spelling. Supply translations in the host catalog; the following English text documents the expected generic UI copy and is not an automatically loaded catalog.

| Key | English text |
| --- | --- |
| `recovery.network` | Check your connection. The result is not confirmed; check the record before starting a new operation. |
| `recovery.rate` | Wait a moment, then retry the same action. |
| `recovery.rateTitle` | Too many requests |
| `recovery.resume` | Your work is still here. Retry the pending action when you are ready. |
| `recovery.resumeTitle` | You are signed in again |
| `recovery.retained` | Your values are still here. Keep this page open while recovering. |
| `recovery.return` | Return to page |
| `recovery.session` | Sign in with the same account to continue with your unsaved work. Do not reload or close this window. |
| `recovery.timeout` | The service did not respond in time. The operation may have completed; retry the same action to check its result. |
| `ui.a.reference.list.could.not.be.loaded.a1e0d208` | A reference list could not be loaded. |
| `ui.cancel.19766ed6` | Cancel |
| `ui.close.7d9eb7ac` | Close |
| `ui.next.1ff57a29` | Next |
| `ui.next.page.c08ac736` | Next page |
| `ui.no.match.for.2835c1cf` | No match for “ |
| `ui.no.matching.options.39a118fc` | No matching options |
| `ui.of.a4282e4b` |  of  |
| `ui.previous.a57b08a4` | Previous |
| `ui.previous.page.1208ec01` | Previous page |
| `ui.reference.66d13194` | Reference:  |
| `ui.reload.bdc090ec` | Reload |
| `ui.rows.per.page.141b69f9` | Rows per page |
| `ui.saving.8d3085ef` | Saving  |
| `ui.showing.7282e1fb` | Showing  |
| `ui.sign.in.bfd402b2` | Sign in |
| `ui.some.reference.lists.could.not.be.loaded.e9a89fdf` | Some reference lists could not be loaded. |
| `ui.that.field.533d6c97` | that field |
| `ui.those.fields.1ad330c4` | those fields |
| `ui.try.again.d8b8392e` | Try again |
| `ui.trying.3ff51b0b` | Trying… |
| `ui.unavailable.so.a3f71a82` |  unavailable, so  |
| `ui.will.look.empty.other.fields.are.unaffected.04f888e7` |  will look empty. Other fields are unaffected. |

Literal labels and templates (for example `{count} options`) also pass through the host translator. Composite hosts also supply the [primitive keys](../ui/README.md#host-message-keys).

## Phase 4b pagination integration

`Pagination.allowedPageSizes` is an optional array of supported sizes (10, 20, 50, 100). It filters unavailable options and guards the change callback; omitted preserves the original choices. Page engines pass the effective policy allowance and locked state. The host still owns accepted page-size state and persistence. See the [phase 4b record](../../docs/releases/unreleased/restructure-phase-4b-2026-10-23.md).

## Phase 6a accessible dropdown names

DropdownSelect's trigger name includes its field label and visible selected value, including when `hideLabel` is set. This fixes the composed browser axe label-content check without changing selection/keyboard behavior. Tests cover hidden-label naming and existing interactions. Exact accessible-name queries should include the selection or match the label prefix.

Dropdown field and value spans include an explicit text separator, so their visible and accessible labels agree even when CSS provides the spacing.

## Phase 6b-1 collection slots

`@pepbits/components/collection-view` exports `CollectionView<T>`, `CollectionColumn<T>` and `CollectionViewProps<T>` to provide typed table/card rendering with cell slots, sort callbacks, keyboard row opening and independent row actions. The host owns data, preferences, pagination and commands; pass the effective `resultView` and compose `Pagination`. Existing Table, CardGrid and Presentation behavior is reused. The healthcare demo uses this for product lists instead of copying a table renderer. Three component regressions cover sorting/keyboard/action separation, card presentation and loading/empty states.

StatePanel titles use paragraphs inside their status/alert containers instead of a fixed level-three heading. Embedded loading/empty states no longer create skipped heading levels. Their announcement roles and visible titles are unchanged. See the [6b-1 record](../../docs/releases/unreleased/restructure-phase-6b-1-2026-10-23.md).

`SourceDialog` supplies dialog semantics, localized naming, focus entry/restore, Tab containment and topmost Escape handling through a panel-ref render function. The consumer supplies its frame and busy-close guard. Use Modal/Drawer for standard overlays; SourceDialog supports existing specialized frames without duplicating focus behavior. Nested dialog and focus tests cover its lifecycle.

TableRow makes an `onClick` row focusable and activates it with Enter/Space, while respecting a supplied keyboard handler and leaving nested controls to handle their own keys. TableContainer makes scrollable tables keyboard reachable; `overflow="hidden"` has no default tab stop and callers may override `tabIndex`. These behaviors are covered by keyboard/scroll-container tests.

## Charts and print surfaces (phase 6c-3)

Root exports add `LineChart`, `ChartSeries`, `DonutChart` and `Sparkline`. Hosts supply labels, values and a preference-bound number formatter. Line inspection supports pointer movement and a native select; donut inspection supports focus and pointer entry. Empty/zero/single-point data produce finite geometry. SVG marks use semantic colors and have no animation; hidden sparklines supplement textual KPI values. Tests cover keyboard inspection and degenerate series. These are presentation components, with no product data, filters, drill-down routes or transport.

`PrintDocument` adds optional `className` and `style` for host-owned paper geometry. It still portals only the print surface and removes it on unmount. The ERP invoice explicitly disables screen table presentation inside its physical document and supplies A4 print CSS; the surrounding controls continue using managed preferences. A component test covers geometry/style forwarding and portal cleanup. A browser PDF is not physical-printer acceptance.

DonutChart uses a generic `Total` caption by default; hosts may supply `totalLabel` for domain wording. The showcase Stats example exercises all three chart exports with effective formatting.

## Phase 6d print snapshot

`PrintDocument` optionally accepts `sourceRef`, an element reference (including a host-controlled getter). It snapshots that visible region at `beforeprint`, preserves current input/textarea/select values, and clears the clone at `afterprint` or unmount. Without `sourceRef`, children render as before. Hosts own selection, permission, presentation and print CSS; the component fetches no data. Tests cover current form values and cleanup. Donut labels use a separate text span so accessible inspection can distinguish the label from its formatted value.

When Calendar receives `renderDay`, its day button name includes the visible marker text followed by the localized full date. This keeps event labels available to voice and screen-reader navigation; the default date-only name is unchanged. A regression covers marker/date naming.

## Nonnegative metric charts

Root exports `BarChart`, `HorizontalBars`, `ProgressRing` and `MetricPoint`. Hosts supply labels, colors/units, optional scale/geometry and a preference-bound `formatValue`. Bars provide focusable formatted-value/comparison inspection; horizontal bars show values in text. Invalid/negative metrics become zero, maxima have a positive floor, and geometry clamps to its plot/percentage range. These views are for nonnegative metrics, not signed financial series. Fonts use effective result scale and colors use semantic tokens; no animation, data transport or product vocabulary is owned here. Tests cover keyboard inspection, empty/degenerate data and ring bounds/labels. Scholaris consumes these engines through thin domain adapters.

## Grouped bar chart (phase 6e-1)

Root export `GroupedBarChart` draws grouped bars from the same `ChartSeries` contract as `LineChart`: `label`, `labels`, `series`, `formatValue` and optional `height`. Negative values extend below the zero line; long label sets are thinned and rotated. Every bar carries a `<title>` with label, series and formatted value, several series add a legend, and a native select inspects one label's values from the keyboard. Colors are semantic tokens and there is no animation, data fetching or own formatting. Two tests cover titles/legend/keyboard inspection and negative, NaN and empty data. The reports demo uses it for report and dashboard charts; the showcase Stats example executes it.

## Compact chart presentation and collection headers (phase 6d-2)

`LineChart` accepts optional `layout="compact"`, plot `height`, `min`/`max` and per-series `fill` (compact areas default on). This presentation uses HTML axis labels and a stretched SVG plot; pointer inspection and a focus-revealed native select share the formatted tooltip. Empty/invalid values remain finite. `DonutChart` accepts compact `size`, `thickness`, `center` and per-part `color`; its named legend buttons remain keyboard inspectable. Hosts supply effective result scale, semantic theme tokens and number formatting. Existing standard layouts and callers keep their defaults. No new exports or dependencies.

`CollectionColumn.headerClassName` passes optional presentation metadata to the semantic column header. Table still controls managed density, wrapping, striping and sticky headers. Regression tests cover authored geometry, keyboard inspection, invalid/empty values and effective table preferences.
