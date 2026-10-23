import React,{useEffect} from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {ShellLayers,ShellDocumentProvider,createWorkspace} from '@pepbits/shell';
import {createAiClientWithRequest,useAiSources} from '../client';
import {createAiCatalogue} from '../config';
import {AiTestHost} from '../test/host';
import {useCase,config} from './fixtures.test-support';
import {useAssistant} from './use-assistant';
import {USE_CASES,classificationFor} from '../test/catalog';
import type {AiHost} from './provider';
function setup(useCases=[useCase()]){
 const request=vi.fn(async(path:string)=>new Response(JSON.stringify(path==='/ai/policy'?{tenantId:'t',global:{},modules:{},pages:{},useCases:{}}:path==='/ai/config'?config():{text:'Answer'})));
 const value:AiHost={client:createAiClientWithRequest(request,classificationFor),catalogue:createAiCatalogue(useCases),pages:{'items-a':{pageId:'items-a',module:'operations',title:'Items',build:{enabled:true,useCases:useCases.map(item=>item.id)}}}};
 return {request,value};
}
function Screen({id='one',useCaseId='record.explain'}:{id?:string;useCaseId?:string}){
 const host=useScreenHost();
 useEffect(()=>host.publishSources?.([{id:'same-owner',sources:{'page-record':{id,status:'Active',notRead:'Never send'}}}]),[id,host.publishSources]);
 return <>{host.renderInlineAction?.({useCaseId})}</>;
}
function Sources(){return <output data-testid="sources">{JSON.stringify(useAiSources())}</output>;}
test('ScreenHost publishes and retracts sources, renders InlineAiAction, and the help slot mounts the panel',async()=>{
 const {value,request}=setup();
 const tree=(visible:boolean)=><AiTestHost value={value}>{visible&&<Screen/>}<Sources/><ShellLayers/></AiTestHost>;
 const view=render(tree(true));await waitFor(()=>expect(screen.getByTestId('sources')).toHaveTextContent('one'));
 fireEvent.click(screen.getByRole('button',{name:'Explain this record'}));
 expect(await screen.findByText('Answer')).toBeVisible();
 const body=JSON.parse((request.mock.calls.find(call=>call[0]==='/ai/dispatch') as unknown as [string,RequestInit])[1].body as string);
 expect(body.fields.map((field:{key:string})=>field.key)).toEqual(['id','status']);expect(JSON.stringify(body)).not.toContain('Never send');
 fireEvent.click(screen.getByRole('button',{name:'Open the AI assistant'}));expect(screen.getByRole('dialog',{name:'AI assistant'})).toBeVisible();
 view.rerender(tree(false));await waitFor(()=>expect(screen.getByTestId('sources')).toHaveTextContent('{}'));
});
test('two documents with the same publication id remain isolated across focus and unmount',async()=>{
 const {value}=setup(),workspace=createWorkspace({session:{tenantId:'t',userId:'u'},policy:{platform:{modes:['TAB']}}});
 const a=workspace.openDocument({module:'operations',documentType:'item',entityId:'a',title:'A',route:'items-a'}).document!;
 const b=workspace.openDocument({module:'operations',documentType:'item',entityId:'b',title:'B',route:'items-a'}).document!;
 const tree=(showA:boolean)=><AiTestHost value={value} workspace={workspace}>{showA&&<ShellDocumentProvider documentId={a.documentId}><Screen id="alpha"/></ShellDocumentProvider>}<ShellDocumentProvider documentId={b.documentId}><Screen id="beta"/></ShellDocumentProvider><Sources/></AiTestHost>;
 const view=render(tree(true));await waitFor(()=>expect(screen.getByTestId('sources')).toHaveTextContent('beta'));
 expect(screen.getByTestId('sources')).not.toHaveTextContent('alpha');act(()=>workspace.focusDocument(a.documentId));
 await waitFor(()=>expect(screen.getByTestId('sources')).toHaveTextContent('alpha'));view.rerender(tree(false));
 await waitFor(()=>expect(screen.getByTestId('sources')).toHaveTextContent('{}'));act(()=>workspace.focusDocument(b.documentId));
 await waitFor(()=>expect(screen.getByTestId('sources')).toHaveTextContent('beta'));
});
test('the host user gate removes inline and panel affordances',async()=>{
 const {value}=setup();await act(async()=>{render(<AiTestHost value={{...value,userEnabled:false}}><Screen/><ShellLayers/></AiTestHost>);});
 expect(screen.queryByRole('button',{name:'Explain this record'})).toBeNull();expect(screen.queryByRole('button',{name:'Open the AI assistant'})).toBeNull();
});

test('the actual record form publishes edited values and renders the inline extension',async()=>{
 const {DynamicRecordForm}=await import('@pepbits/page-engines/forms');
 const {RecordAdapterProvider}=await import('@pepbits/page-engines/records');
 const {createMemoryRecordAdapter}=await import('@pepbits/data');
 const {product}=await import('../test/host');
 const {value,request}=setup([useCase({reads:[{source:'form-values',fields:['status']}]})]);
 render(<AiTestHost value={value}><RecordAdapterProvider value={{adapter:createMemoryRecordAdapter(),identity:'t:u',applicationId:'example',sessionAvailable:true}}>
  <DynamicRecordForm page={product.pages['items-a']!} target={{pageId:'items-a',mode:'new'}} schema={{id:'item',singular:'Item',plural:'Items',description:'Records',sections:[{id:'main',title:'Main',description:'',fields:[{id:'status',label:'Status',type:'text'}]}]}}/>
 </RecordAdapterProvider><Sources/></AiTestHost>);
 const input=await screen.findByLabelText('Status');await waitFor(()=>expect(input).toBeEnabled());fireEvent.change(input,{target:{value:'Ready'}});
 await waitFor(()=>expect(screen.getByTestId('sources')).toHaveTextContent('Ready'));fireEvent.click(screen.getByRole('button',{name:'Explain'}));expect(await screen.findByText('Answer')).toBeVisible();
 const dispatch=request.mock.calls.find(call=>call[0]==='/ai/dispatch') as unknown as [string,RequestInit];
 expect(JSON.parse(dispatch[1].body as string).fields).toEqual([{key:'status',label:'Status',value:'Ready'}]);
});
