"use client";

import {createContext, createElement, useCallback, useContext, useRef, type ReactNode} from "react";
import {effectivePreferences, EMPTY_PREFERENCE_POLICY, validPreference,
  type PreferenceKey, type PreferencePolicy} from "./preference-policy";
import type {UserPreferences} from "./types";

export type PreferenceUpdate = (patch: Partial<UserPreferences>) => void | Promise<void>;

export interface PreferenceHostProps {
  /** A snapshot or stored overrides. Policy defaults fill missing keys. */
  preferences: Partial<UserPreferences>;
  preferencePolicy?: PreferencePolicy;
  preferencesAvailable?: boolean;
  /** The host owns persistence, errors, and the next preferences snapshot. */
  update: PreferenceUpdate;
  children?: ReactNode;
}

export interface PreferencesContextValue {
  preferencePolicy: PreferencePolicy;
  preferencesAvailable: boolean;
  preferences: UserPreferences;
  isLocked(key: PreferenceKey): boolean;
  allowedValues<K extends PreferenceKey>(key: K): ReadonlyArray<UserPreferences[K]> | undefined;
  update: PreferenceUpdate;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/** Controlled bridge to the host's single update path (PREF-03).
 * There is deliberately no optimistic copy or persistence inside the library. */
export function PreferenceHost({preferences, preferencePolicy = EMPTY_PREFERENCE_POLICY,
  preferencesAvailable = true, update, children}: PreferenceHostProps) {
  const host = useRef({preferencePolicy, preferencesAvailable, update});
  host.current = {preferencePolicy, preferencesAvailable, update};

  // Even a callback retained by a consumer must respect the latest policy.
  const guardedUpdate = useCallback<PreferenceUpdate>(patch => {
    const current = host.current;
    if (!current.preferencesAvailable) return;
    const editable: Partial<UserPreferences> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (!validPreference(key, value)) continue;
      const rule = current.preferencePolicy.rules[key];
      if (rule?.locked || (rule?.allowedValues && !rule.allowedValues.includes(value))) continue;
      Object.assign(editable, {[key]: value});
    }
    if (Object.keys(editable).length) return current.update(editable);
  }, []);

  const value: PreferencesContextValue = {
    preferencePolicy, preferencesAvailable,
    preferences: effectivePreferences(preferences, preferencePolicy),
    isLocked: key => !preferencesAvailable || preferencePolicy.rules[key]?.locked === true,
    allowedValues: <K extends PreferenceKey>(key: K) =>
      preferencePolicy.rules[key]?.allowedValues as ReadonlyArray<UserPreferences[K]> | undefined,
    update: guardedUpdate,
  };
  return createElement(PreferencesContext.Provider, {value}, children);
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences requires a PreferenceHost.");
  return context;
}

/** Uses the same patch callback as usePreferences; no second setter or store. */
export function usePreference<K extends PreferenceKey>(key: K) {
  const host = usePreferences();
  return {value: host.preferences[key], locked: host.isLocked(key),
    allowedValues: host.allowedValues(key), update: host.update};
}
