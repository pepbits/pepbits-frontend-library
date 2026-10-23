# Independent library AI, preferences and login

Feature ID: LIB-5B. State: implemented and locally tested, unpublished. Scope: opt-in `@pepbits/ai` and `@pepbits/shell` consumers; original applications are unchanged. [Phase 5b record](../releases/unreleased/restructure-phase-5b-2026-10-23.md); [testing guide 1.0.0](../testing/v1.0.0/PRE-COMMIT.md).

## User problem and outcome

Independent library hosts can now enable the existing contextual assistant and optional account screens without importing the original product workspace. A host supplies its catalogue, allowed pages, classification, brand, identity, preferences and authenticated service. A shell with no AI extension behaves as before.

## User and administrator flows

1. Sign in through the host-branded login. The platform session owns the configured API base URL. An unsuccessful sign-in preserves inputs, displays the localized failure and permits retry; pending submission cannot be duplicated. No demo identities or password autofill are bundled.
2. Open Preferences. Search across sections or select a tab, change an available control, and let the host accept/persist the guarded update. Managed controls are disabled; live policy replaces conflicting values. Import, section reset and full reset use the same path. Export contains editable overrides only.
3. With an explicit host management grant, open Preference policies. Reload/save uses the host's authenticated service; conflicts require reload, and errors preserve editable values. Removing the capability hides administration immediately. Server authorization is required independently of the UI.
4. On an AI-enabled page, open the assistant, choose an allowed use case and review the redacted fields and flow/policy tabs. Confirm before panel dispatch; the retained restricted category requires its acknowledgment. Inline actions are absent for that category. Terminal commands and inline actions use the same resolved engine list.
5. Authorized AI administrators view provider/model/limit/usage metadata and enter a replacement credential through the dedicated write-only route. Inputs clear after submission, including refusals. A server refusal stays visible; disabled controls do not establish authorization.

## Technical contract and integration

See [AI public APIs and complete host example](../../packages/ai/README.md#host-wiring-and-user-flow) and [shell page setup](../../packages/shell/README.md#phase-5b-preferences-and-login). SessionProvider, PreferenceHost and LocalizationProvider remain authoritative. AiShellExtension wraps ShellProvider, fills every document's ScreenHost action/publication slots and the help-layer slot, and preserves document ownership while focus changes. Actual record forms publish only their displayed state; assembly then reads only named fields.

AI config resolves ordered deny-wins gates and validates host retrieval declarations. The client binds transport and classification per instance, masks before transparency, refuses unmasked classified fields before dispatch, and invalidates stale policy responses. No prompt text, provider destination, credential, product/page/branch data or server implementation is shipped. The host server derives tenant/user authority and enforces egress, limits, provider allowlists, credential custody, retention and audit. UI grants and preference locks are not authorization (PREF-08).

## Compatibility, localization and accessibility

The packages are copied; there is no consumer migration or stored-data conversion. Public API differences are enumerated in both package guides. UI markup/classes, existing ARIA/keyboard behavior and source confirmation paths are retained. Preferences use effective values/locks/allowed options and a single update callback. Administration numbers and timestamps use host formatters. Hosts supply canonical localization catalogs and styling; test-only English subsets are not a production translation bundle.

The Arabic sidebar regression measures both physical sides and main-content reservation in Chromium, with document language/direction, focus expansion, Escape and Enter. Its fixture uses the actual shell, token styles and compiled Tailwind. Other AI/preference/login acceptance is unit/jsdom with fictional fixtures and mocked services; no native-speaker or assistive-technology approval is claimed.

## Acceptance, completed and pending work

LIB-5B-GATES maps eight verification scripts to tests and explicit server-only exclusions in the release record. LIB-5B-PREF covers central updates, live locks/allowed values/import/reset, capability removal and service session fencing. LIB-5B-LOGIN covers brand/session submission, recovery and duplicate prevention. LIB-5B-RTL covers physical left/right Chromium placement plus jsdom focus regression.

All generic AI source suites are retained. Backend admission, credential-file canary and server hardening checks are not run or represented by mocked client response tests. Managed vault, approved restricted-data provider contracts and production identity/authorization remain host obligations. Phase 6 demos, product content, native bootstrap, full application journeys and live services remain pending. No publication or deployment is included.

## Operations and support

Configure and memoize the client and catalogue per host; reset policy on identity/config changes. Missing build blocks deny rendering; policy network failure retains the original build-set rendering behavior, with server enforcement still required. The labeled echo response on unconfigured/unreachable service is not proof of zero server traffic: the configured application endpoint was attempted. Refusals including 429 preserve server diagnostics. Never record credentials in logs or evidence. Rollback removes the optional extension/pages from the new host; protected applications and existing stored data are unaffected.

## Showcase echo-mode follow-up

The [showcase follow-up](../releases/unreleased/restructure-phase-6a-2026-10-23.md#follow-up--full-shell-and-ai-pages) exercises the full shell extension, controlled login/preferences, publication/redaction, policy gates, inline/panel/terminal modes, transparency and read-only fictional administration. `createAiClientWithRequest` now accepts an optional third `"echo"` transport argument; its default remains `"service"`. Echo runs the classified-field guard and local response without calling the request port. Policy/configuration/usage still use the supplied port, which the demo implements in memory. The shared assistant result exposes simulation mode so review can confirm an echo without claiming a configured credential. Disabled AI removes publication/inline slots and stops policy/config reads. No server enforcement or provider integration is implied by these local checks.
