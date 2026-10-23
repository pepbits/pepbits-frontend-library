# @pepbits/shell

Generic shell and workspace foundation, unpublished source version `0.0.0`. **Phase 5 priorities 1–3 are implemented; the complete shell UI is not delivered.** This increment supplies document ownership for patterns and page engines without importing the original workspace. See the [phase 5 record](../../docs/releases/unreleased/restructure-phase-5-2026-10-23.md) for exact verification and every deferred source suite.

## Public API by area

| Export | Included API |
| --- | --- |
| `.` | All areas below, `ShellProvider`, `useShell`, compatibility-shaped `useERP`, host/brand/choice/service types, `ShellAppearance`, `ShellScreenHost`, `ShellDocumentProvider`, `SessionLock`, `SentinelBridge`, `SentinelBoundary`, `ErrorMonitor` |
| `./workspace` | `createWorkspace`, `Workspace`, document/session/request/result/event/restore types, `documentKey`, `parseDocumentKey`, `keyBelongsToTenant`, `windowTitleFor`, `resolveWorkspacePolicy`, policy types/levels/default limits; `WorkspaceProvider`, `DocumentProvider`, `useWorkspace`, `useOptionalWorkspace`, document/active/split/detached/state/focus/draft/dirty hooks |
| `./navigation` | `ShellNavigation`, `ModuleKey`, `PageKind`, `PageDefinition`, `MenuItem`, `MenuSection`, `ModuleDefinition`; page types reuse page-engines |
| `./products` | `ProductDefinition`, `ProductAccess`, `ProductAction`, `defineProduct`, `productForRole`, `canProductAction`, `moduleContainsPage`, `productModuleForPage`, `productNavigationTarget`, `moduleLandingPage` |
| `./shortcuts` | `SHORTCUTS`, `SHORTCUT_GROUPS`, `ShortcutDefinition`, `ShortcutModifier`, `matchesShortcut`, `shortcutAvailable`, `displayFor`, `SIDEBAR_SEARCH_EVENT` |
| `./documentation` | `GuideSection`, `DocumentationGuide`, `DocumentationRelease`, `DocumentationChange`, `DocumentationIndex`; types only |
| `./tours` | `TourStep`, `ShellTours`; types only |
| `./layers` | `ToastViewport`; other layers remain deferred |

The workspace has pure state implementations but its public barrel includes React bindings. This source package requires React/React DOM 19, a TypeScript-aware bundler, and the public lower-layer packages. There is no prebuilt application, registry publication, default product or default API URL.

## Host contract and full wiring

`ShellProvider` receives a platform navigation port and one host-created product (which contains its module/page catalog), branches, roles and brand. Optional inputs are a controlled branch/change callback, quick pages, preferences destination, time-zone resolver, documentation/monitoring services, tours and an existing workspace. The catalog, branch choices, role labels, brand and service release IDs are always host-owned. Quick pages, brand, role labels, tours and the time-zone resolver are available through `useShell()` for host chrome; their original built-in chrome consumers are deferred.

Session comes only from platform. Effective preferences come only from `PreferenceHost`; all edits call its guarded `update(patch)`. Localization comes only from `LocalizationProvider`. `product.translations` is compatibility metadata: the host merges it into its catalogs rather than expecting another provider inside shell. Mount one shell per HTML document. The host gates rendering until its initial preference/catalog loading is complete, supplies load/save errors and retries, and acknowledges updates with a new preference snapshot.

This complete composition uses fictional navigation and a host-owned preferences snapshot. The navigation port routes the host's actual screen; the host creates its record adapter and renders its page inside the document provider. The example deliberately uses a single document because workspace tab/canvas UI is deferred.

```tsx
import React, {useMemo, type ReactNode} from 'react';
import {FileQuestion} from '@pepbits/icons';
import {createTranslator, directionOf, type TranslationCatalog} from '@pepbits/i18n';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {PreferenceHost, usePreferences, type PreferenceHostProps} from '@pepbits/preferences/react';
import {SessionProvider, useSession, type SessionOptions} from '@pepbits/platform';
import type {NavigationPort} from '@pepbits/platform/navigation';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {ShellProvider, ShellDocumentProvider, ToastViewport, SentinelBridge,
  SentinelBoundary, createWorkspace, defineProduct, type ShellNavigation} from '@pepbits/shell';
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
  navigation: NavigationPort; screen: ReactNode; signedOut: ReactNode;
};
export function Host({settings,catalogs,navigation,screen,signedOut,...sessionOptions}:HostProps) {
  return <SessionProvider {...sessionOptions}><PreferenceHost {...settings}>
    <Localized catalogs={catalogs}><Authenticated navigation={navigation} signedOut={signedOut}>
      {screen}
    </Authenticated></Localized>
  </PreferenceHost></SessionProvider>;
}
function Localized({catalogs,children}:{catalogs:TranslationCatalog;children:ReactNode}) {
  const {preferences}=usePreferences(),format=useFormatters();
  return <LocalizationProvider value={{language:preferences.language,direction:directionOf(preferences.language),
    t:createTranslator({language:preferences.language,catalogs}),dateTime:format.dateTime}}>{children}</LocalizationProvider>;
}
function Authenticated({navigation,children,signedOut}:{navigation:NavigationPort;children:ReactNode;signedOut:ReactNode}) {
  const {user,status}=useSession();
  const identity=JSON.stringify([user?.tenantId,user?.id,user?.role,user?.branch]);
  const owned=useMemo(()=>{
    if (!user) return null;
    const workspace=createWorkspace({session:{tenantId:user.tenantId,userId:user.id,roleId:user.role,branchId:user.branch},
      policy:{platform:{modes:['TAB','SPLIT'],limits:{maxOpenDocuments:12,maxWarmDocuments:3}}}});
    const result=workspace.openDocument({module:'operations',documentType:'items',entityId:'a',title:'Item A'});
    return result.document ? {workspace,document:result.document} : null;
  },[identity]);
  if (status!=='authenticated' || !user || !owned) return <>{signedOut}</>;
  return <ShellProvider key={identity} navigation={navigation} product={product}
    branches={[{value:user.branch,label:'Current branch'}]} roles={[{value:'editor',label:'Editor'}]}
    brand={{name:'Example',tagline:'Work together'}} workspace={owned.workspace}>
    <SentinelBridge />
    <SentinelBoundary resetKey={navigation.current.pageId}>
      <ShellDocumentProvider documentId={owned.document.documentId}>{children}</ShellDocumentProvider>
    </SentinelBoundary>
    <ToastViewport />
  </ShellProvider>;
}
```

`apiBaseUrl` and optional `fetch` must be passed to `Host` by the application; `signedOut` is its sign-in flow. No URL is discovered by shell. For a cookie/BFF session, substitute platform's controlled `HostSessionProvider`. The workspace must be created from verified session identity and recreated for a different tenant/user/role/branch; shell clears the old workspace on observed identity changes but does not retarget its session. The host owns routing authorization and resume revalidation. Do not construct trusted identity from URLs.

Optional `monitoring={{request,releaseId,platform}}` supplies an authenticated request callback; no monitoring is collected or sent without it. The existing sanitizer requires `YYYY-MM-DD-<lowercase-slug>` release IDs. Native adapters report through platform monitoring and can provide `acknowledgeNativeFailure`; no native runtime is imported. `ErrorMonitor` uses the same transport for `/monitoring/incidents`, preserves permission/retry/revision-conflict states and formats timestamps/counts with effective preferences. The service independently authorizes all diagnostic reads and writes.

## ScreenHost and document lifecycle

`ShellProvider` mounts `ScreenHostProvider` through `ShellScreenHost`. `notify(message,{tone})` adds a toast; mount one `ToastViewport`. Messages supplied by screens are already localized. `can(action)` calls `canProductAction` with the session role and host access. Missing access, missing action, missing role, unknown/inherited actions, an anonymous session or an expired session deny. This is action-level UI gating; the optional subject is not an entity-authorization mechanism. Servers must authorize every operation.

The root bridge follows the active document. Each independently mounted screen uses `ShellDocumentProvider`, including background/warm documents and both split panes. Its callbacks bind to that document rather than whichever pane happens to be focused when an asynchronous save finishes. Scope comes from document module/branch when owned, otherwise current shell module/branch. Scope is routing metadata, not authority.

`draftState`/`setDraftState` store a session-only object in the workspace under `shell:screen-state`. They survive suspension, do not enter restore metadata, and are deleted on explicit close/logout. `reportDirty` updates the workspace dirty guard. `subscribeClose` observes explicit closure separately from unmount; consumers unsubscribe normally. This is not durable draft storage: page engines/patterns retain their existing data adapters and draft contracts. Optional opaque ScreenHost extension slots can be passed to a nested `ShellScreenHost`; no AI implementation is included.

## User and administrator flows

1. The host resolves authentication, preferences, catalogs and page visibility, then mounts the providers. Missing product/navigation configuration has no invented fallback. `useShell()` outside its provider throws.
2. Open a workspace document, render a page under its document provider, edit and save through the page adapter. A successful save updates dirty state and emits a toast. A recoverable page failure retains the editor's values under its existing adapter contract.
3. Suspension releases the screen while retaining transient values. Closing a dirty document returns `ok:false` and document IDs; the host presents a discard decision before calling close with `discardChanges:true`. Workspace UI for that decision is deferred.
4. Administrators supply policy locks/allowed values to `PreferenceHost`. Host controls use `isLocked`, disable managed choices and route every handler through `update`. The provider rechecks current locks even for stale callbacks. Shell supplies no preference persistence, policy poller or second locale loader.
5. Expiration opens the existing modal session lock over the still-mounted workspace. It suppresses cancellation, stops key propagation, clears entered passwords after submission, and calls platform `login`/`logout`. Same-account renewal rules remain platform's responsibility. An identity change clears documents, toasts and open layer state.

Shortcuts use physical codes and the original registry, typing rules and repeat guard. Disabling shortcuts removes the listener. Workspace-only actions are unavailable without a workspace; preferences navigation is unavailable without a host destination. Command/help/search shortcuts expose state/events for host layers; this increment does not mount those deferred interfaces. The unmodified source's Alt+S pin shortcut overlaps form-save shortcuts: prevented events are respected, and hosts must validate their composed keyboard flow before shipping chrome.

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

Use equivalent `content` paths with Tailwind v3. Hosts load their selected font assets. `ShellAppearance` applies effective theme, radius, row padding, independent shell/form/result scales, reduced motion, language and direction to `<html>`; the original token CSS suppresses animation. Toast/session-lock/error-monitor markup and utility classes are copied; toasts additionally have a polite live region. The host bundler must support CSS modules used by patterns/page-engines. No shell CSS module is copied yet because both associated frames are deferred. There is no compiled CSS artifact.

Host catalogs supply unchanged literal/`ui.*`/`recovery.*`/`sentinel.*` messages. No canonical catalog or generated fallback was changed; private English test messages are not shipped fallback content. RTL document direction and reduced-motion attributes are tested. Physical sidebar placement, long-language chrome, browser focus/top-layer behavior, screen-reader and native-speaker acceptance remain pending with the deferred UI.

## Differences from erp-shell / workspace-core

- All sources are copied; existing consumers are untouched. Imports use public packages. Root and area exports replace original package/deep imports. Optional workspace security/request fields are renamed `patientId` → `subjectId`, `encounterId` → `interactionId`, `episodeId` → `contextId`; tests and explanatory examples use fictional generic records. Key normalization, state/policy/restore/detach algorithms and all core assertions remain.
- `ShellProvider` replaces `ERPProvider` and the separate product/shell-host contexts. It takes explicit host inputs; `useShell().product` replaces `useProduct`. There is no default product or role/branch fallback. Branch changes are controlled and validate the latest supplied choices; current role follows the session. Shared pages without an explicit module retain the last current module.
- `useERP` is only a convenience adapter over shell/preferences/localization/formatters. The old preference loader, optimistic state, persistence queue, reset API, policy refresher, save-error state, language loader, preference request context and `preferencesAvailable` field are not ported. Hosts retain these application responsibilities above the existing controlled providers. No module cache or skeleton preference local-storage hint is written; these boot/routing hints belong to hosts.
- `defineProduct` takes an explicit `navigation` catalog. No utility page, dashboard, module ID, role view, alias or product data is injected. `enabledPages` is an exact allowlist; it no longer silently preserves dashboards/utilities. Landing resolves a registered `<module>-dashboard`, then the first registered leaf. Detail-page membership uses host `page.module`; nested/shared membership uses the supplied tree. Product action names are extensible strings, and absent grants now deny rather than allow. `productForRole` always records the requested role; page entries without a page rule retain the original visible-catalog behavior.
- Page/module types are strings/public page-engine types; icons come from icons. Product translations remain metadata, not an independent localization provider. Documentation's compiled release constant and guides, branch time zones, tours and product registries are absent. Documentation/tour subpaths export types only. `ShellDocumentation`/`ShellMonitoring` require host service/release configuration.
- ScreenHost integration and `ShellDocumentProvider` are additive. The workspace's existing `DocumentProvider` still supplies only core context; use the shell wrapper for engines. Appearance consumes effective preferences and the host localization direction. Toast timers are disposed on unmount and lower toast limits trim existing state; the viewport adds live announcements.
- Session lock uses platform session. Sentinel delivery uses platform monitoring plus a host request, release ID, platform label and optional native acknowledgement. Browser events use `pepbits-sentinel`. There are no token-store assumptions, hardcoded endpoints/base URLs, native imports, native probes or native event listeners. ErrorMonitor uses effective density/number/date-time formatting and ignores late list responses after session changes.
- No `EnterpriseShell`, header/sidebar/footer, clock/palette, workspace page/canvas/tabs/MDI/window adapter, target-document/workspace-navigation helper, command palette, documentation UI or help assistant is exported in this increment. There are no empty substitute components.

## Completion boundary and follow-up

Priorities 1–3 are complete within this source-only increment. All seven core test files (141 cases) are ported, plus the Sentinel boundary case, generic context behavior and product helpers. Integration tests render actual page-engine and patterns screens using injected/volatile adapters and the shared patterns test host. The [release inventory](../../docs/releases/unreleased/evidence/restructure-phase-5-2026-10-23/test-port-inventory.json) distinguishes retained, replaced, added and unported cases/files.

Priorities 4–6 and their source tests belong to **phase 5 completion before phase 5b**. They include all chrome/sidebar/RTL behavior, CSS modules, workspace UI/native port wiring, command/documentation/help layers and rendering of the host catalog/tour/brand inputs. Preferences page and login are deferred to **phase 5b shell/platform follow-up**. AI is a separate **phase 5b** package above the completed shell. Product catalogs, documentation/tour content, role-header product tests and demo fixtures belong to **phase 6 demos or product repositories**; native runtime wiring belongs to **phase 6 desktop demo**. Original preference HTTP/load-race tests belong to a host preference integration in phase 6, not to a second shell store.

Run `npm run ci` at the repository root and the documented jiti documentation check. Unit/jsdom tests do not establish native, browser, deployed or live-provider acceptance. No consumer migration, publication, commit or push occurs. Rollback removes this independent package and its root registration; there is no stored-data or protected-application migration.
