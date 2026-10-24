'use client';
import React from 'react';
import {ApplicationProviders} from '@pepbits/shell/application-providers';
import {erpProductForRole} from './navigation';
import {API_PRODUCT} from './adapters/http';
export {useSettingsServices} from '@pepbits/shell/application-providers';
const brand={name:'ERP',tagline:'Fictional ERP workflows'};
export function ErpProviders(props:Omit<React.ComponentProps<typeof ApplicationProviders>,'productId'|'brand'|'productForRole'>){return <ApplicationProviders {...props} productId={API_PRODUCT} brand={brand} productForRole={erpProductForRole} className="erp-page" notice="Fictional demonstration only"/>;}
