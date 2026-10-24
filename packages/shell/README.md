# @pepbits/shell

Generic shell, workspace UI, help layers and optional preferences/login pages, unpublished source version `0.0.0`. **Phase 5 priorities 1–6 and phase 5b are implemented.** AI plugs in from the separate higher-layer package. See the [phase 5 record](../../docs/releases/unreleased/restructure-phase-5-2026-10-23.md) and [phase 5b record](../../docs/releases/unreleased/restructure-phase-5b-2026-10-23.md) for verification and deferred work.

## Public API by area

| Export | Included API |
| --- | --- |
| `.` | All areas below, `ShellProvider`, `useShell`, compatibility-shaped `useERP`, host/brand/choice/service types, `ShellAppearance`, `ShellScreenHost`, `ShellDocumentProvider`, `SessionLock`, `SentinelBridge`, `SentinelBoundary`, `ErrorMonitor`, `EnterpriseShell`, `Header`, `HeaderClock`, `useClock`, `Sidebar`, `Footer`, `WorkspacePage`, `chromePalette` |
| `./workspace` | `createWorkspace`, `Workspace`, document/session/request/result/event/restore types, `documentKey`, `parseDocumentKey`, `keyBelongsToTenant`, `windowTitleFor`, `resolveWorkspacePolicy`, policy types/levels/default limits; `WorkspaceProvider`, `DocumentProvider`, `useWorkspace`, `useOptionalWorkspace`, document/active/split/detached/state/focus/draft/dirty hooks; `WorkspaceShell`, `WorkspaceTabs`, `WorkspaceCanvas`, `MdiTaskbar`, `useWorkspaceNavigation`, `useDetachedWindows`, `useMdiWorkspace`, `documentFromTarget`, `targetFromDocument`, MDI geometry/storage helpers and types |
| `./navigation` | `ShellNavigation`, `ModuleKey`, `PageKind`, `PageDefinition`, `MenuItem`, `MenuSection`, `ModuleDefinition`; page types reuse page-engines |
| `./products` | `ProductDefinition`, `ProductAccess`, `ProductAction`, `defineProduct`, `productForRole`, `canProductAction`, `moduleContainsPage`, `productModuleForPage`, `productNavigationTarget`, `moduleLandingPage` |
| `./shortcuts` | `SHORTCUTS`, `SHORTCUT_GROUPS`, `ShortcutDefinition`, `ShortcutModifier`, `matchesShortcut`, `shortcutAvailable`, `displayFor`, `SIDEBAR_SEARCH_EVENT` |
| `./documentation` | `GuideSection`, `DocumentationGuide`, `DocumentationRelease`, `DocumentationChange`, `DocumentationIndex`; `DocumentationArticle`, `DocumentationCenter`, `DocumentationLauncher`, `PageDocumentationNotice`, `useDocumentationRequest` |
| `./tours` | `TourStep`, `ShellTours`; types only |
| `./layers` | `ShellLayers`, `ToastViewport`, `CommandPalette`, `DocumentationDrawer`, `HelpAssistant`, `TOUR_REVEAL_EVENT` |

The workspace has pure state implementations but its public barrel includes React bindings. This source package requires React/React DOM 19, a TypeScript-aware bundler, and the public lower-layer packages. There is no prebuilt application, registry publication, default product or default API URL.

Workspace tabs and the MDI taskbar own named navigation landmarks, including their commands. The profile trigger’s accessible name includes the localized action, user name and visible initials; consumers should match the action prefix when the identity can change. These corrections were found by the full-shell showcase Chromium axe sweep.

## Host contract and full wiring

`ShellProvider` receives a platform navigation port and one host-created product (which contains its module/page catalog), branches, roles and brand. Optional inputs are a controlled branch/change callback, quick pages, preferences destination, time-zone resolver, documentation/monitoring services, tours and an existing workspace. The catalog, branch choices, role labels, brand and service release IDs are always host-owned. Header/sidebar/footer and the help panel consume these inputs. Quick-page `id` is a catalog page ID. Missing `onBranchChange` makes the branch display read-only. `Header.inbox` accepts host inbox UI; footer status/tenant/region/version labels are optional props, with no invented operational status.

Session comes only from platform. Effective preferences come only from `PreferenceHost`; all edits call its guarded `update(patch)`. Localization comes only from `LocalizationProvider`. `product.translations` is compatibility metadata: the host merges it into its catalogs rather than expecting another provider inside shell. Mount one shell per HTML document. The host gates rendering until its initial preference/catalog loading is complete, supplies load/save errors and retries, and acknowledges updates with a new preference snapshot.

This composition uses fictional navigation and a host-owned preference snapshot. `renderDocument` supplies the actual screen and its data adapter; use `targetFromDocument(document)` to resolve its navigation target. The workspace navigation hook runs above `ShellProvider`, so it receives an explicit, role-filtered product. The same workspace and port go into the provider and frame.

```tsx
import React, {useEffect, useMemo, useState, type ReactNode} from 'react';
import {FileQuestion} from '@pepbits/icons';
import {createTranslator, directionOf, type TranslationCatalog} from '@pepbits/i18n';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {PreferenceHost, usePreferences, type PreferenceHostProps} from '@pepbits/preferences/react';
import {SessionProvider, useSession, type SessionOptions, type SessionUser} from '@pepbits/platform';
import {WindowPortProvider, NULL_WINDOW_PORT, type WindowPort} from '@pepbits/platform/windows';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {ShellProvider, WorkspaceShell, createWorkspace, defineProduct, productForRole,
  useWorkspaceNavigation, type ShellNavigation, type WorkspaceDocument,
  type WorkspacePolicyLevel, type WorkspacePolicyRule} from '@pepbits/shell';
import '@pepbits/tokens/tokens.css';

const catalog: ShellNavigation = {
  defaultModule: 'operations',
  modules: {operations: {id:'operations',label:'Operations',shortLabel:'OPS',
    description:'Work area',accent:'var(--primary)',icon:FileQuestion,
    navigation:[{id:'main',label:'Main',items:[{id:'items',label:'Items',pageId:'items'}]}]}},
  pages: {items:{id:'items',title:'Items',subtitle:'Records',kind:'form',module:'operations'}},
};
const product = defineProduct({navigation:catalog,id:'example',name:'Example',tagline:'Work together',
  defaultModule:'operations',enabledModules:['operations'],access:{actions:{edit:['editor'],create:['editor']}}});

type HostProps = SessionOptions & {
  settings: PreferenceHostProps; catalogs: TranslationCatalog;
  renderDocument(document:WorkspaceDocument):ReactNode;
  signedOut: ReactNode; windows?: WindowPort;
};
export function Host({settings,catalogs,renderDocument,signedOut,windows=NULL_WINDOW_PORT,...sessionOptions}:HostProps) {
  return <SessionProvider {...sessionOptions}><PreferenceHost {...settings}>
    <Localized catalogs={catalogs}><WindowPortProvider value={windows}>
      <Authenticated windows={windows} renderDocument={renderDocument} signedOut={signedOut}/>
    </WindowPortProvider></Localized>
  </PreferenceHost></SessionProvider>;
}
function Localized({catalogs,children}:{catalogs:TranslationCatalog;children:ReactNode}) {
  const {preferences}=usePreferences(),format=useFormatters();
  return <LocalizationProvider value={{language:preferences.language,direction:directionOf(preferences.language),
    t:createTranslator({language:preferences.language,catalogs}),dateTime:format.dateTime}}>{children}</LocalizationProvider>;
}
function Authenticated({windows,renderDocument,signedOut}:Pick<HostProps,'renderDocument'|'signedOut'> & {windows:WindowPort}) {
  const {user,status}=useSession();
  if(status!=='authenticated'||!user)return <>{signedOut}</>;
  const identity=JSON.stringify([user.tenantId,user.id,user.role,user.branch]);
  return <WorkspaceOwner key={identity} user={user} windows={windows} renderDocument={renderDocument}/>;
}
function WorkspaceOwner({user,windows,renderDocument}:{user:SessionUser;windows:WindowPort;renderDocument:HostProps['renderDocument']}) {
  const {preferences}=usePreferences();
  const rules=useMemo<Partial<Record<WorkspacePolicyLevel,WorkspacePolicyRule>>>(()=>({
    platform:{modes:['SINGLE','TAB','SPLIT','WINDOW'],allowDetach:windows.available,
      limits:{maxOpenDocuments:12,maxWarmDocuments:3}},
    user:{modes:preferences.openRecordsInTabs?['TAB','SPLIT','WINDOW']:['SINGLE']},
  }),[windows.available,preferences.openRecordsInTabs]);
  const [workspace]=useState(()=>createWorkspace({session:{tenantId:user.tenantId,userId:user.id,
    roleId:user.role,branchId:user.branch},policy:rules}));
  useEffect(()=>workspace.setPolicy(rules),[workspace,rules]);
  const visibleProduct=useMemo(()=>productForRole(product,user.role),[user.role]);
  const navigation=useWorkspaceNavigation(workspace,{product:visibleProduct});
  return <ShellProvider navigation={navigation.port} product={visibleProduct}
    branches={[{value:user.branch,label:'Current branch'}]} roles={[{value:'editor',label:'Editor'}]}
    brand={{name:'Example',tagline:'Work together'}} workspace={workspace}
    timezoneForBranch={()=>'UTC'}>
    <WorkspaceShell navigation={navigation} renderDocument={renderDocument}/>
  </ShellProvider>;
}
```

`apiBaseUrl` and optional `fetch` are host inputs; `signedOut` is its sign-in flow. No URL is discovered by shell. For a cookie/BFF session use platform's controlled `HostSessionProvider`. Recreate the workspace on verified tenant/user/role/branch changes; shell clears the old workspace but does not retarget its identity. Hosts authorize routing and resume, and supply the complete workspace policy when calling `setPolicy`; each policy level can narrow allowed modes. Policy updates affect subsequent operations, not the shape of already open documents. Do not reconstruct trusted identity from window URLs.

`WorkspaceShell` composes the frame, tabs or effective floating arrangement, canvas, taskbar, dirty-close confirmation and window synchronization. `allowFloatingWindows={false}` disables that geometry on hosts without support. Detach controls require an available platform `WindowPort`; the workspace still enforces its detach policy. Failures are reported or reattached by the adapter. The native host owns child-window bootstrapping, authenticated record reloading and shared state synchronization; no native runtime, child application, or record payload transfer is implemented here.

For a routed web page, use `EnterpriseShell` with your screen as children and optional `tabs`, `header`, `footer` or `navigationExpanded` props. Mount `ShellDocumentProvider` around any independently owned screen outside `WorkspaceCanvas`. The canvas already wraps each screen, retains warm screens in one keyed tree through tab/split/MDI changes, makes hidden screens inert and unmounts suspended screens. Both full frames mount `ShellLayers`, Sentinel and footer/header; do not mount a second layer/monitor composition beside them.

Optional `monitoring={{request,releaseId,platform}}` supplies an authenticated request callback; no monitoring is collected or sent without it. The existing sanitizer requires `YYYY-MM-DD-<lowercase-slug>` release IDs. Native adapters report through platform monitoring and can provide `acknowledgeNativeFailure`; no native runtime is imported. `ErrorMonitor` uses the same transport for `/monitoring/incidents`, preserves permission/retry/revision-conflict states and formats timestamps/counts with effective preferences. The service independently authorizes all diagnostic reads and writes.

## ScreenHost and document lifecycle

`ShellProvider` mounts `ScreenHostProvider` through `ShellScreenHost`. `notify(message,{tone})` adds a toast; the frame mounts one `ToastViewport`. Messages supplied by screens are already localized. `can(action)` calls `canProductAction` with the session role and host access. Missing access, missing action, missing role, unknown/inherited actions, an anonymous session or an expired session deny. This is action-level UI gating; the optional subject is not an entity-authorization mechanism. Servers must authorize every operation.

The root bridge follows the active document. Each independently mounted screen uses `ShellDocumentProvider`, including background/warm documents and both split panes. Its callbacks bind to that document rather than whichever pane happens to be focused when an asynchronous save finishes. Scope comes from document module/branch when owned, otherwise current shell module/branch. Scope is routing metadata, not authority.

`draftState`/`setDraftState` store a session-only object in the workspace under `shell:screen-state`. They survive suspension, do not enter restore metadata, and are deleted on explicit close/logout. `reportDirty` updates the workspace dirty guard. `subscribeClose` observes explicit closure separately from unmount; consumers unsubscribe normally. This is not durable draft storage: page engines/patterns retain their existing data adapters and draft contracts. Optional opaque ScreenHost extension slots can be passed to a nested `ShellScreenHost`; no AI implementation is included.

## User and administrator flows

1. The host resolves authentication, preferences, catalogs and page visibility, then mounts the providers. Missing product/navigation configuration has no invented fallback. `useShell()` outside its provider throws.
2. Open a workspace document, render a page under its document provider, edit and save through the page adapter. A successful save updates dirty state and emits a toast. A recoverable page failure retains the editor's values under its existing adapter contract.
3. Suspension releases the screen while retaining transient values. Closing a dirty document returns `ok:false` and document IDs; `WorkspaceShell` presents the discard decision before calling close with `discardChanges:true`. Hosts composing the lower-level pieces consume `useWorkspaceNavigation().pending` and confirm/cancel callbacks.
4. Administrators supply policy locks/allowed values to `PreferenceHost`. Host controls use `isLocked`, disable managed choices and route every handler through `update`. The provider rechecks current locks even for stale callbacks. The actual sidebar pin/toggle controls disable locked and excluded changes. Shell supplies no preference persistence, policy poller or second locale loader.
5. Expiration opens the existing modal session lock over the still-mounted workspace. It suppresses cancellation, stops key propagation, clears entered passwords after submission, and calls platform `login`/`logout`. Same-account renewal rules remain platform's responsibility. An identity change clears documents, toasts and open layer state.

Shortcuts use physical codes and the original registry, typing rules and repeat guard. Disabling shortcuts removes the listener. Workspace-only actions are unavailable without a workspace; preferences navigation is unavailable without a host destination. Command/help/search shortcuts open the included layers and menu search. The unmodified source's Alt+S pin shortcut overlaps form-save shortcuts: prevented events are respected, and hosts must validate their composed keyboard flow before shipping chrome.

## Styling, localization and accessibility

Import tokens once and scan source for all used layers. For Tailwind v4, paths relative to the application's stylesheet might be:

```css
@import "@pepbits/tokens/tokens.css";
@source "../node_modules/@pepbits/ui/src";
@source "../node_modules/@pepbits/components/src";
@source "../node_modules/@pepbits/patterns/src";
@source "../node_modules/@pepbits/page-engines/src";
@source "../node_modules/@pepbits/shell/src";
```

Use equivalent `content` paths with Tailwind v3. Hosts load their selected font assets. `ShellAppearance` applies effective theme, radius, row padding, independent shell/form/result scales, reduced motion, language and direction to `<html>`; the original token CSS suppresses animation. Toast/session-lock/error-monitor markup and utility classes are copied; toasts additionally have a polite live region. The host bundler must support CSS modules used by patterns/page-engines and the two byte-identical shell frame/workspace-page CSS modules. There is no compiled CSS artifact.

Host catalogs supply unchanged literal/`ui.*`/`recovery.*`/`sentinel.*` messages. No canonical catalog or generated fallback was changed; private English test messages are not shipped fallback content. RTL document direction and reduced-motion attributes are tested. Unit tests cover both physical sidebar placements with English/Arabic direction, hover/click/pin/focus behavior and reduced-motion tour scrolling. Browser layout/hit testing, long Hindi/Malayalam rendering, actual top-layer/focus behavior, screen-reader and native-speaker acceptance remain host/demo work.

## Tests

- `npm test -w @pepbits/shell` runs the jsdom suites. It needs no browser.
- `npm run test:browser -w @pepbits/shell` runs the real-Chromium suites (`src/**/*.browser.test.ts`, currently the Arabic RTL sidebar placement checks). It needs Playwright's Chromium and its OS libraries: `npx playwright install --with-deps chromium`, or set `LD_LIBRARY_PATH` to an unpacked copy of those libraries. The root `npm run ci` does not run it.

## Differences from erp-shell / workspace-core

- All sources are copied; existing consumers are untouched. Imports use public packages. Root and area exports replace original package/deep imports. Optional workspace security/request fields are renamed `patientId` → `subjectId`, `encounterId` → `interactionId`, `episodeId` → `contextId`; tests and explanatory examples use fictional generic records. Key normalization, state/policy/restore/detach algorithms and all core assertions remain.
- `ShellProvider` replaces `ERPProvider` and the separate product/shell-host contexts. It takes explicit host inputs; `useShell().product` replaces `useProduct`. There is no default product or role/branch fallback. Branch changes are controlled and validate the latest supplied choices; current role follows the session. Shared pages without an explicit module retain the last current module.
- `useERP` is only a convenience adapter over shell/preferences/localization/formatters. The old preference loader, optimistic state, persistence queue, policy refresher, save-error state and language loader remain host responsibilities above the controlled providers. Phase 5b exposes availability/policy from PreferenceHost and adds scoped preference-page services and guarded reset; it adds no persistence store. No module cache or skeleton preference local-storage hint is written; these boot/routing hints belong to hosts.
- `defineProduct` takes an explicit `navigation` catalog. No utility page, dashboard, module ID, role view, alias or product data is injected. `enabledPages` is an exact allowlist; it no longer silently preserves dashboards/utilities. Landing resolves a registered `<module>-dashboard`, then the first registered leaf. Detail-page membership uses host `page.module`; nested/shared membership uses the supplied tree. Product action names are extensible strings, and absent grants now deny rather than allow. `productForRole` always records the requested role; page entries without a page rule retain the original visible-catalog behavior.
- Page/module types are strings/public page-engine types; icons come from icons. Product translations remain metadata, not an independent localization provider. Documentation's compiled release constant and guides, branch time zones, tours and product registries are absent. The tours subpath exports types; documentation exports its types and UI. `ShellDocumentation`/`ShellMonitoring` require host service/release configuration.
- ScreenHost integration and `ShellDocumentProvider` are additive. The workspace's existing `DocumentProvider` still supplies only core context; use the shell wrapper for engines. Appearance consumes effective preferences and the host localization direction. Toast timers are disposed on unmount and lower toast limits trim existing state; the viewport adds live announcements.
- Session lock uses platform session. Sentinel delivery uses platform monitoring plus a host request, release ID, platform label and optional native acknowledgement. Browser events use `pepbits-sentinel`. There are no token-store assumptions, hardcoded endpoints/base URLs, native imports, native probes or native event listeners. ErrorMonitor uses effective density/number/date-time formatting and ignores late list responses after session changes.
- Chrome uses explicit host brand, branches, role labels, quick-page IDs and branch-zone resolver. Product fixture inboxes are replaced by `Header.inbox`; hardcoded profile/settings/support destinations are omitted. `Footer` accepts status/tenant/region/version labels and preserves the full branch label. HeaderClock is mounted in the header. Product-specific default-open sidebar groups and command filters are removed; the visible catalog defines navigation. Click-mode menu search also expands when focus expansion is off.
- `documentFromTarget(target, pages, options?)` requires host page metadata. `useWorkspaceNavigation(workspace, {product, initialModule?})` takes a product explicitly so it can run before the provider. Generic view/module identity encoding and all dirty/split/close rules remain. `WorkspaceCanvas` uses `ShellDocumentProvider`, not the core-only wrapper. `WorkspaceShell` is an additive composition; hosts may continue composing individual pieces.
- MDI geometry is stored by document type under `pepbits-mdi-frames`, never by record ID; the old storage key is not migrated. Detached windows use `@pepbits/platform/windows` only, including serialized Strict Mode cleanup, failure reattachment and OS-close reconciliation. Native window contents and synchronization remain host-owned.
- Documentation uses the existing `ShellDocumentation.request/releaseId` contract, `centerPageId` and `noticePageIds`. There is no default release, guide, index, product token reader or catalog route. A bounded, per-hook session-memory cache replaces sessionStorage; offline GET fallback is permitted only for transport failure in the same active identity, never for HTTP denial, aborted requests or writes. Reading updates use the change's own release/revision. Host transport owns authorization and response validation.
- Documentation events are `pepbits-documentation-changed` and `pepbits-documentation-section`; tour reveal is `pepbits:tour-reveal`. Explicit host page/kind tours take precedence over service guide tours. Missing anchors are skipped, help opening does not start a tour, and scrolling honors reduced motion. The nonmodal helper restores trigger focus when closed. AI is an optional higher-layer extension.
- `EnterpriseShell` now mounts `ShellLayers`; its former preference-load notice remains host-owned. The `./documentation` export now includes UI and the existing types. All original CSS class names remain, including `nex-scrollbar`; semantic tokens retain their compatibility IDs.

## Documentation and help flow

Pass `documentation={{request,releaseId,centerPageId,noticePageIds}}` to enable host-authored guides. `request(path, init)` receives relative `/documentation` queries or `/documentation/state` writes and an `X-Product-Id` header; the host chooses the origin and authenticated transport. Index responses extend `DocumentationIndex` with `nextOffset` and `total`; article responses contain `{guide}`. The center supports guide search/paging, releases, patches, reading/dismissal/acknowledgment and retry. The launcher opens the configured center or the drawer. Notices appear only on configured page IDs. Disabling documentation stops requests and hides its content; retry does not discard an open workspace editor.

`HelpAssistant` offers Docs, Tour and Shortcuts tabs. Supply `tours={{pageId:[...]}}` (or a page-kind key) for local steps. Play/next/previous explicitly starts spotlighting, Pause stops automatic stepping and Stop clears the spotlight. No AI client or network assistant is included. Host catalogs supply the unchanged literal and `ui.*` messages; guide prose and record titles are host content; no canonical catalog or generated fallback was changed.

## Completion boundary and follow-up

Priorities 1–6 and the optional phase 5b pages are complete in the source package. **405 shell cases in 38 files** pass. The phase 5 baseline retains all 141 original core cases, all 119 workspace UI cases, 14 clock/palette cases, all 25 generic sidebar expansions and adapted product composition. Full-frame tests render actual page-engine and patterns screens and exercise dirty/save/toast wiring. [Part 2 evidence](../../docs/releases/unreleased/restructure-phase-5-2026-10-23.md#part-2) preserves its historical 384-case scope; the phase 5b record adds 21 cases.

Preferences/login are included below; AI remains a separate layer above shell. Product catalogs, inbox data, guide/tour content and product role-header tests belong to **phase 6 demos or product repositories**. Native wiring/window bootstrapping, host preference HTTP/race/cache tests and pre-provider boot hints belong to **phase 6 hosts**. Phase 4a priority 3 patterns remain independent work. No consumer migration, publication, commit, push, deployment, full application journey, native executable or live-service acceptance is included.

## Phase 5b preferences and login

`@pepbits/shell/preferences-page` exports `PreferencesPage` and `PreferencePageServices`. It consumes the existing `PreferenceHost` snapshot/policy and its one guarded `update` path. Layout, display, sidebar, notification, language/help, formatting and own-settings tabs retain their controls, search, tour anchors, import/export and section/all reset behavior. Managed/unavailable controls are disabled and handlers remain guarded. Live policy replaces conflicting values. Module and branch labels come only from the shell host.

```tsx
import {PreferencesPage} from '@pepbits/shell/preferences-page';
// Render inside ShellProvider and its existing preference/localization/session providers.
const page = <PreferencesPage showTabPreferences showCurrencyPicker={false}
  services={{request: authenticatedRequest, canManagePreferencePolicy: grants.managePreferences,
    saveError: preferenceSaveError, reload: reloadPreferences}}/>;
```

The host owns `authenticatedRequest`, accepted snapshots, persistence/error state and `reloadPreferences`. Policy administration appears only with an explicit capability, request transport and active session. It uses `/preference-policy` and `/draft-policy`, retaining product scope headers, revision conflict handling and server-provided draft-management grants. Requests retain session fencing, structured recovery and localized server diagnostics. Policy edits preserve existing allowed-value constraints. The server must authorize all reads/writes independently (PREF-08). A 409 disables saving until reload; failures retain editable values. Defaults/imports use the same central update path; they do not bypass locks. Export downloads only editable overrides as `pepbits-preferences-<date>.json`.

`@pepbits/shell/login` exports `LoginScreen`, `SessionSplash`, `ShellSkeleton`. `LoginScreen` requires a host `brand` and uses platform `useSession().login`; `onSubmit` remains an optional host override. Optional `description`/`notice` replace product/demo copy. Mount it inside platform SessionProvider and host preference/localization styling, before ShellProvider if appropriate. Credentials stay in form state; the host's platform session supplies the base URL. Failure shows the localized message, preserves input and releases busy state; duplicate submits while busy are ignored. Successful login remains busy while the host changes route/unmounts it. Splash/skeleton exports do not implement preference boot caches or authenticated routing.

The root barrel additionally exports both pages and `ShellExtensionsProvider`/`useShellExtensions`/`ShellExtensions`. A higher layer supplies an optional component around each ScreenHost and a `helpAssistant` node rendered once by ShellLayers. AI fills these from above; shell has no AI dependency.

## Differences from the original

This section adds phase 5b differences to the earlier shell differences above.

- Preferences uses `usePreferences` policy/availability plus guarded updates, not the original shell's preference persistence state. The preference hook exposes its existing policy/availability as additive read-only context metadata; no second store is introduced. Host services supply reload/save errors/management capability and request transport. Currency stays hidden by default; `showCurrencyPicker` allows an explicit host opt-in without a fixed tenant currency.
- Policy requests have no implicit transport. Administrator UI and handlers fail closed when the host grant is missing/revoked, the transport is absent, or the session expires. Boolean segmented allowed values are projected correctly, including inverse animation/reduced-motion values; editing a policy value preserves its existing allowed-value list. Export filenames and policy-change events use the `pepbits` namespace; no legacy migration is performed.
- Product module/branch fallbacks, demo login accounts/password autofill, product marketing and environment claims are omitted. Login accepts explicit brand/copy, defaults submission to the existing platform session, and retains optional `onSubmit`.
- The generic preview component already lives in `@pepbits/page-engines/worklist`; phase 5b ports its missing test without copying the implementation. Product-service tests target the scoped preferences transport. Direct action/page tests use the actual form's disabled save and the role-filtered shell catalogue; host route-denial rendering remains a phase 6 responsibility.
- Optional shell extension slots are generic. Every document receives the same extension component under its own ScreenHost scope. Existing shells need no new props/providers.

The Arabic regression now includes jsdom direction/classes/focus cases and **real Chromium** physical bounding-box, main-content reservation, focus/Escape/Enter checks for both sidebar sides. The browser test serves a fictional local Vite host using actual shell/token CSS and compiled Tailwind. It is a browser-rendered web shell, not a native executable or deployed application. Root CI runs it. Install the Playwright Chromium browser and its OS dependencies before running CI on a fresh machine (`npx playwright install --with-deps chromium`); the retained sandbox run uses existing Chromium and temporary loader paths for four missing system libraries. No browser credential or live service is involved. See [phase 5b evidence](../../docs/releases/unreleased/restructure-phase-5b-2026-10-23.md).

Phase 6 still owns demonstration applications, routing/bootstrap/native integration, product content, live server authorization and browser journeys beyond the isolated sidebar regression.

Solid notification surfaces use a dark tint of their semantic tone so white title/detail text remains readable, including bright status palettes in dark themes. Chromium checks all four tones in Nexora and Midnight; placement, duration, limits, dismissal and light-style behavior remain preference-controlled.

## Shared application provider chain

`@pepbits/shell/application-providers` supplies `ApplicationProviders` and `useSettingsServices`. The host supplies API base URL, product ID, brand, role-to-product mapping, navigation and optional request/session overrides. It composes SessionProvider, PreferenceHost, runtime LocalizationProvider and ShellProvider/EnterpriseShell. Preference writes serialize accepted revisions; failed writes retain accepted values and disable edits until reload. Focus/policy events refresh tenant rules. Language catalog loading preserves mounted editors. Healthcare and ERP both consume this extraction and run the original host regression cases. No app navigation, fixture identity, AI service or origin is owned by the library.

EnterpriseShell keeps its scrollable main region keyboard focusable even when a dashboard has no interactive children; the shell regression and real-browser axe sweep cover this case.

Direct `application-providers.test.tsx` cases now verify session → preference → catalog → shell ordering, shared request/session wiring, anonymous and failed-load paths, serialized writes, rejected-save recovery, policy refresh, language changes preserving editor input and late-response fencing on identity changes. These tests inject fictional HTTP responses; they do not establish live identity or service acceptance.

## Application workspace (phase 6e-7)

`ApplicationProviders` accepts an optional `workspace: ApplicationWorkspace`; omitting it keeps the routed single-page shell exactly as before, and `children` is now optional. With it, the authenticated frame becomes a document workspace inside the same session, preference and catalog hosts:

| Option | Meaning |
| --- | --- |
| `render(target)` | Renders one document's `NavigationTarget`; serves tabs, split panes, MDI frames and detached windows |
| `policy?(preferences)` | Workspace policy from effective preferences. Default `defaultWorkspacePolicy`: every mode, detach allowed, three warm documents; `openRecordsInTabs` chooses tabs or one document at a time, while split and windows remain |
| `detachedDocumentKey?` | In a native child window, the one document to show. No tab strip; navigation replaces the document; a key for another tenant shows AccessDenied and an unparsable key ErrorState |
| `wrapShell?(shell)` | Wraps ShellProvider, for example with `AiShellExtension` |
| `allowFloatingWindows?` | Floating MDI frames when the `floatingWindows` preference is on (default true) |

The frame creates one store per account, opens the host navigation's current target beside the module home and keeps both directions in sync: a changed address opens or focuses its document; a changed active document calls the host `navigation.open`. Cancelling a guarded address change restores the active document's address. Each side reacts only to its own change, so there is no loop. `hrefFor` stays the host's, so sidebar links remain real addresses. The host supplies the `WindowPort` through `WindowPortProvider`; detach is offered only when it is available. Dirty-close/module confirmations, split and MDI behaviour are the existing `WorkspaceShell` contracts. `application-workspace.test.tsx` (eight cases) covers address → document, document → address, cancelled address changes retaining edits, the one-document policy, dirty-close confirmation and policy input, detach through an available port with a sanitized title, detached single-document/foreign-tenant/malformed keys and `wrapShell` with the unchanged routed mode.

Fix: `useWorkspaceNavigation` crossing into another module with a record whose page is that module's landing page (for example a deep link to a worklist record) now opens the record beside the home tab instead of dropping it. A regression case is added to `use-workspace-navigation.test.tsx`. The desktop demo is the first consumer.
