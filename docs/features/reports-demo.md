# Independent reports demo (Lumen Reports)

Feature ID: RPD. State: all 19 Lumen Reports source pages ported into a separate app with local verification. [Delivery record](../releases/unreleased/restructure-phase-6e-1-2026-10-24.md), [test guide 1.0.0](../testing/v1.0.0/PRE-COMMIT.md). Local verification only; every report and number is **fictional demonstration data**, not a production reporting, email or BI service.

## User problem and outcome

Lumen Reports previously existed only as a reference module inside the desktop workspace. It now runs as its own Next.js app built from public `@pepbits/*` packages against the unchanged demo API, with the shared shell, sign-in, preferences and runtime localization. The [app guide](../../demo-apps/reports/README.md) explains setup and routes; the [source mapping](../../demo-apps/reports/source-mapping.md) lists what moved where.

## User and administrator flows

1. Start the synthetic API and the app, then sign in with a local fixture account. The administrator, finance-manager and operations-analyst fixtures can open Reports; their report roles (Administrator, Finance manager, Operations manager) come from the authenticated identity, not from a UI choice.
2. Overview shows recently run reports, favourites, background reports, your access (roles, report count, branches, masking) and upcoming schedules. Ctrl/⌘+Shift+K opens report search while keyboard shortcuts are enabled.
3. Report library: search or filter by category and star favourites. Reports your role cannot view are never listed; opening one directly returns to the library with a notice.
4. Report viewer: pick a period preset or custom dates and other filters, watch the range meter, then Run report. Sort by column, page through results (page size follows your preference and tenant lock), add/remove/reorder columns, and save personal or role views. Charts can be inspected with the keyboard. Totals and masked columns follow the server rules.
5. Export CSV, Excel or JSON (the preferred format first; a managed export format narrows the list), Print an isolated copy of the current result page, Email the report or Run in background. A period too large for the screen offers the background path instead of failing.
6. My reports lists background, scheduled and emailed runs; a job page refreshes while it runs, then pages through the stored result and downloads the file. Signed links in the outbox open `/downloads/:token`, which only the owner, recipients or an administrator can download.
7. Schedules: create from a report, pause/resume, run now, delete; administrators can process due schedules. Email requests: simulate an inbound request and see the logged result. API keys: create (the secret is shown once), copy, revoke; BI tools pull with the key in a header.
8. Builder (roles with `reports.build`): choose a dataset, grouping and measures or detail fields, calculated columns, chart and sharing; preview 25 rows, save, edit or delete. Dashboards: create, edit widgets and their shared period, share and delete. Widget links open the full report.
9. Administration (administrators): roles and the per-report access matrix, users (roles, branches, activation), settings and rules, data sources, the audit log with search/area filters (kept in the URL) and the email outbox.
10. Preferences: language, presentation, formatting, motion and shortcuts use one accepted update path; tenant locks and allowed values disable conflicting choices and replace mounted local state.

## Integration and failure behaviour

ApplicationProviders composes session, preferences, runtime catalog and the shell; the page-engines renderer registry renders one page per route. The module host carries scope, effective preferences, the configured transport and module-relative navigation, and remounts on any identity change. The transport namespaces source paths to `/reference-modules/reports/api/...` with product, module and branch routing headers; the API derives authority from the bearer session. Structured `{error, code, details}` failures drive the source behaviour: `ASYNC_REQUIRED` offers background runs, `TOO_MANY_JOBS` and validation messages appear inline or as toasts, page/report denials navigate to the denied pages, 401 shows the session-expired state, and other failures show a retryable error with the reference code. Unsaved builder input survives preference changes and new host callbacks; there is no durable draft for builder or dialog values.

## Compatibility, localization and accessibility

All labels pass through the runtime translator with the source English text as key; the canonical catalogs already contain the module wording added by the desktop import, and unmapped text stays in English. The four-profile route matrix (default, Arabic RTL, reduced motion, locked density) and full-shell Chromium axe cover every page; jsdom axe does not measure contrast. Native date/time inputs keep ISO values; displayed values use the preference formatter. No source localStorage preference exists and none was added. Automated checks do not establish native-speaker, assistive-technology or domain acceptance.

## Acceptance and limitations

| ID | Contract and verification |
| --- | --- |
| RPD-01 | Shared sign-in/provider chain, `reference-reports` shell module with the source sidebar sections, role visibility and preferences page |
| RPD-02 | All 19 source routes, 28 system report destinations, seeded dashboards and runtime job pages render API data under four profiles with axe |
| RPD-03 | Viewer: filters, range guard, sort, paging, columns, saved views, favourites, charts, totals, export, print, email, background and schedule |
| RPD-04 | Builder preview/save/delete, dashboards create/edit/delete, jobs stored results and downloads, schedules, email-in, API keys and BI pull/revocation |
| RPD-05 | Administration: access matrix, users, settings, sources, audit filter deep link and outbox signed download |
| RPD-06 | Page-size lock/allowed values, export-format lock, shortcut binding, scope-change response fencing; all 22 original source cases retained |
| RPD-07 | Server denials (operations analyst builder, finance administration loaders) and direct HTTP 403/401 checks |
| RPD-08 | Forced root CI, production build, shell Chromium, documentation, source identity and protected-path scans |

Remaining: no original-source pixel comparison; library charts replace the module's own SVG geometry; the fictional store keeps state in memory, advances jobs per request and records email in the outbox without sending it; BI pulls are checked over direct HTTP, not from a BI tool; human language, accessibility and domain review remain pending. The demo is not a deployment.

## Operations and support

Use Node 24 and the existing API runtime environment. Integration checks compare API sources before reusing existing runtime artifacts and record their hashes. The launcher owns temporary storage, services and browser cleanup, including failures and cancellation. Keep credentials, API key secrets and headers out of receipts. Removing the app from use does not change the original desktop consumers or the backend.
