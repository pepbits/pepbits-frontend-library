'use client';
import React from 'react';
import {ApplicationProviders} from '@pepbits/shell/application-providers';
import {allyVoraProductForRole} from './navigation';
import {API_PRODUCT} from './adapters/http';
export {useSettingsServices} from '@pepbits/shell/application-providers';
const brand={name:'AllyVora Healthcare',tagline:'Patient registration'};
export function AllyVoraProviders(props:Omit<React.ComponentProps<typeof ApplicationProviders>,'productId'|'brand'|'productForRole'>){return <ApplicationProviders {...props} productId={API_PRODUCT} brand={brand} productForRole={allyVoraProductForRole} className="allyvora-page" notice="Fictional demonstration only"/>;}
