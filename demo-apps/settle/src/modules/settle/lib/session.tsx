'use client';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useApi, useRevalidateAll, useSettleApi} from './api';
import {useSettleRuntime} from '../host';
import type {Meta} from './types';

/** The Settle desk user (source user switcher) and the counter picked in the header. */
interface SessionCtx {
  meta: Meta | null;
  error: {message: string} | null;
  can: (right: string) => boolean;
  switchUser: (id: number) => void;
  setCounter: (id: number | null) => Promise<void>;
  refresh: () => void;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SettleSessionProvider({children}: {children: React.ReactNode}) {
  const {data, error, reload} = useApi<Meta>('/meta');
  const api = useSettleApi();
  const revalidateAll = useRevalidateAll();
  const {setDeskUserId} = useSettleRuntime();
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {if (data) setMeta(data);}, [data]);

  // Rights shape the screens; the Settle server enforces every right for the same desk user.
  const can = useCallback((right: string) => !!meta && (meta.me.role === 'admin' || meta.me.rights.includes(right)), [meta]);
  const switchUser = useCallback((id: number) => {setDeskUserId(id);}, [setDeskUserId]);
  const setCounter = useCallback(async (id: number | null) => {
    await api('/me/counter', {method: 'POST', body: {counterId: id}});
    reload();
    revalidateAll();
  }, [api, reload, revalidateAll]);

  const value = useMemo(() => ({meta, error, can, switchUser, setCounter, refresh: reload}), [meta, error, can, switchUser, setCounter, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside provider');
  return v;
}
