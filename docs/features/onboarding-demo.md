# Independent onboarding demo (Orvia Health Cloud)

Feature ID: ONB. State: all four source pages and their workflows ported; fictional demonstration only. [Delivery record](../releases/unreleased/restructure-phase-6e-3-2026-10-24.md), [test guide 1.0.0](../testing/v1.0.0/PRE-COMMIT.md). Local verification only; this is not a tenant, identity or registration service and not a deployment.

## User problem and outcome

The Orvia Health Cloud onboarding demo shows how a multi-tenant healthcare SaaS presents itself, lets staff find their organization's workspace, signs them in with a second step and registers a new organization. It now runs as a separate Next.js app built only from public `@pepbits/*` packages, inside the same shared shell and preference host as the healthcare and ERP demos. The [app guide](../../demo-apps/onboarding/README.md) explains setup and routes; the [source mapping](../../demo-apps/onboarding/source-mapping.md) lists every source file's destination and the deliberate differences.

## User and administrator flows

1. Start the synthetic API and app, then sign in with a local fixture account through the shared login screen. Branch and role come from the authenticated session; the header shows the Orvia onboarding module and its sidebar groups.
2. Landing (`/`): read the hero, step through the outpatient care pathway with the mouse or arrow keys (reading direction), pick organization types in the facility explorer and use Register as … to open the registration with that type (or network structure) pre-selected.
3. Find your workspace (`/workspace`): type an address (`stmarys`, `stmarys.orvia.health` or a full URL). The live lookup shows the workspace, an unknown-address message or a validation error; Continue opens its sign-in. Or switch to Work email to list workspaces for the email domain. Recently used workspaces on this device, or sample workspaces, are one click away.
4. Sign in (`/sign-in?ws=…`, also `/login?ws=…`): workspaces with single sign-on show the SSO action (a notice in this demo). Enter email and password, then the 6-digit code (typing, paste or autofill); Back returns to credentials. Forgot password sends a reset confirmation. A pending workspace shows its license-review notice. Without a known workspace the page asks you to find one first.
5. Register (`/register`, `?type=`, `?structure=network`): six steps, seven for networks — organization type, details, facilities (networks), clinical scope, modules and standards, workspace and administrator, review. Country fills time zone, currency, dial code and suggested data region; entering steps pre-selects care settings, modules, local integrations, a workspace address and the head-office facility, each announced and editable. Continue validates the step, focuses the first problem and clears errors as they are fixed. The stepper jumps back freely and forward only after validation. Review shows every section with Edit links; the three agreements are required. Submit returns a reference and next steps; the new workspace is discoverable as pending.
6. Leave and return: form fields autosave on this device (never the administrator password) and are restored with a notice; Save and exit flushes changes immediately. Blocked/full storage keeps the form open with a warning, and submission cannot claim a saved workspace after a storage failure. The draft is deleted after submission.
7. Preferences: the shared preferences page changes language/direction, theme, font, scale, radius, time format and motion through the single accepted update path; tenant locks disable conflicting choices.

## Integration and failure behaviour

ApplicationProviders composes the demo-API session, API preferences/policy and runtime localization with the shell. One route per page goes through the public page-renderer registry. The unchanged demo API has no tenant directory, registration or Orvia sign-in endpoint, so these remain behind the demo's `OnboardingPort` with a fictional device-local adapter scoped by tenant and user (isolation, not authorization). Superseded lookups are aborted; a failed lookup, sign-in, reset or submission keeps everything typed and offers a retry. A workspace address taken between checking and submitting is reported on submit. Generic step state comes from `@pepbits/patterns/wizard`, the code entry from `@pepbits/ui` `OtpInput`; Orvia rules and screens stay in the demo.

## Preferences, permissions, localization and accessibility

The Orvia vocabulary maps to the effective theme tokens, radius, font family and form scale; only the mint accent on dark rails is fixed. Times and counts use the effective formatters. Reduced motion disables animation and smooth scrolling. Arabic switches the layout to right-to-left with mirrored arrow keys and icons; workspace addresses and dial codes stay left-to-right. The canonical catalogs contain only generic strings used here, so most Orvia copy stays English until backend catalog work. Every authenticated demo role can open these fictional pages; no product write actions are granted and nothing is authorized by the UI. Labelled controls, `aria-invalid` with described errors, radiogroups/tabs with arrow keys, live regions for lookup and status, and focus moves on step changes are retained. Automated axe checks are not assistive-technology or native-speaker acceptance.

## Acceptance and limitations

| ID | Contract and verification |
| --- | --- |
| ONB-01 | Shared session/preferences/localization/shell chain, Orvia navigation, preferences page, signed-out login screen |
| ONB-02 | Every route, deep link and not-found under default, Arabic RTL, reduced motion and a locked preference; jsdom axe and real Chromium axe |
| ONB-03 | Landing interactions: care pathway keys/time format, facility explorer tabs and registration deep links |
| ONB-04 | Workspace lookup by address/email, invalid/unknown/failure states, recent and sample workspaces |
| ONB-05 | Sign-in credentials validation, 6-digit code, reset, SSO and pending notices, retained values on failure |
| ONB-06 | Registration: all steps, smart defaults, validation/focus/clearing, network facilities, stepper rules, review edits, agreements, submission, failure retry, success |
| ONB-07 | Device draft autosave/restore without the password, immediate Save and exit, visible storage failures and deletion after submission |
| ONB-08 | Library additions: wizard pattern, OtpInput, Segmented presentation slots/RTL keys and icon exports, each with direct tests and README |
| ONB-09 | Real local HTTP run against the unchanged API, forced root CI, production build, documentation and protected-path checks |

Remaining outside this phase: a real tenant directory, identity provider/MFA and registration backend (with server-side validation and durable drafts), Orvia copy in the canonical localization catalogs and native-speaker review, the `/legal/*` documents the source links to, exact pixel comparison with the source and deployment.

## Operations and support

Use Node 24 for the API and the shared integration launcher; it owns temporary storage, services and browser cleanup. Device-stored demo data can be cleared with the browser's site data. Removing the app does not affect the original source demo, desktop clients or the API.
