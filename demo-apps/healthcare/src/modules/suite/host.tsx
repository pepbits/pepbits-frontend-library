'use client';
import React, {createContext, useContext, useMemo} from 'react';
import {createFormatters, type Formatters} from '@pepbits/i18n';
import {useLocalization} from '@pepbits/i18n/react';
import {PresentationProvider} from '@pepbits/components';
import type {UserPreferences} from '@pepbits/preferences';
import type {PreferenceHost} from '../preference-choice';
import {readJson, type Request} from '../../adapters/http';
export interface SuiteScope {moduleId?: string; tenantId: string; applicationId: string; branchId: string; userId: string; roles: readonly string[]}
export interface SuiteHost {
  scope: SuiteScope; preferences: UserPreferences; preferenceHost?: PreferenceHost;
  fetch?: Request; request: <T>(path: string, init?: RequestInit) => Promise<T>;
  path?: string; navigate: (path: string) => void; hrefFor?: (path: string) => string;
}
const Context = createContext<SuiteHost | null>(null);
export function SuiteHostProvider({host, children}: {host: SuiteHost; children: React.ReactNode}) {
  return <Context.Provider value={host}><PresentationProvider value={host.preferences}><div className="pepbits-reference-module" data-density={host.preferences.density} data-reduced-motion={host.preferences.reducedMotion}>{children}</div></PresentationProvider></Context.Provider>;
}
export function useSuiteHost() {const host = useContext(Context); if (!host) throw new Error('Healthcare Suite host is missing'); return host;}
export function suiteScopeKey(scope: SuiteScope) {return JSON.stringify([scope.tenantId, scope.applicationId, scope.branchId, scope.userId, scope.roles]);}
export function createSuiteTransport(options: {fetch: Request; applicationId: string; branchId: string; moduleId?: string}) {
  const fetch: Request = (path, init) => {
    if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f]/.test(path) || path.split(/[/?#]/).some(part => ['.', '..'].includes(decodeURIComponent(part)))) return Promise.reject(new Error('Invalid Healthcare API path'));
    const headers = new Headers(init?.headers); headers.set('X-Product-Id', options.applicationId); headers.set('X-Reference-Branch', options.branchId);
    headers.set('X-Reference-Module', 'reference-healthcare-suite');
    return options.fetch('/reference-modules/healthcare-suite' + path, {...init, headers});
  };
  return {fetch, request: async <T,>(path: string, init?: RequestInit) => readJson<T>(await fetch(path, init))};
}
export function useSuiteRouter() {const host = useSuiteHost(); return useMemo(() => ({push: host.navigate, replace: host.navigate, refresh: () => host.navigate(host.path ?? '/'), back: () => host.navigate('/')}), [host]);}
export function useSuitePathname() {return (useSuiteHost().path ?? '/').split('?')[0]!;}
export function useSuiteSearchParams() {const query = (useSuiteHost().path ?? '').split('?')[1] ?? ''; return useMemo(() => new URLSearchParams(query), [query]);}
export function SuiteLink({href, onClick, ...props}: React.ComponentProps<'a'> & {href: string}) {
  const host = useSuiteHost();
  return <a {...props} href={host.hrefFor?.(href) ?? href} onClick={event => {onClick?.(event); if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !props.target) {event.preventDefault(); host.navigate(href);}}}/>;
}
export function useSuiteFormat(): Formatters & {formatDate: Formatters['date']; formatNumber: Formatters['number']; formatCurrency: Formatters['money']; t: ReturnType<typeof useLocalization>['t']} {
  const {preferences} = useSuiteHost(), {t} = useLocalization();
  const format = useMemo(() => createFormatters(preferences), [preferences]);
  return {...format, formatDate: format.date, formatNumber: format.number, formatCurrency: format.money, t};
}
