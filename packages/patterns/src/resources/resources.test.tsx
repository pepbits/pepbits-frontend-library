import React from 'react';
import {act,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {ResourceScope,useFetch,useScopedResource,type JsonRequest} from './index';
function Consumer({url,shared=false}:{url:string;shared?:boolean}){const ordinary=useFetch<string>(shared?null:url),cached=useScopedResource<string>(shared?url:null);return <output>{shared?cached.data:ordinary.data}</output>;}
test('fetch disposal aborts the request and an old completion cannot replace a new scope',async()=>{
 const reads:{path:string;signal:AbortSignal;resolve:(value:string)=>void}[]=[];
 const request=((path,init)=>new Promise<string>(resolve=>reads.push({path,signal:init!.signal as AbortSignal,resolve}))) as JsonRequest;
 const tree=(scopeKey:string)=><ResourceScope scopeKey={scopeKey} request={request} statePath="/state"><Consumer url="/row"/></ResourceScope>;
 const view=render(tree('first'));await waitFor(()=>expect(reads).toHaveLength(1));view.rerender(tree('second'));await waitFor(()=>expect(reads).toHaveLength(2));
 await act(async()=>{reads[1]!.resolve('current');});await waitFor(()=>expect(screen.getByText('current')).toBeVisible());expect(reads[0]!.signal.aborted).toBe(true);
 await act(async()=>{reads[0]!.resolve('late');});expect(screen.getByText('current')).toBeVisible();expect(screen.queryByText('late')).toBeNull();
 view.unmount();expect(reads.every(read=>read.signal.aborted)).toBe(true);
});
test('shared reads deduplicate within a scope and a new scope loads its own value',async()=>{
 const request=vi.fn(async()=> 'fictional') as unknown as JsonRequest;
 const tree=(scopeKey:string)=><ResourceScope scopeKey={scopeKey} request={request} statePath="/state"><Consumer url="/lookup" shared/><Consumer url="/lookup" shared/></ResourceScope>;
 const view=render(tree('first'));await waitFor(()=>expect(screen.getAllByText('fictional')).toHaveLength(2));expect(request).toHaveBeenCalledTimes(1);
 view.rerender(tree('second'));await waitFor(()=>expect(request).toHaveBeenCalledTimes(2));await waitFor(()=>expect(screen.getAllByText('fictional')).toHaveLength(2));
});
