import React from 'react';
import {render} from '@testing-library/react';
import {beforeEach,it,expect,vi} from 'vitest';
import {NEXORA_PRODUCT} from '@pepbits/erp-config';
const preferences=vi.hoisted(()=>({defaultModule:'',landingPage:'module-dashboard'}));
const replace=vi.hoisted(()=>vi.fn());
vi.mock('next/navigation',()=>({useRouter:()=>({replace})}));
vi.mock('@pepbits/erp-shell',()=>({useERP:()=>({preferences}),useProduct:()=>NEXORA_PRODUCT}));
vi.mock('@pepbits/erp-screens',()=>({SessionSplash:()=>null}));
import {LandingRedirect} from '../../../apps/web/src/platform/landing-redirect';
beforeEach(()=>{localStorage.clear();replace.mockClear();preferences.defaultModule='';});
it('opens the stored School view with the canonical shared dashboard page',()=>{
 localStorage.setItem('nexora-module','reference-school-student');render(<LandingRedirect/>);
 expect(replace).toHaveBeenCalledWith('/reference-school-student/reference-school-dashboard');
});
it('opens the preferred School view without synthesizing a new page ID',()=>{
 preferences.defaultModule='reference-school-teacher';render(<LandingRedirect/>);
 expect(replace).toHaveBeenCalledWith('/reference-school-teacher/reference-school-dashboard');
});
it('preserves healthcare landing',()=>{
 localStorage.setItem('nexora-module','healthcare');render(<LandingRedirect/>);
 expect(replace).toHaveBeenCalledWith('/healthcare/healthcare-dashboard');
});
