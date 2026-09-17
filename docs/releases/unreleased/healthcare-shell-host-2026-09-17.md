# Verification — Healthcare shell host and preference policies

Feature: reusable web host presentation and tenant-governed personal preferences.
Testing guide: 1.0.0. Source base: `2f8c5b42bd33c609d344c9ea410c2d29503ce40e` plus the
reviewed `healthcare-host.patch` in Healthcare Enterprise; exact package digest is recorded in
that consumer's `healthcare-frontend.lock.json` (`0.0.0-hc061.3`). No registry publication or
commit is claimed. Environment: Node 24.21.0, Linux, 17 September 2026 UTC. Executor: Codex.
Hosted CI: not run. This is targeted library verification and built consumer acceptance.

## Reusable changes

- `ShellHostProvider`: trusted host branch choices/current selection, tenant/status/release labels,
  branch timezone and inbox availability. Demo defaults remain available only to standalone demos.
- Default header/footer consume host data without replacing their shared visual design. Branch
  changes use current asynchronously loaded choices. Narrow headers keep branch/profile accessible.
- `PreferencesPage` is a public subpath. `allowedValues` policies constrain controls, imports and
  shared update handlers. Policy locks remain enforced. Numeric choices retain their value types.
- `RecordSectionLayout` is a public subpath, with optional completion display for hosts that cannot
  claim a calculated completion percentage. Existing default behaviour is retained.
- Empty dropdown choices render safely during access loading. Preference grids shrink on narrow
  screens; theme cards fill their cells. Generated fallbacks now include the `preferences.*` namespace.

## Tests

Targeted Vitest command runs `dropdown.test.tsx`, `preferences.test.tsx`, `erp-context.test.tsx`
and `chrome.test.tsx`: 76 tests passed. Regressions cover empty options, asynchronously loaded
host branches, allowed choices, bulk preference updates, locked settings and existing shell controls.
`npm run typecheck`: all packages and desktop application passed. Healthcare's production Next
build typechecks the actual packaged public exports and host composition. Localization fallback
synchronization check passes. Consumer evidence is in
`pepbits-healthcare-enterprise/docs/releases/0.8.0-SNAPSHOT/SHARED-SHELL-PREFERENCES-2026-09-17.md`.

Initial consumer checks exposed an empty-branch crash, stale branch callback, responsive clipping
and missing preference translations. Corrected in shared sources and repackaged; no installed
node_modules implementation was edited. Full library API/desktop/native/hosted CI matrices were
not rerun or claimed. Consumer database/auth/browser tests do not certify unrelated demo services.

## Host usage

Mount `ShellHostProvider` outside `ERPProvider`. Supply branches already filtered by the backend;
the presentation adapter never grants authorization. Supply `ProductProvider.preferenceRequest`
for `/preferences` GET/PUT using the host's authenticated BFF. Responses contain effective
preferences, policy revision/rules, user revision and `canManage`. Keep tenant policy administration
in a separate authorized application. Store personal overrides on the server, not in global
browser preference JSON. Preferences affect presentation only; domain authorization stays server-side.

Healthcare self-hosts the matching Fontsource families under its CSP. The package does not require
Google Fonts at runtime; other hosts may use their own licensed deployment of the same families.
