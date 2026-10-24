import React from 'react';
import {act,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {ShellTestHost,port} from './test/host';
import {EnterpriseShell} from './enterprise-shell';
import {HeaderClock} from './header-clock';
import {Sidebar} from './sidebar';
import {useShell} from './shell-context';
import {HelpAssistant} from './layers';

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
test.each(['en','ar'] as const)('physical sidebar placement matches the full frame in %s',language=>{
 const tree=(sidebarPlacement:'left'|'right')=><ShellTestHost settings={{preferences:{language,sidebarPlacement}}}><EnterpriseShell><p>Screen</p></EnterpriseShell></ShellTestHost>;
 const view=render(tree('left'));expect(screen.getByRole('complementary')).toHaveClass('left-0');expect(view.container.firstElementChild).toHaveClass(language==='ar'?'flex-row-reverse':'flex-row');
 view.rerender(tree('right'));expect(screen.getByRole('complementary')).toHaveClass('right-0');expect(view.container.firstElementChild).toHaveClass(language==='ar'?'flex-row':'flex-row-reverse');
});
test('a live policy locks the real pin controls and rejects retained handlers',()=>{
 const update=vi.fn();const tree=(locked:boolean)=><ShellTestHost settings={{preferences:{sidebarPinned:false},update,preferencePolicy:{revision:1,rules:{sidebarPinned:{locked,value:true}}}}}><EnterpriseShell>Screen</EnterpriseShell></ShellTestHost>;
 const view=render(tree(false));view.rerender(tree(true));
 for(const name of ['Collapse navigation','Unpin sidebar','Unfix sidebar'])expect(screen.getByRole('button',{name})).toBeDisabled();
 fireEvent.keyDown(window,{code:'KeyS',altKey:true});expect(update).not.toHaveBeenCalled();expect(screen.getByRole('complementary')).toHaveClass('w-[var(--sidebar-expanded)]');
});
test('an excluded pin value disables shell controls',()=>{
 render(<ShellTestHost settings={{preferences:{sidebarPinned:true},preferencePolicy:{revision:1,rules:{sidebarPinned:{value:true,allowedValues:[true],locked:false}}}}}><Sidebar/></ShellTestHost>);
 expect(screen.getByRole('button',{name:'Unpin sidebar'})).toBeDisabled();expect(screen.getByRole('button',{name:'Collapse navigation'})).toBeDisabled();
});
test('keyboard focus expands readable navigation and moving focus out collapses it',()=>{
 render(<ShellTestHost settings={{preferences:{sidebarPinned:false,sidebarExpandOn:'click',sidebarFocusExpand:true}}}><Sidebar/><button>Outside</button></ShellTestHost>);
 act(()=>screen.getByRole('button',{name:'Items'}).focus());expect(screen.getByRole('button',{name:'Collapse navigation'})).toHaveAttribute('aria-expanded','true');
 act(()=>screen.getByRole('button',{name:'Outside'}).focus());expect(screen.getByRole('button',{name:'Expand navigation'})).toHaveAttribute('aria-expanded','false');
});
test('click-mode search expands and focuses even when focus expansion is off',()=>{
 vi.useFakeTimers();render(<ShellTestHost settings={{preferences:{sidebarPinned:false,sidebarExpandOn:'click',sidebarFocusExpand:false}}}><Sidebar/></ShellTestHost>);
 fireEvent.click(screen.getByRole('button',{name:'Search menu'}));act(()=>vi.runOnlyPendingTimers());expect(screen.getByRole('textbox',{name:'Search the Operations menu'})).toHaveFocus();
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'no such item'}});expect(screen.getByText('No menu item matches')).toBeVisible();
});
test('shortcuts off removes the full-frame dispatcher while normal navigation remains usable',()=>{
 const add=vi.spyOn(window,'addEventListener'),remove=vi.spyOn(window,'removeEventListener');
 const tree=(keyboardShortcuts:boolean)=><ShellTestHost settings={{preferences:{keyboardShortcuts}}}><EnterpriseShell>Screen</EnterpriseShell></ShellTestHost>;
 const view=render(tree(true));const bound=add.mock.calls.filter(([event])=>event==='keydown');expect(bound).toHaveLength(1);
 view.rerender(tree(false));expect(remove).toHaveBeenCalledWith('keydown',bound[0]![1]);fireEvent.keyDown(window,{code:'KeyK',ctrlKey:true});expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/Search.*⌘K/}));expect(screen.getByRole('dialog')).toBeVisible();
});
test('header clock uses host branch zone and effective date, time and seconds preferences',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-23T12:34:56Z'));
 const tree=(seconds:boolean)=><ShellTestHost timezoneForBranch={()=>'Asia/Tokyo'} settings={{preferences:{clockZone:'branch',clockSeconds:seconds,timeFormat:'24h',dateFormat:'iso'}}}><HeaderClock/></ShellTestHost>;
 const view=render(tree(true));expect(screen.getByText('21:34:56')).toBeVisible();expect(view.container.textContent).toContain('2026-10-23');
 view.rerender(tree(false));expect(screen.getByText('21:34')).toBeVisible();expect(screen.queryByText('21:34:56')).toBeNull();
});
test('header exposes only host quick destinations and branch changes',()=>{
 const open=vi.fn(),branch=vi.fn();render(<ShellTestHost navigation={{...port,open}} onBranchChange={branch} branches={[{value:'north',label:'North'},{value:'south',label:'South'}]} quickPages={[{id:'items',label:'Quick items'},{id:'absent',label:'Unavailable'}]}><EnterpriseShell>Screen</EnterpriseShell></ShellTestHost>);
 fireEvent.click(screen.getByRole('button',{name:'Quick items'}));expect(open).toHaveBeenCalledWith({pageId:'items'});expect(screen.queryByText('Unavailable')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/^Branch\b/}));fireEvent.click(screen.getByRole('option',{name:'South'}));expect(branch).toHaveBeenCalledWith('south');
});
test.each([true,false])('tour scroll obeys reducedMotion=%s and opening help never starts a tour',reducedMotion=>{
 const scroll=vi.spyOn(Element.prototype,'scrollIntoView');
 function Open(){const shell=useShell();return <button onClick={()=>shell.setHelpOpen(true)}>Open help</button>;}
 render(<ShellTestHost tours={{items:[{target:'sample',title:'Example step',text:'Try this'},{target:'missing',title:'Missing',text:'Hidden'}]}} settings={{preferences:{reducedMotion}}}><div data-tour="sample">Anchor</div><Open/><HelpAssistant/></ShellTestHost>);
 fireEvent.click(screen.getByRole('button',{name:'Open help'}));expect(scroll).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Tour'}));expect(within(screen.getByRole('dialog')).getByText('1 / 1')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Play tour'}));expect(scroll).toHaveBeenCalledWith({block:'center',inline:'nearest',behavior:reducedMotion?'auto':'smooth'});expect(document.documentElement.dataset.reducedMotion).toBe(String(reducedMotion));
});

test('profile action name includes the visible initials and user identity',()=>{
 const view=render(<ShellTestHost><EnterpriseShell>Screen</EnterpriseShell></ShellTestHost>);
 expect(screen.getByRole('main')).toHaveAttribute('tabindex','0');
 expect(screen.getByRole('button',{name:'Open profile menu — Alex Example — AE'})).toHaveTextContent('AE');
 view.rerender(<ShellTestHost session={{status:'anonymous',user:null,login:async()=>null,logout:async()=>{}}}><EnterpriseShell>Screen</EnterpriseShell></ShellTestHost>);
 expect(screen.getByRole('button',{name:'Open profile menu — --'})).toHaveTextContent('--');
});
