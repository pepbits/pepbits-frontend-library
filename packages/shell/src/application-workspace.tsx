'use client';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import type {NavigationPort, NavigationTarget} from '@pepbits/platform/navigation';
import type {SessionUser} from '@pepbits/platform/auth';
import {usePreferences} from '@pepbits/preferences/react';
import type {UserPreferences} from '@pepbits/preferences';
import {AccessDenied, ErrorState} from '@pepbits/components';
import {ShellProvider, type ShellProviderProps} from './shell-context';
import {EnterpriseShell} from './enterprise-shell';
import {createWorkspace, parseDocumentKey, type WorkspacePolicyLevel, type WorkspacePolicyRule} from './workspace/index';
import {targetFromDocument} from './workspace/target-document';
import {useWorkspaceNavigation} from './workspace/use-workspace-navigation';
import {WorkspaceShell} from './workspace/workspace-shell';

export type ApplicationWorkspacePolicy = Partial<Record<WorkspacePolicyLevel, WorkspacePolicyRule>>;

/** Opt-in document workspace for ApplicationProviders: tabs, split, floating frames and detached windows. */
export interface ApplicationWorkspace {
  /** Renders one document's destination. The same callback serves tabs, split panes, frames and detached windows. */
  render(target: NavigationTarget): React.ReactNode;
  /** Workspace policy from effective preferences. Defaults to {@link defaultWorkspacePolicy}. */
  policy?(preferences: UserPreferences): ApplicationWorkspacePolicy;
  /**
   * The document key a native child window was opened for, or null/undefined for the main window.
   * The key's tenant is a claim from a URL; a key for another tenant is refused.
   */
  detachedDocumentKey?: string | null;
  /** Wraps ShellProvider, for example with an optional AI shell extension. */
  wrapShell?(shell: React.ReactNode): React.ReactNode;
  /** Floating MDI frames when the floatingWindows preference is on. Default true. */
  allowFloatingWindows?: boolean;
}

/**
 * The original desktop host's policy: every presentation and detach are permitted, three
 * off-screen documents stay mounted, and openRecordsInTabs chooses tabs or one document at a time.
 * SPLIT and WINDOW survive either choice.
 */
export function defaultWorkspacePolicy(preferences: Pick<UserPreferences, 'openRecordsInTabs'>): ApplicationWorkspacePolicy {
  return {
    platform: {modes: ['SINGLE', 'TAB', 'SPLIT', 'WINDOW'], allowDetach: true, limits: {maxWarmDocuments: 3}},
    user: {modes: preferences.openRecordsInTabs ? ['TAB', 'SPLIT', 'WINDOW'] : ['SINGLE', 'SPLIT', 'WINDOW']},
  };
}

type ShellInputs = Omit<ShellProviderProps, 'navigation' | 'workspace' | 'children'>;
const targetIdentity = (target: NavigationTarget) => JSON.stringify([target.pageId, target.mode ?? '', target.recordId ?? '']);

/** Rendered by ApplicationProviders inside the accepted preference and catalog hosts. */
export function ApplicationWorkspaceFrame({options, navigation, shell, user, banner}: {
  options: ApplicationWorkspace; navigation: NavigationPort; shell: ShellInputs; user: SessionUser; banner?: React.ReactNode;
}) {
  const wrap = options.wrapShell ?? ((value: React.ReactNode) => value);
  if (options.detachedDocumentKey) return <>{wrap(<DetachedDocument key={options.detachedDocumentKey} documentKey={options.detachedDocumentKey} tenantId={user.tenantId} options={options} shell={shell} banner={banner}/>)}</>;
  return <>{wrap(<MainWorkspace options={options} navigation={navigation} shell={shell} user={user} banner={banner}/>)}</>;
}

function MainWorkspace({options, navigation, shell, user, banner}: {options: ApplicationWorkspace; navigation: NavigationPort; shell: ShellInputs; user: SessionUser; banner?: React.ReactNode}) {
  const {preferences} = usePreferences();
  const policy = useMemo(() => (options.policy ?? defaultWorkspacePolicy)(preferences), [options.policy, preferences]);
  // The host keys this frame by account, so a different sign-in builds a new store.
  const [workspace] = useState(() => createWorkspace({session: {tenantId: user.tenantId, userId: user.id, roleId: user.role, branchId: user.branch}, policy}));
  useEffect(() => {workspace.setPolicy(policy);}, [workspace, policy]);
  const workspaceNavigation = useWorkspaceNavigation(workspace, {product: shell.product});
  const active = workspaceNavigation.port.current;
  const urlKey = targetIdentity(navigation.current), activeKey = targetIdentity(active);
  // Two-way address sync: a changed address opens or focuses its document; a changed active
  // document updates the address. Each side only reacts to its own change, so neither loops.
  const previous = useRef<{url: string | null; active: string | null; pending: boolean}>({url: null, active: null, pending: false});
  useEffect(() => {
    const urlChanged = urlKey !== previous.current.url, activeChanged = activeKey !== previous.current.active;
    const resolvedPending = previous.current.pending && !workspaceNavigation.pending;
    previous.current = {url: urlKey, active: activeKey, pending: !!workspaceNavigation.pending};
    if (urlKey === activeKey) return;
    if (urlChanged) workspaceNavigation.port.open(navigation.current);
    // Cancelling a guarded Back/Forward navigation leaves the active document unchanged.
    // Restore its address as well, so reloading cannot silently leave the retained work.
    else if (activeChanged || resolvedPending) navigation.open(active);
  });
  const port = useMemo<NavigationPort>(() => ({...workspaceNavigation.port, hrefFor: navigation.hrefFor}), [workspaceNavigation.port, navigation.hrefFor]);
  return <ShellProvider {...shell} navigation={port} workspace={workspace}>
    {banner}
    <WorkspaceShell navigation={{...workspaceNavigation, port}} allowFloatingWindows={options.allowFloatingWindows ?? true}
      renderDocument={document => options.render(targetFromDocument(document))}/>
  </ShellProvider>;
}

/** A window showing exactly one document. Navigation inside it replaces what it shows. */
function DetachedDocument({documentKey, tenantId, options, shell, banner}: {documentKey: string; tenantId: string; options: ApplicationWorkspace; shell: ShellInputs; banner?: React.ReactNode}) {
  const parts = parseDocumentKey(documentKey);
  const [target, setTarget] = useState<NavigationTarget | null>(() => parts ? targetFromDocument(parts) : null);
  const port = useMemo<NavigationPort>(() => ({current: target ?? {pageId: ''}, open: setTarget, openInNewContext: setTarget, hrefFor: () => '#'}), [target]);
  if (parts && parts.tenantId !== tenantId) return <main className="grid h-dvh place-items-center bg-[var(--surface-2)] p-8">
    <AccessDenied title="This window belongs to another tenant" description="It was opened for a different organisation than the one you are signed in to. Close it and open the record from your own workspace."/>
  </main>;
  if (!target) return <main className="grid h-dvh place-items-center bg-[var(--surface-2)] p-8">
    <ErrorState title="This window could not be opened" description="Close it and open the record again from the tab strip."/>
  </main>;
  return <ShellProvider {...shell} navigation={port}>{banner}<EnterpriseShell>{options.render(target)}</EnterpriseShell></ShellProvider>;
}
