import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {beforeEach,it,expect,vi} from 'vitest';
import {DEFAULT_PREFERENCES,NEXORA_PRODUCT} from '@pepbits/erp-config';
import {ProductProvider} from './product-context';
import {Sidebar} from './sidebar';
const state=vi.hoisted(()=>({moduleId:'reference-ris1',pinned:false,locked:false,expandOn:'click' as 'click'|'hover',language:'en' as 'en'|'ar'}));
const update=vi.hoisted(()=>vi.fn());
const open=vi.hoisted(()=>vi.fn());
vi.mock('@pepbits/platform-ports',()=>({useNavigation:()=>({current:{pageId:`${state.moduleId}-dashboard`},open,hrefFor:(t:{pageId:string})=>'#'+t.pageId})}));
vi.mock('./erp-context',()=>({useERP:()=>({module:NEXORA_PRODUCT.modules[state.moduleId],preferences:{...DEFAULT_PREFERENCES,sidebarPinned:state.pinned,sidebarExpandOn:state.expandOn,language:state.language},preferencePolicy:{rules:{sidebarPinned:{locked:state.locked}}},updatePreference:update})}));
beforeEach(()=>{state.moduleId='reference-ris1';state.pinned=false;state.locked=false;state.expandOn='click';state.language='en';update.mockClear();open.mockClear();});
const renderRail=()=>render(<ProductProvider product={NEXORA_PRODUCT}><Sidebar/></ProductProvider>);
const rail=()=>screen.getByRole('complementary');
it.each(['en','ar'] as const)('matches the shell spacer placement in %s',language=>{
 state.language=language;renderRail();expect(rail()).toHaveClass('left-0');
});
it.each(['reference-lis1','reference-lis2','reference-ris1','library'])('%s follows click mode and closes after outside clicks',id=>{
 state.moduleId=id;renderRail();const toggle=screen.getByRole('button',{name:'Expand navigation'});
 fireEvent.mouseEnter(rail());fireEvent.focus(toggle);expect(toggle).toHaveAttribute('aria-expanded','false');
 fireEvent.click(toggle);expect(screen.getByRole('button',{name:'Collapse navigation'})).toHaveAttribute('aria-expanded','true');
 fireEvent.pointerDown(document.body);expect(screen.getByRole('button',{name:'Expand navigation'})).toHaveAttribute('aria-expanded','false');
});
it.each(['reference-lis1','reference-lis2','reference-ris1','library'])('%s follows hover mode and manual dismissal',id=>{
 state.moduleId=id;state.expandOn='hover';renderRail();
 fireEvent.mouseEnter(rail());const toggle=screen.getByRole('button',{name:'Collapse navigation'});expect(toggle).toHaveAttribute('aria-expanded','true');
 fireEvent.click(toggle);expect(screen.getByRole('button',{name:'Expand navigation'})).toHaveAttribute('aria-expanded','false');
 fireEvent.mouseLeave(rail());fireEvent.mouseEnter(rail());expect(screen.getByRole('button',{name:'Collapse navigation'})).toHaveAttribute('aria-expanded','true');
 fireEvent.mouseLeave(rail());expect(screen.getByRole('button',{name:'Expand navigation'})).toHaveAttribute('aria-expanded','false');
});
it.each(['reference-lis1','reference-lis2','reference-ris1'])('%s opens its patient destination and closes an unpinned rail',id=>{
 state.moduleId=id;renderRail();fireEvent.click(screen.getByRole('button',{name:'Expand navigation'}));
 fireEvent.click(screen.getByRole('link',{name:'Patients'}));expect(open).toHaveBeenCalledWith(expect.objectContaining({pageId:id+'-patients'}));
 expect(screen.getByRole('button',{name:'Expand navigation'})).toHaveAttribute('aria-expanded','false');
});
it.each(['reference-lis1','reference-lis2','reference-ris1'])('%s stays closed after choosing a page under a still pointer in hover mode',id=>{
 state.moduleId=id;state.expandOn='hover';renderRail();
 fireEvent.mouseEnter(rail());fireEvent.click(screen.getByRole('link',{name:'Patients'}));
 expect(screen.getByRole('button',{name:'Expand navigation'})).toHaveAttribute('aria-expanded','false');
 // Chromium re-sends mouseenter when the rail re-renders under a pointer that never moved.
 fireEvent.mouseEnter(rail());expect(screen.getByRole('button',{name:'Expand navigation'})).toHaveAttribute('aria-expanded','false');
 fireEvent.mouseLeave(rail());fireEvent.mouseEnter(rail());expect(screen.getByRole('button',{name:'Collapse navigation'})).toHaveAttribute('aria-expanded','true');
});
it('keeps managed pinning and blocks manual, outside and navigation dismissal',()=>{
 state.pinned=true;state.locked=true;renderRail();const toggle=screen.getByRole('button',{name:'Collapse navigation'});
 expect(toggle).toBeDisabled();fireEvent.click(toggle);fireEvent.pointerDown(document.body);fireEvent.click(screen.getByRole('link',{name:'Patients'}));
 expect(update).not.toHaveBeenCalled();expect(toggle).toHaveAttribute('aria-expanded','true');
 expect(screen.getByRole('button',{name:'Unpin sidebar'})).toBeDisabled();
 expect(screen.getByTitle('Sidebar is fixed')).toBeDisabled();
});
it('an unpinned rail keeps its pin control below the header strip',()=>{
 renderRail();fireEvent.click(screen.getByRole('button',{name:'Expand navigation'}));
 const pin=screen.getByRole('button',{name:'Pin sidebar'});expect(pin.closest('aside')?.firstElementChild?.contains(pin)).toBe(false);
 fireEvent.click(pin);expect(update).toHaveBeenCalledWith('sidebarPinned',true);
});
it('keyboard focus on the toggle does not change its action; Escape restores focus and collapses',()=>{
 renderRail();const toggle=screen.getByRole('button',{name:'Expand navigation'});toggle.focus();expect(toggle).toHaveAttribute('aria-expanded','false');
 fireEvent.click(toggle);fireEvent.keyDown(document,{key:'Escape'});expect(toggle).toHaveFocus();expect(toggle).toHaveAttribute('aria-expanded','false');
});
it('unpinning through the toggle uses the shared preference update',()=>{
 state.pinned=true;renderRail();fireEvent.click(screen.getByRole('button',{name:'Collapse navigation'}));expect(update).toHaveBeenCalledWith('sidebarPinned',false);
});

it.each(['ctrlKey','metaKey','shiftKey','altKey'])('preserves native %s link behavior and active semantics',modifier=>{
 state.pinned=true;renderRail();
 const link=screen.getByRole('link',{name:'Patients'});
 expect(fireEvent.click(link,{[modifier]:true})).toBe(true);expect(open).not.toHaveBeenCalled();
 expect(screen.getAllByRole('link').filter(item=>item.getAttribute('aria-current')==='page')).toHaveLength(1);
 expect(fireEvent.click(link)).toBe(false);expect(open).toHaveBeenCalledTimes(1);
});
it('host drawer expansion survives outside clicks without changing managed preferences',()=>{
 render(<ProductProvider product={NEXORA_PRODUCT}><Sidebar forceExpanded/></ProductProvider>);
 fireEvent.pointerDown(document.body);
 expect(screen.getByRole('button',{name:'Collapse navigation'})).toHaveAttribute('aria-expanded','true');
 expect(screen.getByRole('link',{name:'Patients'})).toBeVisible();expect(update).not.toHaveBeenCalled();
});
