# @pepbits/ui

Reusable React primitives: controls, selection, status and navigation. Unpublished version `0.0.0`, copied into the independent root workspace. The single `.` export exposes TypeScript source through `src/index.ts`; no build artifact or application migration is included. React 19 or later is required.

## Public API

| Group | Exports |
| --- | --- |
| Classes and compact formatting |  |
| Buttons |  |
| Form controls | `inputClass` |
| Choices | `RadioGroup`, `RangeField` |
| Temporal inputs | `DateTimeInputProps`, `DateInput`, `TimeInput`, `DateTimeInput`, `MonthInput`, `WeekInput`, `DateRangeInput` |
| Quantity and unit | `QuantityUnitValue`, `QuantityUnitPreview`, `QuantityUnitFieldProps`, `QuantityUnitField` |
| Scanner input | `ScannerInput` |
| Option matching | `FilterableOption`, `filterOptions`, `nextEnabledIndex`, `Highlight` |
| Search selection | `SearchSelectOption`, `SearchSelect` |
| Segmented choices | `SegmentedOption`, `Segmented` |
| Badges |  |
| Avatars | `initialsOf`, `washFor`, `Avatar` |
| Skeletons | `Skeleton`, `TableSkeleton`, `DashboardSkeleton`, `FormSkeleton` |
| Navigation link | `NavLinkProps`, `NavLink` |

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

Hosts must add **both packages' `src` directories** to Tailwind's `content` (v3) or `@source` (v4), and import **`@pepbits/tokens/tokens.css`** once. Paths are relative to the host stylesheet/config; for example:

```css
@import "@pepbits/tokens/tokens.css";
@source "../node_modules/@pepbits/ui/src";
@source "../node_modules/@pepbits/components/src";
```

The utility classes, semantic tokens and existing `nex-scrollbar` compatibility class are preserved. No precompiled CSS is emitted. The host owns its Tailwind setup and global utilities. Components retain their existing keyboard, focus, ARIA, RTL and reduced-motion behavior; jsdom tests do not establish visual, screen-reader or native-speaker acceptance.

## Differences from ops-ui

- Import this package's assigned exports from `@pepbits/ui`; the other layer has its own barrel. There are no deep component subpaths or compatibility re-exports.
- `Localization`, `MessageValues`, `LocalizationProvider`, `useLocalization`, `LocalizedText` and `LocalizationAliasProvider` now come from `@pepbits/i18n/react`. Its default translator uses the 18-key English core catalog, then the literal message, with the same placeholder substitution and default date-time formatting. There is no generated product-catalog fallback. Hosts must supply the unchanged `ui.*`/`recovery.*` message keys used by components (see below); otherwise those keys display literally.
- `formatCurrency` is omitted. Supply formatted strings/callbacks using `createFormatters(formatOptionsFrom(effectivePreferences))`; no currency default is added. `cn` and the original English-only `formatCompact` remain in `ui` for compatibility; hosted regional values should use the host formatter.
- `SourceInput`, `SourceTextarea`, `SourceSelect`, `SourceButton`, `SourceDateInput`, `SourceTimeInput`, `SourceDateTimeInput`, `SourceDialog` and `SourceDialogProps` are excluded. Inspection found only imported reference-design consumers plus their matching Library gallery demo/catalog; their source-parity purpose stays outside this port.

All retained component signatures, markup, classes, event behavior and explanatory comments are preserved except one product-specific dropdown comment is generalized. Strict root TypeScript settings require non-null assertions after existing bounds/length checks; these erase at runtime. Lucide imports use `@pepbits/icons`; all 16 required icons were already exported and covered by phase 1 tests. The requested split needs no implementation-layer adjustment.

## Preferences, failures and completion boundary

Primitives remain controlled by their host. Disable locked or unavailable choices and guard their handlers through `PreferenceHost` updates. Labels and presentation text use the localization provider; input values, option codes and scanner payloads stay literal. Existing validation/error slots and disabled semantics remain. No local preference store, product data, page engine, transport, generated catalogs or source-parity controls are included. Composite preferences and table controllers belong to the host integration above.

`npm test -w @pepbits/ui` runs ported unit/jsdom tests with Testing Library and jest-dom; `npm run typecheck -w @pepbits/ui` checks the public source contract. There were no axe-core checks in the original ops-ui unit tests, so none are claimed here. Browser journeys, compiled host CSS, native execution, production services and publication remain outside this increment. See the [phase 2 record](../../docs/releases/unreleased/restructure-phase-2-2026-10-22.md) for exact test counts, adaptations and retained evidence.

## Host message keys

These keys retain their original spelling. Supply translations in the host catalog; the following English text documents the expected generic UI copy and is not an automatically loaded catalog.

| Key | English text |
| --- | --- |
| `ui.filter.options.62b72239` | Filter options |
| `ui.loading.dc380888` | Loading |
| `ui.no.matching.options.39a118fc` | No matching options |

Literal labels and templates (for example `{count} options`) also pass through the host translator.
