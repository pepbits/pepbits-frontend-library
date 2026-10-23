# Feature: independent library showcase

Feature ID: SHOWCASE-01. State: implemented; local verification is recorded in the [phase 6a delivery](../releases/unreleased/restructure-phase-6a-2026-10-23.md). Affected application: `demo-apps/showcase`; [testing guide 1.0.0](../testing/v1.0.0/PRE-COMMIT.md).

## User problem and outcome

The Developer Library was tied to the original application workspace. The independent gallery demonstrates the new public packages in a full library shell within a real Next.js host with fictional data. Users browse foundations, primitives, composites, patterns and page engines, inspect the actual executable example source and experiment with effective preferences.

## User and administrator flows

1. Run `npm run dev -w @pepbits-demo/showcase` from the root, then open the local app on port 3300. The fictional editor session starts in memory; no login or backend is required.
2. Choose an area in the side navigation and search by export name. Use live controls; expand Source code to copy the exact file. Clipboard failure leaves selectable code. Reset example discards that example’s current local state.
3. Change theme, language, density, motion and shortcuts in the compact page controls. The policy page exposes font scales, radius, result/table choices and regional format settings. Arabic changes document direction while keeping mounted form values.
4. Simulate a tenant density/theme lock or an allowed page-size subset. The effective setting replaces conflicts immediately. Controls disable managed values, and the central update path ignores attempts to change them. These UI restrictions do not establish server authorization.
5. Type a draft note, wait for acknowledgement, then reopen the example. Explicitly restore or discard the retained session-memory draft. A browser reload clears it. Imports require validation and explicit confirmation; approval comments and transitions are local simulations.

## Technical contract and integration

The host composes `SessionProvider` → `PreferenceHost` → `LocalizationProvider` → `ShellProvider` → its built-in `ScreenHostProvider` bridge, plus `PresentationProvider`. There is one accepted preference snapshot and one guarded update callback. `src/app-frame.tsx` is a thin `WorkspaceShell` wrapper. Its canvas renders each gallery document under the shell document bridge, with header/sidebar/footer/tabs and a single layer composition. `AiShellExtension` supplies optional assistant and ScreenHost extension slots above shell; AI starts off.

```tsx
import {SessionProvider, type SessionValue} from '@pepbits/platform';
import {PreferenceHost, type PreferenceHostProps} from '@pepbits/preferences/react';
import type {ReactNode} from 'react';
export function Host({session, settings, children}: {
  session: SessionValue; settings: Omit<PreferenceHostProps, 'children'>; children: ReactNode;
}) {
  return <SessionProvider value={session}><PreferenceHost {...settings}>{children}</PreferenceHost></SessionProvider>;
}
```

The production application must supply verified identity, accepted persistent preferences, catalogs and authenticated adapters. The [app guide](../../demo-apps/showcase/README.md) links the full actual composition. Data ownership remains with the host; library packages contain no fictional record seeds. Shared drafts reuse library memory transport revision, replay, retention and filtering behavior. The app’s lifecycle validation is illustrative, with governance actions unavailable.

## Compatibility, localization and accessibility

This independent app does not migrate old preferences, data, routes or stored tokens. The canonical backend catalogs are read to generate a shared-message subset; they are unchanged. App navigation has English, Arabic, Hindi and Malayalam messages. Code identifiers and fictional values are literal. Native review remains pending.

Semantic tokens, fonts, independent scales, radius, table presentation, motion and language direction come from effective preferences. Navigation uses the shell sidebar, header quick pages, command palette, workspace tabs, a skip link and visible focus. Examples use labelled shared controls. Workspace tabs and MDI taskbars expose named navigation landmarks; the profile action name includes its visible initials. Axe runs on all eight pages under default, Arabic RTL, reduced-motion and locked-density conditions; browser results and jsdom limitations are reported separately in the delivery record.

## Acceptance, completed and pending work

Stable cases are `SHOWCASE-PAGE` (eight pages/four preference scenarios), `SHOWCASE-POLICY` (mounted locks/allowed values), `SHOWCASE-SOURCE` (exact source and public imports), `SHOWCASE-FORM` (memory save), `SHOWCASE-OVERLAY` (focus/dialog/Escape), and `SHOWCASE-BROWSER` (local production-server smoke). Their implementations live in the app tests and smoke script. Counts belong to the dated receipt, not this guide.

The full frame and ten Shell plus three AI examples are complete, for 61 examples across the original eight routes. `SHOWCASE-NAV` covers sidebar and command-palette navigation with shortcuts on/off; `SHOWCASE-SHELL` covers workspace and layer/account interactions; `SHOWCASE-AI` covers disabled no-call behavior, echo-only dispatch, redaction, gates/modes and enabled-surface axe. Phase 4c adds five priority 3 examples: spreadsheet editing/export audit, designer draft/preview, label artwork, identity capture/manual review and device queue/dispatch. The last two use simulated platform ports. `SHOWCASE-PATTERNS-3` covers all five live flows, and existing page axe scenarios include them. See the [phase 4c evidence](../releases/unreleased/restructure-phase-4c-2026-10-23.md). The remaining demos are built one at a time: healthcare, erp, school, reports, tenant-admin, onboarding, settle, caregrid, allyvora-patients, desktop. Deployment, production providers, native execution and human language review are not claimed.

## Operations and support

All preferences, policy simulations and adapter records are demo-only memory. Reset an example or reload to clear it. Recovery notices preserve mounted values; uncertain adapter mutations keep their operation identities, and draft restore/discard is explicit. No credentials or diagnostic network delivery are configured. A host integration must implement durable storage, failure policy and server authorization. Rollback removes the new app and the small additive library APIs; protected applications are unaffected.

## Shell and AI simulation flow

The Shell route operates the same workspace used to browse every example. Open a second tab, split, enable floating frames, or detach Foundations through the fictional window port and reattach it. Documentation and tours use host-authored fictional content; toasts use the existing ScreenHost. Preferences edits the same accepted snapshot and follows playground locks. Login and expiry renewal use the controlled demo session, ignoring all submitted fictional input and making no network request.

Enable AI in the policy playground, then open AI from the header. Sources publish only the displayed fictional item and classified owner; the declared read set and classifier mask the owner before transparency or dispatch. One action survives the simulated use-case policy and one is absent. The assistant’s panel and terminal and inline actions share the resolver. Administration is read only, with no configured endpoint or credential. Explicit echo dispatch calls no request port; configuration/policy/usage are supplied in memory. Disabling AI removes its surfaces and stops those reads. **This is a simulation; real servers enforce authorization, egress and limits (PREF-08).** No production quotas, identity or provider integration are certified.

Phase 6b-3 adds the Native controls UI example for public SourceButton/Input/Select/Textarea/DateInput and AsyncLookup. It uses temporary field state and a fictional in-memory loader, with no transport. The source-generated snippet and existing four-profile gallery checks cover this additional public export contract; source identity is in the [6b-3 record](../releases/unreleased/restructure-phase-6b-3-2026-10-23.md).
