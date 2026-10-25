# @pepbits/ui

Reusable React primitives: controls, selection, status and navigation. Unpublished version `0.0.0`, copied into the independent root workspace. The single `.` export exposes TypeScript source through `src/index.ts`; no build artifact or application migration is included. React 19 or later is required.

## Public API

| Group | Exports |
| --- | --- |
| Classes and compact formatting |  |
| Buttons | `Button`, `IconButton` |
| Native-layout controls | `SourceButton`, `SourceInput`, `SourceSelect`, `SourceTextarea`, `SourceDateInput` |
| Form controls | `inputClass` |
| Choices | `RadioGroup`, `RangeField` |
| Temporal inputs | `DateTimeInputProps`, `DateInput`, `TimeInput`, `DateTimeInput`, `MonthInput`, `WeekInput`, `DateRangeInput` |
| Quantity and unit | `QuantityUnitValue`, `QuantityUnitPreview`, `QuantityUnitFieldProps`, `QuantityUnitField` |
| Scanner input | `ScannerInput` |
| Option matching | `FilterableOption`, `filterOptions`, `nextEnabledIndex`, `Highlight` |
| Remote lookup | `AsyncLookup` (host-loaded combobox, cancellation/stale-response fencing and custom record slots) |
| Search selection | `SearchSelectOption`, `SearchSelect` |
| Segmented choices | `SegmentedOption`, `Segmented` |
| Signature capture | `SignaturePad` (controlled PNG data URL, phase 6e-6) |
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

## Phase 6a accessible trigger names

SearchSelect's trigger name now includes both its field label and displayed selection (or placeholder). This aligns speech-input names with visible text; keyboard/listbox behavior is unchanged. A regression verifies the visible value is included. Consumers querying the exact old label should use the complete name or a label-prefix matcher.

Native-layout controls keep standard HTML layout and refs while translating accessible names, placeholders and button text. The host supplies appearance and effective preferences; disabled/required/ARIA attributes remain native. `SourceButton` defaults to `type="button"`; `SourceDateInput` retains an ISO date value. They do not resolve permissions or persist settings.

`AsyncLookup<T>` accepts `loadOptions(query, signal)`, `getKey`, `renderOption` and `onPick`. The host owns transport and record content. `initialQuery`, `minChars` and `debounceMs` configure searching; stale results are fenced even when a loader ignores cancellation. Arrow keys select, Enter picks, Escape closes and Tab leaves the control. Failed queries retain input and recover when the user edits the query. The host translator supplies labels and the existing `Something went wrong` / `Try again` messages; appearance uses shared semantic tokens.

AsyncLookup also accepts native field `id`, `disabled` and `invalid`. Disabling a mounted lookup aborts obsolete reads and hides its options. Healthcare RCM composes selected-value chips around it; endpoints and selection values stay with the product adapter.

`SourceTimeInput` and `SourceDateTimeInput` preserve native `time` and `datetime-local` values, constraints, refs and accessible names for imported layouts. They use the existing SourceInput localization contract; hosts format read-only clock values separately.

## Field interoperability

The root exports `optionsFromChildren` and `splitFieldClasses` for adapting native-style field metadata to shared controls. Options preserve raw service values, including LocalizedText message identity; placeholder options are handled separately. Field class splitting uses the effective form scale. These pure helpers do not add a second select/input renderer. The ERP core port retains their original assertions; Showcase's Select example demonstrates both and its generated snippet is refreshed.

Direct `field-interop.test.tsx` cases cover nested fragments/optgroups, numeric and implicit values, translated labels, empty placeholders, logical padding, effective form-scale conversion and wrapper-class retention. These helpers remain pure metadata adapters.

## One-time code input (phase 6e-3)

The root exports `OtpInput` and `OtpInputProps`: separate digit boxes that behave as one field. Typing advances, Backspace clears and moves back, arrows move in reading direction (mirrored for RTL), and paste/autofill spreads digits; only digits are accepted. `onComplete` fires once every box holds a digit. The group is named by the translated `label`, each box by `Digit {index} of {length}`, and `describedBy` attaches an error or hint. Defaults use semantic tokens, `--radius` and `--fs-scale`; `boxClassName`, `idleClassName`, `filledClassName` and `invalidClassName` replace the default presentation instead of stacking conflicting classes. Verification, resend timers and rate limits remain host responsibilities. Five direct tests cover advancing/completion, paste/backspace, native deletion, unchanged completion, focus after empty boxes and RTL arrows; the Showcase control-states example executes it, and the onboarding demo uses it for its sign-in code.

`Segmented` also accepts optional `id`, `style`, `classes` (`group`, `option`, `selected`, `idle`), decorative background content and `renderOption`. These presentation slots let imported designs reuse its radio semantics, disabled-option guards and roving focus instead of copying the renderer. Defaults remain compatible; left/right keys now follow the localization direction. The host localizes custom option content and applies effective motion to decorative animation. Two added tests cover custom presentation with disabled options and RTL selection/focus. Orvia's wrapper supplies its source sliding indicator and count badges through these slots.

## Signature capture and quick pick (phase 6e-6)

`SignaturePad` draws pointer/pen/touch strokes on a white paper surface and reports a controlled PNG data URL (`value`/`onChange`, optional `onBlur`). `label`, `hint`, `error`, `required` and `disabled` follow the other fields; the clear action resets the value to `null`. The canvas is an `img`-role region named by `areaLabel` (plus "(required)") and described by the hint or error. Image roles allow no state attributes, so the invalid state is a visible error and a `data-invalid` marker. Ink stays dark on white in every theme because the image is archived and printed. Host value changes redraw restored signatures or clear the bitmap; obsolete image loads are ignored. Without a 2D canvas context the surface renders but cannot draw or report a signature. Drawing is pointer-only: hosts that require a keyboard path must offer an alternative capture, such as AllyVora's paper-form reference. The host owns storage, validation and any retention policy.

`SearchSelect` adds optional `quickPick`. Typing a printable character on the focused, closed trigger opens the list with that text; Tab after typing commits the highlighted match and advances focus from the persistent trigger to the next field. Without `quickPick`, Tab still closes without choosing and typing on the trigger does nothing. Tests cover typing-to-open, Tab commit, unchanged default behaviour, empty-query Tab, signature draw/clear, error description, disabled input and missing canvas support. The AllyVora demo uses both; the showcase Choice example demonstrates `SignaturePad`.

## Avatar accent contrast (phase 6e-5)

The accent Avatar wash previously used the raw `--accent` hue for its initials. Phase 6e-5 changed its foreground to `--accent` mixed 60/40 with the theme's `--text` (superseded by phase 6c-6; see below), darker on light themes and lighter on dark ones; the other four washes already used ink tokens. Names, seeds, sizes and accessibility attributes are unchanged. An avatar test asserts that no wash uses a raw accent foreground. Chromium contrast was verified in the final live check (25 workflows, 18 routes, no axe violations). See the [phase 6e-5 record](../../docs/releases/unreleased/restructure-phase-6e-5-2026-10-24.md).

Phase 6c-6 fixed the same failure independently with the effective `--text` token. On merge (25 October 2026) the 6e-5 60/40 mix failed the 6c-6 shell Chromium fixture in four of 14 themes (nexora, emerald, nord, solarized), so the `--text` foreground replaced it. The fixture checks four shared surfaces in all 14 themes. Name-based wash selection, photographs and accessible names are unchanged.
