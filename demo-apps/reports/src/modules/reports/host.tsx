'use client';
/*
 * Product context for the Lumen Reports module. Session, navigation, preferences, theme, localization and
 * notifications belong to the application host (ApplicationProviders); this only carries the authenticated
 * scope, the effective preferences, the configured HTTP transport and module-relative navigation.
 */
import React, {createContext, useContext, useMemo} from 'react';
import {PresentationProvider, presentationFromPreferences} from '@pepbits/components';
import type {PreferenceKey, PreferencePolicy, UserPreferences} from '@pepbits/preferences';

export interface ReferenceScope {moduleId?: string; tenantId: string; applicationId: string; branchId: string; userId: string; roles: readonly string[]}
export interface ReferencePreferenceHost {preferences: UserPreferences; preferencePolicy?: PreferencePolicy; preferencesAvailable?: boolean; onPreferenceChange?: <K extends PreferenceKey>(key: K, value: UserPreferences[K]) => void}
/** Scope comes from the authenticated host identity. It is routing metadata, never server authority. */
export interface ReferenceHost {
  scope: ReferenceScope;
  preferences: UserPreferences;
  preferenceHost?: ReferencePreferenceHost;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  fetch?: (path: string, init?: RequestInit) => Promise<Response>;
  navigate: (path: string) => void;
  hrefFor?: (path: string) => string;
  path?: string;
}
export interface ReferenceRoute {path: string; title: string}
export interface ReferenceModuleProps {path: string; host: ReferenceHost}

const HostContext = createContext<ReferenceHost | null>(null);
export function useReferenceHost(): ReferenceHost {
  const host = useContext(HostContext);
  if (!host) throw new Error('Lumen Reports requires an authenticated host adapter');
  return host;
}
export function ReferenceHostProvider({host, children}: {host: ReferenceHost; children: React.ReactNode}) {
  const presentation = useMemo(() => presentationFromPreferences(host.preferences), [host.preferences]);
  return <HostContext.Provider value={host}><PresentationProvider value={presentation}>{children}</PresentationProvider></HostContext.Provider>;
}
/** Module-relative link: plain clicks use host navigation, modified clicks keep the browser's own behaviour. */
export function ReferenceLink({href, onClick, ...props}: React.ComponentProps<'a'> & {href: string}) {
  const host = useReferenceHost();
  return <a {...props} href={host.hrefFor?.(href) ?? href} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && (!props.target || props.target === '_self') && !props.download && href.startsWith('/')) {
      event.preventDefault(); host.navigate(href);
    }
  }}/>;
}
export function useReferenceRouter() {
  const host = useReferenceHost();
  return useMemo(() => ({push: host.navigate, replace: host.navigate, back: () => host.navigate('/')}), [host]);
}
export function referenceScopeKey(scope: ReferenceScope) {
  return JSON.stringify([scope.tenantId, scope.applicationId, scope.branchId, scope.userId, [...scope.roles].sort(), scope.moduleId]);
}
