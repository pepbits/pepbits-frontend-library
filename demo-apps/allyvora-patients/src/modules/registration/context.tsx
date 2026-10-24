'use client';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import {DEFAULT_LAYOUT_SETTINGS, type FormValues, type LayoutSettings, type Lookups, type SessionInfo} from '@allyvora/shared';
import {LoadingState, RecoveryNotice, failureFromError} from '@pepbits/components';
import {useScopeMemory} from '@pepbits/patterns/resources';
import type {AllyVoraClient} from '../../adapters/allyvora';

export interface RegistrationDraft {values: FormValues; savedAt: string}

/** Session-scoped module state. Nothing here enters browser storage: the provider is keyed by the signed-in identity. */
export interface AllyVoraState {
  client: AllyVoraClient;
  session: SessionInfo;
  lookups: Lookups;
  settings: LayoutSettings;
  setSettings: (settings: LayoutSettings) => void;
  branchId: number;
  setBranchId: (id: number) => void;
  /** In-memory unsaved registrations for this signed-in session (lost on reload or sign-out). */
  draft: (key: string) => RegistrationDraft | null;
  saveDraft: (key: string, draft: RegistrationDraft | null) => void;
  /** Last register query, so leaving a record returns to the same filtered list. */
  listQuery: string;
  setListQuery: (query: string) => void;
  /** Replace the current URL without adding history (register filters). */
  replace: (href: string) => void;
}
const Context = createContext<AllyVoraState | null>(null);
export function useAllyVora(): AllyVoraState {
  const value = useContext(Context);
  if (!value) throw new Error('useAllyVora must be used inside AllyVoraProvider');
  return value;
}

export function AllyVoraProvider({client, replace, children}: {client: AllyVoraClient; replace: (href: string) => void; children: ReactNode}) {
  const [loaded, setLoaded] = useState<{session: SessionInfo; lookups: Lookups; settings: LayoutSettings} | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [settings, setSettings] = useState<LayoutSettings>(DEFAULT_LAYOUT_SETTINGS);
  const [branchId, setBranchId] = useState(0);
  const [listQuery, setListQuery] = useState('');
  // The shared resource helper owns volatile memory; the identity-keyed
  // module provider is its single owner and lifetime boundary.
  const drafts = useScopeMemory();

  useEffect(() => {
    let live = true;
    setError(null);
    Promise.all([client.session(), client.lookups(), client.settings.layout()]).then(([session, lookups, layout]) => {
      if (!live) return;
      setLoaded({session, lookups, settings: layout});
      setSettings(layout);
      setBranchId(current => current && session.branches.some(branch => branch.id === current) ? current : session.defaultBranchId);
    }).catch(failure => {if (live) setError(failure);});
    return () => {live = false;};
  }, [client, attempt]);

  const draft = useCallback((key: string) => drafts.get(key) as RegistrationDraft | undefined ?? null, [drafts]);
  const saveDraft = useCallback((key: string, value: RegistrationDraft | null) => {if (value) drafts.set(key, value); else drafts.delete(key);}, [drafts]);
  const value = useMemo<AllyVoraState | null>(() => loaded && {client, session: loaded.session, lookups: loaded.lookups, settings, setSettings, branchId, setBranchId, draft, saveDraft, listQuery, setListQuery, replace},
    [loaded, client, settings, branchId, draft, saveDraft, listQuery, replace]);
  if (!value) return error ? <RecoveryNotice failure={failureFromError(error)} onRetry={() => setAttempt(n => n + 1)}/> : <LoadingState/>;
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
