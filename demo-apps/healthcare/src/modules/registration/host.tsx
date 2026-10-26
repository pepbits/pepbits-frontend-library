'use client';
import React, {useMemo, type ReactNode} from 'react';
import {useSession} from '@pepbits/platform/auth';
import {createAllyVoraClient, createAllyVoraTransport, configuredAllyVoraBase, type AllyVoraClient} from '../../adapters/allyvora';
import {AllyVoraProvider} from './context';

const noop = () => {};
/** Business-module state only; session, preferences, localization and shell belong to healthcare. */
export function RegistrationHost({children, replace = noop, client: supplied}: {children: ReactNode; replace?: (href: string) => void; client?: AllyVoraClient}) {
  const {user} = useSession();
  const client = useMemo(() => supplied ?? createAllyVoraClient(createAllyVoraTransport(configuredAllyVoraBase())), [supplied]);
  const scopeKey = JSON.stringify([user?.tenantId, user?.id, user?.role, user?.branch]);
  return <AllyVoraProvider key={scopeKey} client={client} replace={replace}>{children}</AllyVoraProvider>;
}
