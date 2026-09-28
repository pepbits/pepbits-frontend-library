'use client';
/*
 * Managed presentation choices (result view, density, page size). Values come from the
 * host's effective preferences. A change is accepted only when the host exposes the
 * central update path (PreferenceHost.onPreferenceChange), the key is not locked and the
 * value is allowed; otherwise the control is reported as unavailable and must be disabled
 * (no local-only persistence). A policy or allowed-values change while mounted replaces a
 * conflicting local value with the effective one (PREF-02/03).
 */
import { useCallback, useEffect, useState } from 'react';
import type { PreferenceKey, UserPreferences } from '@pepbits/erp-config';
import { useReferenceHost } from '@pepbits/reference-host';

export function useManagedPreference<K extends PreferenceKey>(key: K) {
  const host = useReferenceHost();
  const ph = host.preferenceHost;
  const effective = host.preferences[key];
  const rule = ph?.preferencePolicy?.rules[key];
  const allowed = rule?.allowedValues as UserPreferences[K][] | undefined;
  const allowedSig = allowed ? JSON.stringify(allowed) : '';
  const update = ph?.onPreferenceChange;
  const locked = Boolean(rule?.locked) || ph?.preferencesAvailable === false;
  /** Writable only through the central update path. */
  const disabled = locked || !update;
  const [value, setLocal] = useState<UserPreferences[K]>(effective);
  useEffect(() => { setLocal(effective); }, [effective, locked, allowedSig]);
  const isAllowed = useCallback((next: UserPreferences[K]) => !allowed || allowed.includes(next), [allowedSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((next: UserPreferences[K]): boolean => {
    if (disabled || !isAllowed(next)) return false;
    setLocal(next);
    update!(key, next);
    return true;
  }, [disabled, isAllowed, update, key]);
  const current = disabled || !isAllowed(value) ? effective : value;
  return { value: current, set, locked, disabled, allowed, isAllowed };
}
