# @pepbits/i18n

Host-driven translation, language direction, API-message localization and value formatting. This unpublished `0.0.0` source package is independent of React, preference storage and product schemas.

## Public API

The root export provides `LanguageKey` (`en | ar | hi | ml`), `LANGUAGE_OPTIONS`, `LANGUAGE_LOCALES`, `directionOf`, and `CORE_CATALOG` (the original 18 keys in each language). Translation exports are `createTranslator`, `createCatalogStore`, `TranslatorOptions`, `Translator`, `TranslationValues`, `TranslationCatalog`, `Messages`, `CatalogLoader` and `CatalogLoaders`.

Presentation exports are `localizeApiMessage`, `localizeFieldError`, `localizeImportError`, `localizeApprovalNotice`, `createFormatters`, `Formatters`, `FormatOptions` and `FormatColumn {type?: string}`. All public imports use `@pepbits/i18n`.

## Host flow and integration

```ts
import {createCatalogStore, createTranslator, directionOf, createFormatters} from '@pepbits/i18n';

const store = createCatalogStore({
  catalogs: {en: {'welcome': 'Welcome {name}'}},
  loaders: {ar: async () => ({welcome: 'مرحباً {name}'})},
});
const language = 'ar'; // use the host's effective language preference
const t = createTranslator({language, catalogs: store.catalogs});
await store.loadCatalog(language);
t('welcome', {name: 'Sam'});
directionOf(language); // rtl; the host applies dir to its own DOM

const format = createFormatters({
  currencyCode: 'INR', numberLocale: 'en-IN', dateFormat: 'dmy',
  decimalPlaces: 2, timeFormat: '24h', currencyDisplay: 'code',
  negativeStyle: 'parentheses', language,
}); // illustrative options; hosted UI passes effective preferences
format.cell({type: 'money'}, 1234.5);
```

1. The host registers immediate catalogs and lazy loaders in a store per application/request. Loaders return messages or an imported module with a `default` messages export; English may also load lazily.
2. `createTranslator({language, catalogs, overrides})` looks up own string entries in this exact order: locale override → locale host catalog → locale core → English override → English host catalog → English core → literal key. Empty translations are valid. An invalid runtime language falls back to English.
3. `{word}` placeholders use only own values and `String(value)`; unknown placeholders remain intact. Substituted text is not recursively interpolated. The helpers translate known message wrappers while preserving record values and administrator-entered stage names.
4. `store.loadCatalog(language)` deduplicates pending loads and skips populated catalogs. Unregistered languages need no load; rejected loads propagate to the host and can be retried. Empty successful loads stay cached. Translators see the updated store on their next call; the host must trigger its own render after loading and create a new translator when language changes.

The host owns catalog transport, authorization, loading/error UI, retries and language changes. Catalogs are mutable host-owned objects, so use separate objects/stores for isolated hosts. No network request or language is registered globally by the library.

## Formatting and compatibility

`FormatOptions` contains `currencyCode`, `numberLocale`, `dateFormat`, `decimalPlaces`, `timeFormat`, `currencyDisplay`, `negativeStyle` and optional `language`. It accepts host currency/locale strings; invalid `Intl` options may throw. Hosts validate settings before calling. `@pepbits/preferences` supplies `formatOptionsFrom(effectivePreferences)` without introducing a reverse dependency.

Money, compact numbers, plain numbers, percentages, calendar dates, clock times, date-times and typed cells retain the original formatter behavior. Calendar strings are read without UTC conversion; `Date` instances use local parts. The UI language controls month/day-period words independently of numeric locale. Missing cells render an em dash. Unknown messages pass through; invalid API descriptors use the readable fallback. Explanatory accounting/time-zone comments remain in source.

## Intentionally excluded and verification

No generated product catalogs, product names, module registry, branch data, backend client or React provider. `LocaleProvider`/`useTranslation` are deferred to phase 2, when the UI consumer contract is available. There is no global `translate`, `UI_MESSAGES` or `loadFallbackLanguage`; the factories replace their singleton ownership while retaining lookup behavior. Hosts continue to own their canonical message sources and generation workflow.

`npm test -w @pepbits/i18n` includes adapted localization/formatting cases, lookup precedence, malformed descriptors, placeholders, lazy-load retries/isolation and formatting edges. `npm run typecheck -w @pepbits/i18n` checks the public contract. These are local unit checks, not native-speaker review or live catalog-service acceptance.
