import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,test} from 'vitest';
import {ShellTestHost} from './test/host';
import {EnterpriseShell} from './enterprise-shell';

afterEach(()=>{document.documentElement.removeAttribute('dir');document.documentElement.removeAttribute('lang');});
test.each(['left','right'] as const)('Arabic RTL keeps physical %s placement during keyboard expansion',sidebarPlacement=>{
  render(<ShellTestHost settings={{preferences:{language:'ar',sidebarPlacement,sidebarPinned:false,sidebarExpandOn:'click',sidebarFocusExpand:true}}}>
    <EnterpriseShell header={<button>Outside</button>} footer={null}><p>Screen</p></EnterpriseShell>
  </ShellTestHost>);
  expect(document.documentElement).toHaveAttribute('dir','rtl');
  expect(document.documentElement).toHaveAttribute('lang','ar');
  const rail=screen.getByRole('complementary');
  // jsdom cannot measure physical pixels: pin actual physical offsets and the RTL-compensated frame order.
  expect(rail).toHaveClass(`${sidebarPlacement}-0`);
  expect(rail).not.toHaveClass(`${sidebarPlacement==='left'?'right':'left'}-0`);
  expect(rail.parentElement).toHaveClass(sidebarPlacement==='left'?'flex-row-reverse':'flex-row');
  const collapsed=screen.getByRole('button',{name:'Expand navigation'});
  expect(collapsed).toHaveAttribute('aria-expanded','false');
  act(()=>screen.getByRole('button',{name:'Items'}).focus());
  expect(screen.getByRole('button',{name:'Collapse navigation'})).toHaveAttribute('aria-expanded','true');
  expect(rail).toHaveClass(`${sidebarPlacement}-0`,'w-[var(--sidebar-expanded)]');
  fireEvent.keyDown(document,{key:'Escape'});
  expect(screen.getByRole('button',{name:'Expand navigation'})).toHaveAttribute('aria-expanded','false');
  act(()=>screen.getByRole('button',{name:'Outside'}).focus());
  act(()=>screen.getByRole('button',{name:'Items'}).focus());
  expect(screen.getByRole('button',{name:'Collapse navigation'})).toHaveAttribute('aria-expanded','true');
  act(()=>screen.getByRole('button',{name:'Outside'}).focus());
  expect(screen.getByRole('button',{name:'Expand navigation'})).toHaveAttribute('aria-expanded','false');
});
