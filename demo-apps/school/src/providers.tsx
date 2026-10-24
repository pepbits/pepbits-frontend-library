'use client';
import React from 'react';
import {ApplicationProviders} from '@pepbits/shell/application-providers';
import {schoolProductForRole} from './navigation';
export {useSettingsServices} from '@pepbits/shell/application-providers';
const brand={name:'Scholaris',tagline:'Fictional school workflows'};
export function SchoolProviders(props:Omit<React.ComponentProps<typeof ApplicationProviders>,'productId'|'brand'|'productForRole'>){return <ApplicationProviders {...props} productId="nexora" brand={brand} productForRole={schoolProductForRole} className="school-page" notice="Fictional demonstration only"/>;}
