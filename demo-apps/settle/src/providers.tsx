'use client';
import React from 'react';
import {ApplicationProviders} from '@pepbits/shell/application-providers';
import {settleProductForRole} from './navigation';
import {API_PRODUCT} from './adapters/http';
import type {SettleFetch} from './adapters/settle';
import {SettleRuntimeRoot} from './modules/settle/runtime';
export {useSettingsServices} from '@pepbits/shell/application-providers';
const brand = {name: 'Settle', tagline: 'Fictional patient billing desk'};
type HostProps = Omit<React.ComponentProps<typeof ApplicationProviders>, 'productId' | 'brand' | 'productForRole'>;
/** Shared host (session, preferences, localization, shell) against the demo API, plus the Settle
 * billing runtime against the separately configured, unchanged Settle API. */
export function SettleProviders({settleApiBaseUrl, settleFetch, children, ...props}: HostProps & {settleApiBaseUrl: string; settleFetch?: SettleFetch}) {
  return <ApplicationProviders {...props} productId={API_PRODUCT} brand={brand} productForRole={settleProductForRole} className="settle-page" notice="Fictional demonstration only">
    <SettleRuntimeRoot apiBaseUrl={settleApiBaseUrl} fetcher={settleFetch}>{children}</SettleRuntimeRoot>
  </ApplicationProviders>;
}
