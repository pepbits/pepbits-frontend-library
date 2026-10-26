# @pepbits/preferences

Preference types, validation, theme metadata and tenant-policy resolution, with a controlled React bridge to a host's update path. Version `0.1.0`; React consumers require React 19 or later.

Published at **0.1.0** on GitHub Packages. Install with `npm install @pepbits/preferences` after adding the `@pepbits` registry `.npmrc` and a read token — see the [developer quick start](../../docs/development/PUBLISHING.md#developer-quick-start-for-product-apps). Working examples: the [component showcase](../../demo-apps/showcase/README.md) and the [demo apps](../../demo-apps/README.md).

## Public API

`@pepbits/preferences` exports `UserPreferences`, `ThemeKey` and the preference union types; `DEFAULT_PREFERENCES`, `PREFERENCE_OPTIONS`, `PREFERENCE_RANGES`, `sanitizePreferences`, `preferenceOverrides`, `changedPreferenceCount`; `PreferenceKey`, `PreferenceRule`, `PreferencePolicy`, `EMPTY_PREFERENCE_POLICY`, `validPreference`, `parsePreferencePolicy`, `policyDefaults`, `effectivePreferences`, `editablePreferenceOverrides`; `THEME_OPTIONS`; and `formatOptionsFrom`.

`@pepbits/preferences/react` exports `PreferenceHost`, `usePreferences`, `usePreference`, `PreferenceHostProps`, `PreferencesContextValue` and `PreferenceUpdate`. The root entry has no React runtime imports. `LanguageKey` comes from `@pepbits/i18n`.

## Host flow and integration

```tsx
import {createFormatters} from '@pepbits/i18n';
import {formatOptionsFrom, parsePreferencePolicy} from '@pepbits/preferences';
import {PreferenceHost, usePreference, usePreferences,
  type PreferenceHostProps} from '@pepbits/preferences/react';

export function SettingsHost({children, ...host}: PreferenceHostProps) {
  return <PreferenceHost {...host}>{children}</PreferenceHost>;
}

export function PageSizeChoice() {
  const {value, locked, allowedValues, update} = usePreference('pageSize');
  return <button disabled={locked || (allowedValues !== undefined && !allowedValues.includes(50))}
    onClick={() => update({pageSize: 50})}>Rows: {value}</button>;
}

export function Amount({value}: {value: number}) {
  const {preferences} = usePreferences();
  return <span>{createFormatters(formatOptionsFrom(preferences)).money(value)}</span>;
}
// At the API boundary: parsePreferencePolicy(response.policy).
// The host supplies preferences, preferencePolicy, preferencesAvailable and update.
```

1. Validate external policy with `parsePreferencePolicy`. Invalid rules throw; the host supplies loading/error recovery and should set `preferencesAvailable={false}` while its settings are unavailable.
2. Pass stored overrides or a full snapshot in `preferences`. Missing values use policy defaults, then library defaults. Full snapshots count as explicit overrides for unlocked keys. Locked values always win; disallowed values fall back to policy defaults.
3. `usePreferences()` returns effective `preferences`, `isLocked(key)`, `allowedValues(key)` and `update(patch)`. `usePreference(key)` returns the typed `value`, `locked`, `allowedValues` and the same patch callback. `allowedValues` is `undefined` when policy imposes no subset; callers still use `PREFERENCE_OPTIONS` for supported choices.
4. Controls disable managed/unavailable choices, and `update` independently drops locked, disallowed and invalid entries. Mixed patches forward the editable entries in one host callback; empty patches do nothing. A retained callback reads the latest policy and host. Changing policy while mounted immediately recomputes effective values.
5. The host persists, reports failures and supplies the accepted snapshot on rerender. The library has no optimistic preference state, storage, network, automatic retry or DOM theme/font application (PREF-03). The update callback's returned promise or thrown error is passed through to its caller. Hooks outside the provider throw a descriptive error.

Pure functions preserve the existing default, enum, clamping and policy behavior. `sanitizePreferences` drops unknown keys and clamps ranged numeric storage values; `validPreference` rejects values that would require repair. `preferenceOverrides` compares against library defaults, while `editablePreferenceOverrides` compares against policy defaults and excludes locked/disallowed values. UI policy is not server authorization; hosts enforce permissions at their API boundary.

## Compatibility and exclusions

The old generic workspace contract used `preferences`, `preferencePolicy`, `preferencesAvailable`, and `onPreferenceChange(key, value)`. The first three names are retained. The new provider uses one required `update(patch)` callback instead of the optional per-key callback; hosts adapt that call at their existing central update path. The previous `usePreferenceChoice` kept a local demo choice; these hooks intentionally wait for the host snapshot. Unlocking therefore displays the current host value, with no hidden local choice to restore.

All preference keys/defaults remain, including generic `billingLayout`, `defaultModule: ''`, and `clockZone: 'branch'`; no actual module IDs, branch lists, labels or branch time-zone mappings are supplied. The host interprets those generic choices. Theme IDs and swatches stay compatible with CSS; `theme: 'nexora'` remains the default selector. Its display name is now **Blue**, removing the product name while preserving the ID. Other theme metadata is unchanged.

`shortcuts.ts` is intentionally excluded: its registry binds dashboard, record-tab and shell navigation actions. Those actions belong with the host/shell, and carrying the registry here would prescribe navigation behavior before that phase. This package binds no keyboard listeners. No product navigation, generated catalogs, persistence, API clients or application shell is included.

## Verification and completion boundary

`npm test -w @pepbits/preferences` covers ported default/inline-preview tests, enum/range sanitization, policy parsing, locks/allowed values, formatter mapping and mounted React policy changes. The generic locking regression is adapted from the existing workspace tests; product page/template rendering is outside this package. `npm run typecheck -w @pepbits/preferences` checks types. Unit/jsdom evidence does not establish native, browser layout, server authorization or production persistence acceptance.
