'use client';
import React from 'react';
import {ApplicationProviders} from '@pepbits/shell/application-providers';
import {healthcareProductForRole} from './navigation';
import {API_PRODUCT} from './adapters/http';
export {useSettingsServices} from '@pepbits/shell/application-providers';
const brand={name:'Healthcare',tagline:'Fictional healthcare workflows'};
export function HealthcareProviders(props:Omit<React.ComponentProps<typeof ApplicationProviders>,'productId'|'brand'|'productForRole'>){return <ApplicationProviders {...props} productId={API_PRODUCT} brand={brand} productForRole={healthcareProductForRole} className="healthcare-page" notice="Fictional demonstration only"/>;}
