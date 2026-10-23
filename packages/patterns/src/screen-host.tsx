'use client';
import React, {createContext, useContext, useMemo, useRef, useState, type ReactNode} from 'react';
import {createFormatters} from '@pepbits/i18n';
import {formatOptionsFrom} from '@pepbits/preferences';
import {usePreferences} from '@pepbits/preferences/react';

/** Routing/isolation metadata only. The server must establish authority independently. */
export interface ScreenScope {module?: string; branch?: string}
export interface ScreenDocument {
  id: string | null;
  focused: boolean;
  /** Host-owned transient document state; this is not durable draft storage. */
  draftState: Readonly<Record<string, unknown>>;
  setDraftState(key: string, value: unknown): void;
  reportDirty(dirty: boolean): void;
  /** Explicit document closure, distinct from suspension/unmount. Absent in standalone hosts. */
  subscribeClose?: (listener: () => void) => () => void;
}
export interface ScreenHost {
  notify(message: string, options: {tone: 'success' | 'error' | 'info' | 'warning'}): void;
  /** UI gating only; absent host authorization fails closed. */
  can(action: string, subject?: unknown): boolean;
  scope: ScreenScope;
  document: ScreenDocument;
  /** Optional opaque extension boundary, populated by the higher layer after shell integration. */
  renderInlineAction?: (props: Readonly<Record<string, unknown>>) => ReactNode;
  publishSources?: (sources: readonly unknown[]) => void | (() => void);
}
export type ScreenHostValue = Partial<Omit<ScreenHost, 'document'>> & {document?: Partial<ScreenDocument>};
const noop = () => {};
const defaults: ScreenHost = {
  notify: noop, can: () => false, scope: Object.freeze({}),
  document: Object.freeze({id: null, focused: true, draftState: Object.freeze({}), setDraftState: noop, reportDirty: noop}),
};
const Context = createContext<ScreenHost>(defaults);

export function ScreenHostProvider({value, children}: {value?: ScreenHostValue; children?: ReactNode}) {
  const host = useMemo<ScreenHost>(() => ({
    notify: value?.notify ?? defaults.notify, can: value?.can ?? defaults.can,
    scope: value?.scope ?? defaults.scope,
    document: {
      id: value?.document?.id ?? defaults.document.id,
      focused: value?.document?.focused ?? defaults.document.focused,
      draftState: value?.document?.draftState ?? defaults.document.draftState,
      setDraftState: value?.document?.setDraftState ?? defaults.document.setDraftState,
      reportDirty: value?.document?.reportDirty ?? defaults.document.reportDirty,
      subscribeClose: value?.document?.subscribeClose,
    },
    renderInlineAction: value?.renderInlineAction, publishSources: value?.publishSources,
  }), [value]);
  return <Context.Provider value={host}>{children}</Context.Provider>;
}
export const useScreenHost = () => useContext(Context);

/** Transient state follows the host document across suspension; standalone state lasts until unmount. */
export function useScreenDraftState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const {document} = useScreenHost();
  const identity = JSON.stringify([document.id,key]);
  const [state, setLocal] = useState(() => ({identity,value:initial}));
  const local = state.identity===identity?state.value:initial;
  if(state.identity!==identity)setLocal({identity,value:initial});
  const current = useRef(local);
  const value = document.id && Object.hasOwn(document.draftState, key) ? document.draftState[key] as T : local;
  current.current = value;
  return [value, next => {
    const updated = typeof next === 'function' ? (next as (previous: T) => T)(current.current) : next;
    current.current = updated;
    if (document.id) document.setDraftState(key, updated);
    setLocal({identity,value:updated});
  }];
}

/** Formatting follows the effective preference snapshot, with no second preference store. */
export function useFormatters() {
  const {preferences} = usePreferences();
  const {currencyCode, numberLocale, dateFormat, decimalPlaces, timeFormat, currencyDisplay, negativeStyle, language} = formatOptionsFrom(preferences);
  return useMemo(() => createFormatters({currencyCode, numberLocale, dateFormat, decimalPlaces, timeFormat, currencyDisplay, negativeStyle, language}),
    [currencyCode, numberLocale, dateFormat, decimalPlaces, timeFormat, currencyDisplay, negativeStyle, language]);
}
