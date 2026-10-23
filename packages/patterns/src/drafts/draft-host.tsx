'use client';
import React, {createContext, useContext, type ReactNode} from 'react';
import type {DraftAdapter} from '@pepbits/data';

export interface DraftHostValue {
  adapter: DraftAdapter;
  /** Verified tenant/application/user identity; change it when the session changes. */
  identity: string;
  /** False while the host session is unavailable or expired. */
  available: boolean;
}
const Context = createContext<DraftHostValue | null>(null);
export function DraftHost({children, ...value}: DraftHostValue & {children?: ReactNode}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useDraftHost() {
  const host = useContext(Context);
  if (!host) throw new Error('Shared drafts require a DraftHost with an authenticated adapter.');
  return host;
}
