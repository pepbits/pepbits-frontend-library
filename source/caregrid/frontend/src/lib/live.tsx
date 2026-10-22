'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API, api } from './api';

export interface Notice { id: number; created_at: string; level: 'info' | 'success' | 'warning' | 'critical'; category: string; title: string; body?: string; link?: string; read: number }
export interface Toast { key: number; level: Notice['level']; category?: string; title: string; body?: string; link?: string; action?: { label: string; onClick: () => void } }
export interface Meta {
  today: string; now: string;
  departments: { id: number; code: string; name: string; color: string }[];
  categories: { id: number; name: string; icon: string; department_id: number; color: string; type_count: number; department_name: string }[];
  roles: { code: string; label: string; kind: string; department_id: number; turnover_min: number; resource_count: number }[];
  kinds: string[]; exceptionTypes: string[];
}

interface LiveCtx {
  meta: Meta | null; status: 'connecting' | 'live' | 'offline'; lastSync: string | null; version: number;
  notices: Notice[]; unread: number; markAllRead: () => void; markRead: (id: number) => void;
  toasts: Toast[]; toast: (t: Omit<Toast, 'key'>) => void; dismiss: (key: number) => void; bump: () => void;
  ring: number;
}
const Ctx = createContext<LiveCtx | null>(null);

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [status, setStatus] = useState<LiveCtx['status']>('connecting');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ring, setRing] = useState(0);
  const keyRef = useRef(1);
  const bumpTimer = useRef<ReturnType<typeof setTimeout>>();

  const toast = useCallback((t: Omit<Toast, 'key'>) => {
    const key = keyRef.current++;
    setToasts(x => [...x.slice(-3), { ...t, key }]);
  }, []);
  const dismiss = useCallback((key: number) => setToasts(x => x.filter(t => t.key !== key)), []);
  const bump = useCallback(() => {
    clearTimeout(bumpTimer.current);
    bumpTimer.current = setTimeout(() => setVersion(v => v + 1), 250);
  }, []);

  useEffect(() => {
    api<Meta>('/meta').then(setMeta).catch(() => setStatus('offline'));
    api<Notice[]>('/notifications').then(setNotices).catch(() => {});
  }, []);

  useEffect(() => {
    let es: EventSource | null = null; let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      setStatus('connecting');
      es = new EventSource(API + '/events');
      es.addEventListener('hello', (e) => { setStatus('live'); setLastSync(JSON.parse((e as MessageEvent).data).time); if (!meta) api<Meta>('/meta').then(setMeta).catch(() => {}); });
      es.addEventListener('ping', (e) => setLastSync(JSON.parse((e as MessageEvent).data).time));
      es.addEventListener('notification', (e) => {
        const n = JSON.parse((e as MessageEvent).data) as Notice;
        setNotices(x => [n, ...x].slice(0, 80));
        setRing(r => r + 1);
        toast({ level: n.level, category: n.category, title: n.title, body: n.body, link: n.link });
      });
      es.addEventListener('schedule-changed', () => { setLastSync(new Date().toISOString().slice(0, 16)); bump(); });
      es.onerror = () => { setStatus('offline'); es?.close(); retry = setTimeout(connect, 4000); };
    };
    connect();
    return () => { es?.close(); clearTimeout(retry); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markAllRead = useCallback(() => { setNotices(x => x.map(n => ({ ...n, read: 1 }))); api('/notifications/read-all', { body: {} }).catch(() => {}); }, []);
  const markRead = useCallback((id: number) => { setNotices(x => x.map(n => (n.id === id ? { ...n, read: 1 } : n))); api(`/notifications/${id}/read`, { body: {} }).catch(() => {}); }, []);
  const unread = notices.filter(n => !n.read).length;

  const value = useMemo(() => ({ meta, status, lastSync, version, notices, unread, markAllRead, markRead, toasts, toast, dismiss, bump, ring }),
    [meta, status, lastSync, version, notices, unread, markAllRead, markRead, toasts, toast, dismiss, bump, ring]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLive() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLive outside LiveProvider');
  return c;
}

/** Fetch helper that refetches automatically whenever the schedule changes anywhere (live = true). */
export function useApi<T>(path: string | null, opts: { live?: boolean } = {}) {
  const { version } = useLive();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [n, setN] = useState(0);
  const reload = useCallback(() => setN(x => x + 1), []);
  const liveKey = opts.live === false ? 0 : version;
  useEffect(() => {
    if (!path) { setData(null); return; }
    let alive = true;
    setLoading(true);
    api<T>(path).then(d => { if (alive) { setData(d); setError(null); } })
      .catch(e => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [path, n, liveKey]);
  return { data, error, loading, reload, setData };
}
