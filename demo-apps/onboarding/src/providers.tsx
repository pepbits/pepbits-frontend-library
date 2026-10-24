'use client';
import React from 'react';
import {ApplicationProviders} from '@pepbits/shell/application-providers';
import {onboardingProductForRole} from './navigation';
import {API_PRODUCT} from './adapters/http';
export {useSettingsServices} from '@pepbits/shell/application-providers';
const brand = {name: 'Orvia onboarding', tagline: 'Fictional Orvia Health Cloud onboarding'};
/** Shared host: demo-API session → API preferences/policy → runtime catalog → shell with onboarding navigation. */
export function OnboardingProviders(props: Omit<React.ComponentProps<typeof ApplicationProviders>, 'productId' | 'brand' | 'productForRole'>) {
  return <ApplicationProviders {...props} productId={API_PRODUCT} brand={brand} productForRole={onboardingProductForRole} className="onboarding-page" notice="Fictional demonstration only"/>;
}
