'use client';
import React, {useCallback, useMemo, useState} from 'react';
import {useSession as useHostSession} from '@pepbits/platform/auth';
import {createSettleTransport, type SettleFetch} from '../../adapters/settle';
import {SettleRuntimeProvider} from './host';
import {SettleDataProvider} from './lib/api';
import {SettleSessionProvider} from './lib/session';

const DESK_USER_KEY = 'pepbits-settle-desk-user';
function readDeskUser(scope: string) {
  try {return Number(sessionStorage.getItem(DESK_USER_KEY + ':' + scope)) || 1;} catch {return 1;}
}

/** Settle runtime for the authenticated host session. The desk user is the source demo's user
 * switcher (sent as `x-user-id`); it is tab-scoped routing metadata for the fictional Settle API,
 * kept per signed-in host user, and never a preference or an authorization grant. */
export function SettleRuntimeRoot({apiBaseUrl, fetcher, children}: {apiBaseUrl: string; fetcher?: SettleFetch; children: React.ReactNode}) {
  const {user} = useHostSession();
  const hostScope = JSON.stringify([user?.tenantId, user?.id, user?.role, user?.branch]);
  const [desk, setDesk] = useState(() => ({scope: hostScope, id: readDeskUser(hostScope)}));
  const deskUserId = desk.scope === hostScope ? desk.id : readDeskUser(hostScope);
  const setDeskUserId = useCallback((id: number) => {
    try {sessionStorage.setItem(DESK_USER_KEY + ':' + hostScope, String(id));} catch {/* storage unavailable */}
    setDesk({scope: hostScope, id});
  }, [hostScope]);
  // A new transport per desk user/host scope remounts every Settle query.
  const transport = useMemo(() => createSettleTransport(apiBaseUrl, () => deskUserId, fetcher), [apiBaseUrl, fetcher, deskUserId, hostScope]); // eslint-disable-line react-hooks/exhaustive-deps
  const scopeKey = JSON.stringify([hostScope, deskUserId]);
  const value = useMemo(() => ({transport, scopeKey, deskUserId, setDeskUserId}), [transport, scopeKey, deskUserId, setDeskUserId]);
  return <SettleRuntimeProvider value={value}><SettleDataProvider><SettleSessionProvider>{children}</SettleSessionProvider></SettleDataProvider></SettleRuntimeProvider>;
}
