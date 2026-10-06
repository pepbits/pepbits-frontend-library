# Central platform navigation corrections — 6 October 2026

Feature ID: NAV-CENTRAL-01. Local full CI passed; central consumer acceptance and product deployment are separate.

## Changed behavior

A normal sidebar click still uses the host NavigationPort. Modified clicks on a real URL now keep native browser handling, so Ctrl/Cmd/Shift-click can open the destination without changing the current page. Active leaf and child links expose `aria-current="page"` through the shared NavLink. Desktop button navigation remains supported. No new business permission is granted by a link.

## Host drawer integration

`EnterpriseShell` accepts optional `navigationExpanded`, which passes `forceExpanded` to Sidebar. A mobile host can keep drawer labels visible while the drawer is open without changing a persisted pin preference. The default is false, so existing desktop preferences, pin locks, localization, density, theme and navigation contracts retain their behavior. The host owns drawer focus trapping, dismissal, background inertness and focus on the destination heading.

```tsx
<EnterpriseShell navigationExpanded={mobileMenuOpen} header={header}>
  {page}
</EnterpriseShell>
```

## Compatibility and verification

No labels or translation catalogs changed. The diagnostic sidebar suite covers ordinary/modified clicks, active link semantics, host expansion, existing hover/click behavior and managed pinning. Focused result: 25 cases passed using synthetic component providers; browser new-tab/focus acceptance is performed in the central application against its packed artifacts. This is not native execution or a live product integration result.

The central application currently consumes older source archives with an existing Healthcare host patch. Its adoption must record a narrow backport over those exact archives, separate archive versions and checksums; it must not silently replace them with the current complete shell. Rollback restores the prior package pins and host code together. There is no data migration.

## Complete local CI result

`npm run ci` passed with Node 24.21.0: all package/desktop typechecks; 2,566 frontend tests passed (7 skipped across 2 skipped files); 370 API tests; 4 suite-registry tests; 14 deployment-mechanics tests; web and desktop-browser builds; and all normal property gates. Documentation validation and six documentation-tool cases also passed. [Source fingerprints and receipt](central-navigation-source-2026-10-06.json) identify the tested bytes. The 25 focused sidebar cases overlap the full frontend count. Hosted CI, native execution and live deployment are not claimed.
