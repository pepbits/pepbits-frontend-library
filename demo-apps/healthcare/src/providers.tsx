'use client';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {SessionProvider, useSession, type SessionValue} from '@pepbits/platform/auth';
import type {NavigationPort} from '@pepbits/platform/navigation';
import {PreferenceHost, usePreferences} from '@pepbits/preferences/react';
import {EMPTY_PREFERENCE_POLICY} from '@pepbits/preferences';
import {createTranslator, directionOf, type TranslationCatalog} from '@pepbits/i18n';
import {LocalizationProvider} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {LoadingState, RecoveryNotice, failureFromError} from '@pepbits/components';
import {EnterpriseShell, ShellProvider} from '@pepbits/shell';
import {LoginScreen} from '@pepbits/shell/login';
import {API_PRODUCT, createRequest, readJson, RequestContext, type Request} from './adapters/http';
import {loadPreferences, savePreferences, type PreferenceSnapshot} from './adapters/preferences';
import {product} from './navigation';

const brand = {name: 'Healthcare', tagline: 'Fictional healthcare workflows'};
const SettingsServices = createContext<{request: Request; canManagePreferencePolicy: boolean; saveError?: string; reload: () => Promise<void>} | undefined>(undefined);
export const useSettingsServices = () => useContext(SettingsServices);
export function HealthcareProviders({apiBaseUrl, navigation, children, request: suppliedRequest, session}: {
  apiBaseUrl: string; navigation: NavigationPort; children: React.ReactNode; request?: Request; session?: SessionValue;
}) {
  const request = useMemo(() => suppliedRequest ?? createRequest(apiBaseUrl), [apiBaseUrl, suppliedRequest]);
  return <SessionProvider {...(session ? {value: session} : {apiBaseUrl})}><SessionContent request={request} navigation={navigation}>{children}</SessionContent></SessionProvider>;
}
function SessionContent({request, navigation, children}: {request: Request; navigation: NavigationPort; children: React.ReactNode}) {
  const session = useSession();
  if (session.status === 'loading') return <LoadingState/>;
  if (!session.user) return <PreferenceHost preferences={{}} preferencePolicy={EMPTY_PREFERENCE_POLICY} preferencesAvailable={false} update={() => {}}>
    <LocaleSurface catalogs={{}}><LoginScreen brand={brand} notice="Fictional demonstration only"/></LocaleSurface>
  </PreferenceHost>;
  return <Authenticated key={JSON.stringify([session.user.tenantId, session.user.id, session.user.role, session.user.branch])} request={request} navigation={navigation}>{children}</Authenticated>;
}
function LocaleSurface({catalogs, children}: {catalogs: TranslationCatalog; children: React.ReactNode}) {
  const {preferences} = usePreferences(), format = useFormatters();
  const value = useMemo(() => {
    const translate = createTranslator({language: preferences.language, catalogs});
    return {language: preferences.language, direction: directionOf(preferences.language), dateTime: format.dateTime,
      t: (key: string, values?: Record<string, string | number>) => {
        const text = translate(key, values);
        // The API catalog needs a session. Before sign-in, shared UI identifiers have a readable literal fallback.
        if (text === key && key.startsWith('ui.')) return key.slice(3).replace(/\.[a-f0-9]{8}$/, '').replaceAll('.', ' ');
        return text;
      }};
  }, [preferences.language, catalogs, format]);
  return <LocalizationProvider value={value}><div dir={value.direction}>{children}</div></LocalizationProvider>;
}
function Authenticated({request, navigation, children}: {request: Request; navigation: NavigationPort; children: React.ReactNode}) {
  const {user} = useSession();
  const [snapshot, setSnapshot] = useState<PreferenceSnapshot | null>(null);
  const accepted = useRef<PreferenceSnapshot | null>(null), live = useRef(true), queue = useRef(Promise.resolve());
  const [error, setError] = useState<unknown>(null), [saveError, setSaveError] = useState<string>();
  const reload = useCallback(async () => {
    try {
      const next = await loadPreferences(request);
      if (live.current && (!accepted.current || next.userRevision >= accepted.current.userRevision && next.policy.revision >= accepted.current.policy.revision)) {accepted.current = next; setSnapshot(next); setError(null); setSaveError(undefined);}
    } catch (failure) {if (live.current) setError(failure);}
  }, [request]);
  useEffect(() => {live.current = true; void reload(); return () => {live.current = false;};}, [reload]);
  useEffect(() => {
    const refresh = () => {queue.current = queue.current.then(reload);};
    window.addEventListener('focus', refresh); window.addEventListener('pepbits-preference-policy-changed', refresh);
    return () => {window.removeEventListener('focus', refresh); window.removeEventListener('pepbits-preference-policy-changed', refresh);};
  }, [reload]);
  const update = useCallback((patch: Parameters<typeof savePreferences>[2]) => {
    queue.current = queue.current.then(async () => {
      if (!live.current || !accepted.current) return;
      try {
        const next = await savePreferences(request, accepted.current, patch);
        if (live.current) {accepted.current = next; setSnapshot(next); setSaveError(undefined);}
      } catch (failure) {if (live.current) setSaveError(failure instanceof Error ? failure.message : 'Preferences could not be saved. Reload before retrying.');}
    });
    return queue.current;
  }, [request]);
  if (!snapshot) return error ? <RecoveryNotice failure={failureFromError(error)} onRetry={() => void reload()}/> : <LoadingState/>;
  return <RequestContext.Provider value={request}><PreferenceHost preferences={snapshot.overrides} preferencePolicy={snapshot.policy} preferencesAvailable={!error && !saveError} update={update}>
    <SettingsServices.Provider value={{request, canManagePreferencePolicy: snapshot.canManage, saveError, reload}}>
      <CatalogHost request={request}><ShellProvider navigation={navigation} product={product} preferencesPageId="preferences" brand={brand}
        branches={[{value: user!.branch, label: user!.branch}]} roles={[{value: user!.role, label: user!.title}]}>
        <EnterpriseShell><div className="healthcare-page">{!!error && <RecoveryNotice failure={failureFromError(error)} onRetry={() => void reload()}/>} {children}</div></EnterpriseShell>
      </ShellProvider></CatalogHost>
    </SettingsServices.Provider>
  </PreferenceHost></RequestContext.Provider>;
}
function CatalogHost({request, children}: {request: Request; children: React.ReactNode}) {
  const {preferences} = usePreferences();
  const [catalogs, setCatalogs] = useState<TranslationCatalog>({}), [error, setError] = useState<unknown>(null), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setError(null);
    void request('/localization?productId=' + API_PRODUCT + '&language=' + preferences.language).then(readJson<{messages: Record<string, string>; fallbackMessages: Record<string, string>}>).then(value => {
      if (active) setCatalogs(previous => ({...previous, en: value.fallbackMessages, [preferences.language]: value.messages}));
    }).catch(failure => {if (active) setError(failure);});
    return () => {active = false;};
  }, [request, preferences.language, retry]);
  if (!catalogs.en) return error ? <RecoveryNotice failure={failureFromError(error)} onRetry={() => setRetry(value => value + 1)}/> : <LoadingState/>;
  return <LocaleSurface catalogs={catalogs}>{!!error && <RecoveryNotice failure={failureFromError(error)} onRetry={() => setRetry(value => value + 1)}/>} {children}</LocaleSurface>;
}
