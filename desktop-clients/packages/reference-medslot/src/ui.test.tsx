import React from 'react';
import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {DEFAULT_PREFERENCES} from '@pepbits/erp-config';
import {ReferenceHostProvider,type ReferenceHost} from '@pepbits/reference-host';
import {Drawer,Modal} from './components/ui';
afterEach(cleanup);
const host:ReferenceHost={scope:{tenantId:'synthetic',applicationId:'nexora',branchId:'hq',userId:'test',roles:['enterprise-admin']},preferences:DEFAULT_PREFERENCES,request:vi.fn(),navigate:vi.fn()};
describe('MedSlot shared overlay semantics',()=>{
 it.each([[Drawer,'z-50'],[Modal,'z-[60]']] as const)('positions the named dialog itself as the visible overlay', (Overlay,layer)=>{
  render(<ReferenceHostProvider host={host}><Overlay open onClose={vi.fn()} title="Register patient"><input aria-label="First name"/></Overlay></ReferenceHostProvider>);
  const dialog=screen.getByRole('dialog',{name:'Register patient'});
  expect(dialog).toHaveClass('fixed','inset-0',layer);
  expect(dialog).toHaveAttribute('aria-modal','true');
  expect(dialog).toContainElement(screen.getByRole('textbox',{name:'First name'}));
 });
});
