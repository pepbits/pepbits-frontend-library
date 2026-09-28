'use client';
/*
 * Replaces the source AuthProvider/ThemeProvider. Identity is derived from the host's
 * authenticated scope; the module never stores a session or token itself, and never
 * mutates document theme classes. Scope values are routing/isolation metadata, not
 * proof of authority — the server enforces permissions.
 */
import { useCallback, useMemo } from 'react';
import { useReferenceHost } from '@pepbits/reference-host';
import { useApi } from './client';

export interface User { name: string; email: string; role: string; branch: string; token: string }

export function useAuth() {
  const { scope, navigate } = useReferenceHost();
  const api = useApi();
  const user = useMemo<User>(() => ({ name: scope.userId, email: scope.userId, role: scope.roles[0] ?? 'user', branch: scope.branchId, token: '' }), [scope.userId, scope.branchId, scope.roles]);
  /** Validates credentials through the host request; the host owns any resulting session. */
  const signIn = useCallback(async (email: string, password: string, _remember?: boolean) => {
    await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  }, [api]);
  const signOut = useCallback(() => navigate('/login'), [navigate]);
  return { user, ready: true, signIn, signOut };
}

/** Theme is inherited from host preferences; the module cannot toggle it. */
export function useTheme() {
  const { preferences } = useReferenceHost();
  const theme: 'light' | 'dark' = preferences.theme === 'midnight' ? 'dark' : 'light';
  return { theme, toggle: () => {} };
}

/** Host gate for optional document key listeners (PREF-07). */
export function useShortcutsEnabled(): boolean {
  return useReferenceHost().preferences.keyboardShortcuts !== false;
}

/** Effective host motion preference for source scroll/navigation effects. */
export function useReducedMotion(): boolean {
  return useReferenceHost().preferences.reducedMotion === true;
}
