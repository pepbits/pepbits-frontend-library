# @pepbits/shell

Generic shell, workspace UI and help layers, unpublished source version `0.0.0`. **Phase 5 priorities 1–6 are implemented.** Part 2 builds on the committed workspace and ScreenHost contracts; optional preferences/login pages and AI remain phase 5b. See the [phase 5 record](../../docs/releases/unreleased/restructure-phase-5-2026-10-23.md) for exact verification and every deferred source suite.

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

## Differences from erp-shell / workspace-core

- All sources are copied; existing consumers are untouched. Imports use public packages. Root and area exports replace original package/deep imports. Optional workspace security/request fields are renamed `patientId` → `subjectId`, `encounterId` → `interactionId`, `episodeId` → `contextId`; tests and explanatory examples use fictional generic records. Key normalization, state/policy/restore/detach algorithms and all core assertions remain.
- `ShellProvider` replaces `ERPProvider` and the separate product/shell-host contexts. It takes explicit host inputs; `useShell().product` replaces `useProduct`. There is no default product or role/branch fallback. Branch changes are controlled and validate the latest supplied choices; current role follows the session. Shared pages without an explicit module retain the last current module.
- `useERP` is only a convenience adapter over shell/preferences/localization/formatters. The old preference loader, optimistic state, persistence queue, reset API, policy refresher, save-error state, language loader, preference request context and `preferencesAvailable` field are not ported. Hosts retain these application responsibilities above the existing controlled providers. No module cache or skeleton preference local-storage hint is written; these boot/routing hints belong to hosts.
- `defineProduct` takes an explicit `navigation` catalog. No utility page, dashboard, module ID, role view, alias or product data is injected. `enabledPages` is an exact allowlist; it no longer silently preserves dashboards/utilities. Landing resolves a registered `<module>-dashboard`, then the first registered leaf. Detail-page membership uses host `page.module`; nested/shared membership uses the supplied tree. Product action names are extensible strings, and absent grants now deny rather than allow. `productForRole` always records the requested role; page entries without a page rule retain the original visible-catalog behavior.
- Page/module types are strings/public page-engine types; icons come from icons. Product translations remain metadata, not an independent localization provider. Documentation's compiled release constant and guides, branch time zones, tours and product registries are absent. The tours subpath exports types; documentation exports its types and UI. `ShellDocumentation`/`ShellMonitoring` require host service/release configuration.
- ScreenHost integration and `ShellDocumentProvider` are additive. The workspace's existing `DocumentProvider` still supplies only core context; use the shell wrapper for engines. Appearance consumes effective preferences and the host localization direction. Toast timers are disposed on unmount and lower toast limits trim existing state; the viewport adds live announcements.
- Session lock uses platform session. Sentinel delivery uses platform monitoring plus a host request, release ID, platform label and optional native acknowledgement. Browser events use `pepbits-sentinel`. There are no token-store assumptions, hardcoded endpoints/base URLs, native imports, native probes or native event listeners. ErrorMonitor uses effective density/number/date-time formatting and ignores late list responses after session changes.
- Chrome uses explicit host brand, branches, role labels, quick-page IDs and branch-zone resolver. Product fixture inboxes are replaced by `Header.inbox`; hardcoded profile/settings/support destinations are omitted. `Footer` accepts status/tenant/region/version labels and preserves the full branch label. HeaderClock is mounted in the header. Product-specific default-open sidebar groups and command filters are removed; the visible catalog defines navigation. Click-mode menu search also expands when focus expansion is off.
- `documentFromTarget(target, pages, options?)` requires host page metadata. `useWorkspaceNavigation(workspace, {product, initialModule?})` takes a product explicitly so it can run before the provider. Generic view/module identity encoding and all dirty/split/close rules remain. `WorkspaceCanvas` uses `ShellDocumentProvider`, not the core-only wrapper. `WorkspaceShell` is an additive composition; hosts may continue composing individual pieces.
- MDI geometry is stored by document type under `pepbits-mdi-frames`, never by record ID; the old storage key is not migrated. Detached windows use `@pepbits/platform/windows` only, including serialized Strict Mode cleanup, failure reattachment and OS-close reconciliation. Native window contents and synchronization remain host-owned.
- Documentation uses the existing `ShellDocumentation.request/releaseId` contract, `centerPageId` and `noticePageIds`. There is no default release, guide, index, product token reader or catalog route. A bounded, per-hook session-memory cache replaces sessionStorage; offline GET fallback is permitted only for transport failure in the same active identity, never for HTTP denial, aborted requests or writes. Reading updates use the change's own release/revision. Host transport owns authorization and response validation.
- Documentation events are `pepbits-documentation-changed` and `pepbits-documentation-section`; tour reveal is `pepbits:tour-reveal`. Explicit host page/kind tours take precedence over service guide tours. Missing anchors are skipped, help opening does not start a tour, and scrolling honors reduced motion. The nonmodal helper restores trigger focus when closed. AI is absent.
- `EnterpriseShell` now mounts `ShellLayers`; its former preference-load notice remains host-owned. The `./documentation` export now includes UI and the existing types. All original CSS class names remain, including `nex-scrollbar`; semantic tokens retain their compatibility IDs.

## Documentation and help flow

Pass `documentation={{request,releaseId,centerPageId,noticePageIds}}` to enable host-authored guides. `request(path, init)` receives relative `/documentation` queries or `/documentation/state` writes and an `X-Product-Id` header; the host chooses the origin and authenticated transport. Index responses extend `DocumentationIndex` with `nextOffset` and `total`; article responses contain `{guide}`. The center supports guide search/paging, releases, patches, reading/dismissal/acknowledgment and retry. The launcher opens the configured center or the drawer. Notices appear only on configured page IDs. Disabling documentation stops requests and hides its content; retry does not discard an open workspace editor.

`HelpAssistant` offers Docs, Tour and Shortcuts tabs. Supply `tours={{pageId:[...]}}` (or a page-kind key) for local steps. Play/next/previous explicitly starts spotlighting, Pause stops automatic stepping and Stop clears the spotlight. No AI client or network assistant is included. Host catalogs supply the unchanged literal and `ui.*` messages; guide prose and record titles are host content; no canonical catalog or generated fallback was changed.

## Completion boundary and follow-up

Priorities 1–6 are complete in the source package. **384 shell cases in 29 files** pass, including all 141 original core cases, all 119 workspace UI cases, 14 clock/palette cases, all 25 generic sidebar expansions and adapted product composition. Added full-frame tests render actual page-engine and patterns screens and exercise dirty/save/toast wiring. [Part 2 evidence](../../docs/releases/unreleased/restructure-phase-5-2026-10-23.md#part-2) distinguishes retained, replaced and deferred cases and local checks from runtime acceptance.

Preferences page and login remain **phase 5b shell/platform follow-up**; AI remains a separate **phase 5b** layer above shell. Product catalogs, inbox data, guide/tour content and product role-header tests belong to **phase 6 demos or product repositories**. Native wiring/window bootstrapping, host preference HTTP/race/cache tests and pre-provider boot hints belong to **phase 6 hosts**. Phase 4a priority 3 patterns remain independent work. No consumer migration, publication, commit, push, deployment, browser journey, native executable or live-service acceptance is included.
