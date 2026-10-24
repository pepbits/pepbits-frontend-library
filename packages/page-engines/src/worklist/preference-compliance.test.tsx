import React from 'react';
import {renderToString} from 'react-dom/server';
import {screen,fireEvent,waitFor} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import {render,TestHost} from '../test/render';
import {WorklistPage} from './worklist-page';
import {NavigationProvider} from '@pepbits/platform/navigation';
import type {WorklistConfig,PageDefinition} from '../types';
import type {PreferencePolicy} from '@pepbits/preferences';
const page:PageDefinition={id:'items',title:'Items',subtitle:'',kind:'worklist',module:'records'};
const config:WorklistConfig={id:page.id,title:page.title,description:'',entity:'item',primaryKey:'id',displayKey:'name',rows:[],
  columns:[{key:'id',label:'ID',classification:'operational'},{key:'name',label:'Name',classification:'pii'}],
  basicFilters:[{key:'status',label:'Status',type:'select',options:['active'],classification:'operational'},{key:'private',label:'Private filter',type:'text'}],advancedFilters:[]};
function setup(){
 const request=vi.fn(async(path:string,_init?:RequestInit)=>new Response(JSON.stringify(path==='/personal-views'?{views:[]}:{rows:[{id:'A',name:'Record A'}],total:1,page:1})));
 return {request,adapter:{request,identity:'tenant:app:user',applicationId:'app'}};
}
test('print provenance has stable server markup and refreshes immediately before native print',async()=>{
 vi.useFakeTimers({toFake:['Date']});
 try {
  const {adapter}=setup();
  const tree=<TestHost><WorklistPage page={page} config={config} adapter={adapter}/></TestHost>;
  const banner=()=>{const node=document.createElement('div');node.innerHTML=renderToString(tree);expect(node.querySelector('.print-only time')).toBeNull();return node.querySelector('.print-only')!.textContent;};
  vi.setSystemTime(new Date('2026-10-23T01:00:00Z'));const server=banner();
  vi.setSystemTime(new Date('2026-10-23T03:00:00Z'));expect(banner()).toBe(server);
  const {container}=render(tree);await screen.findByText('Record A');
  expect(container.querySelector('.print-only time')).toHaveAttribute('datetime','2026-10-23T03:00:00.000Z');
  vi.setSystemTime(new Date('2026-10-23T04:00:00Z'));fireEvent(window,new Event('beforeprint'));
  expect(container.querySelector('.print-only time')).toHaveAttribute('datetime','2026-10-23T04:00:00.000Z');
 } finally {vi.useRealTimers();}
});
test('worklist applies live table, page-size and result-view locks to controls and search requests',async()=>{
 const {request,adapter}=setup(),update=vi.fn();
 const tree=(policy:PreferencePolicy)=><TestHost preferences={{resultView:'cards',pageSize:50}} preferencePolicy={policy} update={update}>
   <WorklistPage page={page} config={config} adapter={adapter}/></TestHost>;
 const {container,rerender}=render(tree({revision:1,rules:{resultView:{locked:true,value:'table'},pageSize:{locked:true,value:10},density:{locked:true,value:'spacious'},zebraStripes:{locked:true,value:false},stickyTableHeader:{locked:true,value:false},wrapCellText:{locked:true,value:true}}}));
 await screen.findByText('Record A');
 expect(container.querySelector('table')).toHaveAttribute('data-density','spacious');
 expect(container.querySelector('table')).toHaveAttribute('data-striped','false');
 expect(container.querySelector('table')).toHaveAttribute('data-sticky','false');
 expect(container.querySelector('table')).toHaveAttribute('data-wrap','true');
 expect(screen.getByRole('combobox',{name:'Rows per page'})).toBeDisabled();
 fireEvent.click(screen.getByRole('radio',{name:'Card grid view'}));expect(update).not.toHaveBeenCalled();
 expect(JSON.parse(request.mock.calls.find(([path])=>path==='/worklists/search')![1]!.body as string).pageSize).toBe(10);
 rerender(tree({revision:2,rules:{resultView:{locked:true,value:'cards'},pageSize:{locked:true,value:20}}}));
 await waitFor(()=>expect(container.querySelector('table')).toBeNull());
 await waitFor(()=>expect(JSON.parse(request.mock.calls.filter(([path])=>path==='/worklists/search').at(-1)![1]!.body as string).pageSize).toBe(20));
});
test('filter memory retains only declared operational values and unavailable choices are disabled',async()=>{
 localStorage.clear();const {adapter}=setup();
 render(<TestHost preferences={{rememberFilters:true}} preferencePolicy={{revision:1,rules:{resultView:{value:'table',locked:false,allowedValues:['table']},pageSize:{value:20,locked:false,allowedValues:[20,100]}}}}>
   <WorklistPage page={page} config={config} adapter={adapter}/></TestHost>);
 await screen.findByText('Record A');
 expect(screen.getByRole('radio',{name:'Card grid view'})).toBeDisabled();
 expect(screen.queryByRole('option',{name:'10 / page'})).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Private filter'),{target:{value:'PRIVATE-FILTER'}});
 fireEvent.change(screen.getByLabelText('Status'),{target:{value:'active'}});
 const stored=localStorage.getItem('pepbits-filters:items');expect(stored).not.toContain('PRIVATE-FILTER');expect(JSON.parse(stored!)).toEqual({search:'',filters:{status:'active'}});
});
test('hosts can disable unsupported personal views while rows remain keyboard-openable',async()=>{
 const {request,adapter}=setup(),open=vi.fn();const {container}=render(<NavigationProvider value={{current:{pageId:page.id},open,openInNewContext:open,hrefFor:()=>'/items'}}><WorklistPage page={page} config={config} adapter={adapter} personalViews={false} rowClick="open"/></NavigationProvider>);
 await screen.findByText('Record A');expect(request.mock.calls.some(([path])=>path==='/personal-views')).toBe(false);
 expect(container.querySelector('tbody tr')).toHaveAttribute('tabindex','0');fireEvent.keyDown(container.querySelector('tbody tr')!,{key:'Enter'});expect(open).toHaveBeenCalledWith(expect.objectContaining({recordId:'A',mode:'view'}));expect(screen.queryByRole('button',{name:'Saved views'})).toBeNull();
});

test('host filter/view slots use engine search and layout while saved page sizes obey mounted policy',async()=>{
 const {request,adapter}=setup(),update=vi.fn();
 const tree=(policy:PreferencePolicy)=><TestHost update={update} preferencePolicy={policy}><WorklistPage page={page} config={config} adapter={adapter} personalViews={false}
  renderFilters={({values,onChange,onReset})=><><button onClick={()=>onChange('status','active')}>Host filter</button><output>{values.status}</output><button onClick={onReset}>Host reset</button></>}
  renderViewControls={({layout,onApply})=><button onClick={()=>onApply({...layout,filters:{query:'Private term',status:'active'},columns:['name'],sort:{key:'name',direction:'desc'},pageSize:100})}>Host snapshot</button>}/></TestHost>;
 const view=render(tree({revision:1,rules:{pageSize:{value:10,locked:true}}}));
 await screen.findByText('Record A');fireEvent.click(screen.getByRole('button',{name:'Host filter'}));
 await waitFor(()=>expect(JSON.parse(request.mock.calls.filter(([path])=>path==='/worklists/search').at(-1)![1]!.body as string).safeFilters.status).toBe('active'));
 fireEvent.click(screen.getByRole('button',{name:'Host snapshot'}));
 await waitFor(()=>expect(JSON.parse(request.mock.calls.filter(([path])=>path==='/worklists/search').at(-1)![1]!.body as string)).toMatchObject({pageSize:10,sort:{key:'name',direction:'desc'},sensitiveFilters:{query:'Private term'}}));expect(update).not.toHaveBeenCalled();
 view.rerender(tree({revision:2,rules:{pageSize:{value:20,locked:false,allowedValues:[20,50]}}}));fireEvent.click(screen.getByRole('button',{name:'Host snapshot'}));expect(update).not.toHaveBeenCalled();
 expect(request.mock.calls.some(([path])=>path==='/personal-views')).toBe(false);
});
