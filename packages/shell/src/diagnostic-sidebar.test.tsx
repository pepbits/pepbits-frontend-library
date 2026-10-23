import React from 'react';
import {render,screen,fireEvent,act} from '@testing-library/react';
import {beforeEach,it,expect,vi} from 'vitest';
import {Sidebar} from './sidebar';
import {ShellTestHost,catalog,product,port} from './test/host';
import type {ProductDefinition} from './products';
const state={moduleId:'operations',pinned:false,locked:false,expandOn:'click' as 'click'|'hover',language:'en' as 'en'|'ar'};
const update=vi.fn(),open=vi.fn();
const modules=['operations','tools','projects','resources'];
const railProduct:ProductDefinition={...product,
 modules:Object.fromEntries(modules.map(id=>[id,{...catalog.modules.operations!,id,navigation:[{id:'main',label:'Main',items:[{id:'home',label:'Overview',pageId:id+'-dashboard'},{id:'items',label:'Items',pageId:id+'-items'}]}]}])),
 pages:Object.fromEntries(modules.flatMap(id=>[[id+'-dashboard',{...catalog.pages['operations-dashboard']!,id:id+'-dashboard',module:id}],[id+'-items',{...catalog.pages.items!,id:id+'-items',module:id}]]))};
const tree=(forceExpanded=false)=><ShellTestHost product={railProduct} navigation={{...port,hrefFor:target=>"#"+target.pageId,current:{pageId:state.moduleId+'-dashboard'},open}} settings={{preferences:{sidebarPinned:state.pinned,sidebarExpandOn:state.expandOn,language:state.language},update,preferencePolicy:{revision:1,rules:{sidebarPinned:{value:state.pinned,locked:state.locked}}}}}><Sidebar forceExpanded={forceExpanded}/></ShellTestHost>;
beforeEach(()=>{state.moduleId='operations';state.pinned=false;state.locked=false;state.expandOn='click';state.language='en';update.mockClear();open.mockClear();});
const renderRail=()=>render(tree());
const rail=()=>screen.getByRole('complementary');
it.each(['en','ar'] as const)('matches the shell spacer placement in %s',language=>{
 state.language=language;renderRail();expect(rail()).toHaveClass('left-0');
});
it.each(['tools','projects','operations','resources'])('%s follows click mode and closes after outside clicks',id=>{
 state.moduleId=id;renderRail();const toggle=screen.getByRole('button',{name:'Expand navigation'});
 fireEvent.mouseEnter(rail());fireEvent.focus(toggle);expect(toggle).toHaveAttribute('aria-expanded','false');
 fireEvent.click(toggle);expect(screen.getByRole('button',{name:'Collapse navigation'})).toHaveAttribute('aria-expanded','true');
 fireEvent.pointerDown(document.body);expect(screen.getByRole('button',{name:'Expand navigation'})).toHaveAttribute('aria-expanded','false');
});
it.each(['tools','projects','operations','resources'])('%s follows hover mode and manual dismissal',id=>{
 state.moduleId=id;state.expandOn='hover';renderRail();
 fireEvent.mouseEnter(rail());const toggle=screen.getByRole('button',{name:'Collapse navigation'});expect(toggle).toHaveAttribute('aria-expanded','true');
 fireEvent.click(toggle);expect(screen.getByRole('button',{name:'Expand navigation'})).toHaveAttribute('aria-expanded','false');
 fireEvent.mouseLeave(rail());fireEvent.mouseEnter(rail());expect(screen.getByRole('button',{name:'Collapse navigation'})).toHaveAttribute('aria-expanded','true');
 fireEvent.mouseLeave(rail());expect(screen.getByRole('button',{name:'Expand navigation'})).toHaveAttribute('aria-expanded','false');
});
it.each(['tools','projects','operations'])('%s opens its item destination and closes an unpinned rail',id=>{
 state.moduleId=id;renderRail();fireEvent.click(screen.getByRole('button',{name:'Expand navigation'}));
 fireEvent.click(screen.getByRole('link',{name:'Items'}));expect(open).toHaveBeenCalledWith(expect.objectContaining({pageId:id+'-items'}));
 expect(screen.getByRole('button',{name:'Expand navigation'})).toHaveAttribute('aria-expanded','false');
});
it.each(['tools','projects','operations'])('%s stays closed after choosing a page under a still pointer in hover mode',id=>{
 state.moduleId=id;state.expandOn='hover';renderRail();
 fireEvent.mouseEnter(rail());fireEvent.click(screen.getByRole('link',{name:'Items'}));
 expect(screen.getByRole('button',{name:'Expand navigation'})).toHaveAttribute('aria-expanded','false');
 // Chromium re-sends mouseenter when the rail re-renders under a pointer that never moved.
 fireEvent.mouseEnter(rail());expect(screen.getByRole('button',{name:'Expand navigation'})).toHaveAttribute('aria-expanded','false');
 fireEvent.mouseLeave(rail());fireEvent.mouseEnter(rail());expect(screen.getByRole('button',{name:'Collapse navigation'})).toHaveAttribute('aria-expanded','true');
});
it('keeps managed pinning and blocks manual, outside and navigation dismissal',()=>{
 state.pinned=true;state.locked=true;renderRail();const toggle=screen.getByRole('button',{name:'Collapse navigation'});
 expect(toggle).toBeDisabled();fireEvent.click(toggle);fireEvent.pointerDown(document.body);fireEvent.click(screen.getByRole('link',{name:'Items'}));
 expect(update).not.toHaveBeenCalled();expect(toggle).toHaveAttribute('aria-expanded','true');
 expect(screen.getByRole('button',{name:'Unpin sidebar'})).toBeDisabled();
 expect(screen.getByTitle('Sidebar is fixed')).toBeDisabled();
});
it('an unpinned rail keeps its pin control below the header strip',()=>{
 renderRail();fireEvent.click(screen.getByRole('button',{name:'Expand navigation'}));
 const pin=screen.getByRole('button',{name:'Pin sidebar'});expect(pin.closest('aside')?.firstElementChild?.contains(pin)).toBe(false);
 fireEvent.click(pin);expect(update).toHaveBeenCalledWith({sidebarPinned:true});
});
it('keyboard focus on the toggle does not change its action; Escape restores focus and collapses',()=>{
 renderRail();const toggle=screen.getByRole('button',{name:'Expand navigation'});act(()=>toggle.focus());expect(toggle).toHaveAttribute('aria-expanded','false');
 fireEvent.click(toggle);fireEvent.keyDown(document,{key:'Escape'});expect(toggle).toHaveFocus();expect(toggle).toHaveAttribute('aria-expanded','false');
});
it('unpinning through the toggle uses the shared preference update',()=>{
 state.pinned=true;renderRail();fireEvent.click(screen.getByRole('button',{name:'Collapse navigation'}));expect(update).toHaveBeenCalledWith({sidebarPinned:false});
});

it.each(['ctrlKey','metaKey','shiftKey','altKey'])('preserves native %s link behavior and active semantics',modifier=>{
 state.pinned=true;renderRail();
 const link=screen.getByRole('link',{name:'Items'});
 expect(fireEvent.click(link,{[modifier]:true})).toBe(true);expect(open).not.toHaveBeenCalled();
 expect(screen.getAllByRole('link').filter(item=>item.getAttribute('aria-current')==='page')).toHaveLength(1);
 expect(fireEvent.click(link)).toBe(false);expect(open).toHaveBeenCalledTimes(1);
});
it('host drawer expansion survives outside clicks without changing managed preferences',()=>{
 render(tree(true));
 fireEvent.pointerDown(document.body);
 expect(screen.getByRole('button',{name:'Collapse navigation'})).toHaveAttribute('aria-expanded','true');
 expect(screen.getByRole('link',{name:'Items'})).toBeVisible();expect(update).not.toHaveBeenCalled();
});
