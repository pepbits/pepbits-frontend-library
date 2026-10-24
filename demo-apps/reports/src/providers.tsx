'use client';
import React from 'react';
import {ApplicationProviders} from '@pepbits/shell/application-providers';
import {reportsProductForRole} from './navigation';
import {API_PRODUCT} from './adapters/http';
export {useSettingsServices} from '@pepbits/shell/application-providers';
const brand = {name: 'Lumen Reports', tagline: 'Fictional reporting workflows'};
/** The shared host chain: session against the demo API, API-backed preferences/policy, runtime catalogs and the full shell. */
export function ReportsProviders(props: Omit<React.ComponentProps<typeof ApplicationProviders>, 'productId' | 'brand' | 'productForRole'>) {
  return <ApplicationProviders {...props} productId={API_PRODUCT} brand={brand} productForRole={reportsProductForRole} className="reports-page" notice="Fictional demonstration only"/>;
}
