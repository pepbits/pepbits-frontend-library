'use client';
import React, {createContext, useContext, useEffect, type ReactNode} from 'react';
import {useSession} from '@pepbits/platform';
import type {AiCatalogue, PageAiInput} from '../config';
import {AiSourcesProvider, type AiClient} from '../client';

export interface AiPage extends PageAiInput {title: string}
export interface AiHost {
  client: AiClient;
  catalogue: AiCatalogue;
  pages: Readonly<Record<string, AiPage>>;
  userEnabled?: boolean;
  /** UI capability only. Server authorization remains mandatory. Absent means denied. */
  canManageAi?: boolean;
}
const Context = createContext<AiHost | null>(null);
export function AiProvider({value, children}: {value: AiHost; children?: ReactNode}) {
  const {user} = useSession();
  const identity = JSON.stringify([user?.tenantId,user?.id,user?.role,user?.branch]);
  useEffect(() => () => value.client.resetAiPolicy(), [value.client,identity]);
  return <Context.Provider value={value}><AiSourcesProvider key={identity}>{children}</AiSourcesProvider></Context.Provider>;
}
export function useAiHost() {
  const host = useContext(Context);
  if (!host) throw new Error('AI UI requires an AiProvider.');
  return host;
}
