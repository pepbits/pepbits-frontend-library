'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, revalidateAll, setCurrentUserId, useApi } from './api';
import type { Meta } from './types';

interface SessionCtx {
  meta: Meta | null;
  error: ApiError | null;
  can: (right: string) => boolean;
  switchUser: (id: number) => void;
  setCounter: (id: number | null) => Promise<void>;
  refresh: () => void;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { data, error, reload } = useApi<Meta>('/meta');
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => { if (data) setMeta(data); }, [data]);

  const can = useCallback((right: string) => !!meta && (meta.me.role === 'admin' || meta.me.rights.includes(right)), [meta]);
  const switchUser = useCallback((id: number) => { setCurrentUserId(id); reload(); revalidateAll(); }, [reload]);
  const setCounter = useCallback(async (id: number | null) => {
    await api('/me/counter', { method: 'POST', body: { counterId: id } });
    reload();
    revalidateAll();
  }, [reload]);

  const value = useMemo(() => ({ meta, error, can, switchUser, setCounter, refresh: reload }), [meta, error, can, switchUser, setCounter, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside provider');
  return v;
}
