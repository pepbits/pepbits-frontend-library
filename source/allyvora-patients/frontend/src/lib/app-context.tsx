'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LAYOUT_SETTINGS, type LayoutSettings, type Lookups, type SessionInfo } from '@allyvora/shared';
import { api } from './api';
import { storage } from './hooks';

export type ThemePref = 'light' | 'dark' | 'system';

export interface RecentPatient {
  id: number;
  name: string;
  mrn: string;
}

interface AppState {
  ready: boolean;
  error: Error | null;
  retry: () => void;
  session: SessionInfo | null;
  lookups: Lookups;
  settings: LayoutSettings;
  setSettings: (s: LayoutSettings) => void;
  branchId: number | null;
  setBranchId: (id: number) => void;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  recent: RecentPatient[];
  pushRecent: (p: RecentPatient) => void;
}

const Ctx = createContext<AppState | null>(null);

const KEYS = { branch: 'allyvora:branch', theme: 'allyvora:theme', recent: 'allyvora:recent' };

function applyTheme(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

/** Inline script that applies the saved theme before first paint. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${KEYS.theme}');t=t?JSON.parse(t):'system';if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [lookups, setLookups] = useState<Lookups>({});
  const [settings, setSettings] = useState<LayoutSettings>(DEFAULT_LAYOUT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [branchId, setBranchIdState] = useState<number | null>(null);
  const [theme, setThemeState] = useState<ThemePref>('system');
  const [recent, setRecent] = useState<RecentPatient[]>([]);

  useEffect(() => {
    setThemeState(storage.get<ThemePref>(KEYS.theme) ?? 'system');
    setRecent(storage.get<RecentPatient[]>(KEYS.recent) ?? []);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [theme]);

  useEffect(() => {
    let live = true;
    setError(null);
    Promise.all([api.session(), api.lookups(), api.settings.layout()])
      .then(([s, l, st]) => {
        if (!live) return;
        setSession(s);
        setLookups(l);
        setSettings(st);
        const saved = storage.get<number>(KEYS.branch);
        setBranchIdState(saved && s.branches.some((b) => b.id === saved) ? saved : s.defaultBranchId);
        setReady(true);
      })
      .catch((e: Error) => live && setError(e));
    return () => {
      live = false;
    };
  }, [attempt]);

  const setBranchId = useCallback((id: number) => {
    setBranchIdState(id);
    storage.set(KEYS.branch, id);
  }, []);

  const setTheme = useCallback((t: ThemePref) => {
    setThemeState(t);
    storage.set(KEYS.theme, t);
  }, []);

  const pushRecent = useCallback((p: RecentPatient) => {
    setRecent((prev) => {
      const next = [p, ...prev.filter((x) => x.id !== p.id)].slice(0, 5);
      storage.set(KEYS.recent, next);
      return next;
    });
  }, []);

  const value = useMemo<AppState>(
    () => ({
      ready,
      error,
      retry: () => setAttempt((a) => a + 1),
      session,
      lookups,
      settings,
      setSettings,
      branchId,
      setBranchId,
      theme,
      setTheme,
      recent,
      pushRecent,
    }),
    [ready, error, session, lookups, settings, branchId, setBranchId, theme, setTheme, recent, pushRecent],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
