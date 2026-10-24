# AllyVora patient registration demo

Feature ID: AVP. State: source pages and main workflows implemented with named adaptations; local verification only. [Delivery record](../releases/unreleased/restructure-phase-6e-6-2026-10-24.md), [test guide 1.0.0](../testing/v1.0.0/PRE-COMMIT.md). All data is fictional; this is **not clinical acceptance** or a deployment.

## User problem and outcome

Front-desk staff register, find, view and edit patients, and an administrator chooses how the registration form is arranged for everyone. The AllyVora source app now runs as a separate Next.js demo built from public library packages, with the unchanged AllyVora Express API for patient data and the shared demo API for sign-in, preferences and catalogs. The [app guide](../../demo-apps/allyvora-patients/README.md) explains setup and routes; the [source mapping](../../demo-apps/allyvora-patients/source-mapping.md) lists each source file's destination.

## User and administrator flows

1. Start both APIs and the app, then sign in with a local fixture account through the shared login screen. The register opens at `/patients`.
2. In the register, choose a quick view (All patients, Registered today, Last 7 days, Need more details, Inactive; each shows its count), search by name, MRN, mobile or local-script name, and filter by sex, payer and branch or change the sort. Every choice is kept in the URL, so refresh, browser history and shared links show the same list. Obsolete search responses cannot replace the current results. Page size and table/card view follow the user's preferences. `/` focuses search and `N` starts a registration when shortcuts are enabled.
3. Select a patient to open the record. The wristband band shows name, local name, age, sex, date of birth, blood group, mobile, an allergy stripe and the MRN with a code. Section cards list recorded values (ID numbers masked); each section's Edit opens the form at that section. Details still missing lists optional gaps. Activity shows who changed what. Print uses the browser.
4. Mark a record inactive (or active again) after confirmation; it leaves the register and duplicate checks but keeps its MRN.
5. Register a patient. The form uses the organisation layout (single page, tabs, guided steps, side steps or accordion). Defaults fill the branch, nationality, self pay, outpatient and consent date. The display name builds itself from title and names until edited. A PIN code fills city, district and state. Choosing a department narrows consultants. Typing a mobile number or name and birth date warns about possible returning patients with links to their records. Searchable lists accept typing and Tab to pick the best match. Conditional fields appear only when they apply, and hidden values are not saved.
6. Check form rules lists every rule, which pass, what is missing and jumps to the field. Saving with problems shows a summary with section counts and focuses the first problem; guided steps check each step before moving on. Ctrl/⌘+S saves and Alt+←/→ moves between sections.
7. Save. The API validates with the same shared rules, assigns the branch MRN inside a transaction and opens the new record. Field errors from the API return to their fields. Editing saves with the record version; if someone else saved first, the edit is kept and the conflict explained.
8. The form’s Back/Cancel action asks before discarding changes. An unsaved registration is kept while the registration module remains mounted and offered back when the form reopens; restoring preserves its chosen display name and signature.
9. Administrators open Form layout to choose the arrangement, density, columns, summary band, when problems show and whether drafts are kept. The live preview uses the real form with a fictional sample patient. Save applies to everyone; history lists earlier choices with Use again. The editor's own layout switcher changes the same setting. Other roles can explore the preview but not save.
10. Open Preferences. Language, theme, presentation, formatting, motion and shortcuts follow one accepted update path; tenant locks disable conflicting changes.

## Integration and failure behaviour

Routes resolve through the public page renderer (`allyvora-patients` and `allyvora-layout` kinds). ApplicationProviders composes session, preferences, runtime localization and the shared shell. The typed AllyVora adapter receives a configured base URL (default: the same-origin `/allyvora-api` proxy, whose server-only target is `ALLYVORA_API_URL`) and keeps the source error contract: `message`, 422 field `errors`, 409 conflicts and an offline message. The shared form package `@allyvora/shared` is consumed unchanged, so the client and API use the same definition and rules.

Load failures show the shared recovery notice with retry; missing patients show not found with a way back. Failed saves keep values; network failures are reported as connectivity. Status changes and layout saves report through shell toasts. No business data or patient values are written to browser storage; drafts and the last register query are module memory and disappear on reload, sign-out, identity/branch changes or navigation to Preferences/unknown routes. There is no durable draft service for this form.

The unchanged AllyVora API simulates sign-in as its first seeded user and enforces no roles. Shell role checks gate registration and layout changes in the UI only (PREF-08); audit entries name the API's simulated user.

## Compatibility, localization and accessibility

Effective theme, fonts and scales, radius, table density/stripes/sticky headers, result view, page size, date/time formats, reduced motion (no smooth scrolling) and keyboard-shortcut enablement apply. The organisation layout setting, including form density, is an administrator setting from AllyVora's API, as in the source. Section navigation, tabs and the wizard track respect right-to-left direction. AllyVora wording is not in the protected canonical catalogs and remains English; human language review is not implied.

Shared controls supply labels, descriptions and keyboard behaviour. The new `SignaturePad` is pointer-only; the paper-form option is the keyboard path. Jsdom axe excludes colour contrast; Chromium axe covers full documents in English and Arabic. Automated checks are not assistive-technology acceptance.

## Acceptance and limitations

| ID | Contract and verification |
| --- | --- |
| AVP-01 | Shared sign-in/provider chain, module navigation, preferences page and runtime catalogs |
| AVP-02 | Source URLs and deep links for register, new, edit (with section), view and layout; malformed IDs and unknown paths |
| AVP-03 | Register views, counts, search, filters, sort and preference page size/result view through the AllyVora list API |
| AVP-04 | Record view: band, masked values, gaps, activity and confirmed status change |
| AVP-05 | Registration and editing: defaults, conditional fields, derived name, PIN autofill, dependent lists, duplicates, rules drawer, validation summary, 422/409 handling |
| AVP-06 | All five layouts, guided-step checks, section deep links and the editor layout switcher |
| AVP-07 | Layout designer: options, live preview, save, history reuse, defaults/discard and role gating |
| AVP-08 | Module-memory drafts and form Back/Cancel confirmation without browser storage; shortcuts follow preferences |
| AVP-09 | Four-profile route/axe matrix (default, Arabic RTL, reduced motion, locked preferences) and full-host routes |
| AVP-10 | Real local HTTP workflows against both unchanged APIs, Chromium axe in English and Arabic, forced CI, build and protected-path scans |

Adapted or remaining: patient search, recent patients and layout actions in the global command palette (needs a shell command-source extension); the header branch switcher (branch is chosen in the form); footer API connection status; drafts surviving reload (deliberately session memory); a keyboard alternative for drawing a signature; exact source pixel styling and a source pixel comparison. The source has no tests to port.

## Operations and support

Use Node 24 for the shared demo API and the AllyVora backend's own `npm ci -w backend` for its dependencies. The integration launcher builds the AllyVora API with its documented script, uses temporary databases, and stops every service. Keep credentials and tokens out of receipts. Removing the demo does not change the source app, its backend or the original desktop consumers.
