import {render} from '../test/render';
import React,{useState} from 'react';
import {screen,fireEvent,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {useSharedDraft,DraftRecovery} from './use-shared-draft';
import {DraftHost} from '../drafts/draft-host';
import type {DraftAdapter} from '@pepbits/data';
const policy={revision:0,enabled:true,retentionDays:7,excludedFields:[]};
const scope={productId:'app',pageId:'item-master',recordId:'one',kind:'approval' as const};
function Panel({context='current'}:{context?:string}){const [comment,setComment]=useState('');const draft=useSharedDraft(scope,true,comment?{schemaVersion:1,context,data:{comment}}:null);return <><input aria-label="Comment" value={comment} onChange={e=>setComment(e.target.value)}/><DraftRecovery draft={draft} context={context} onRestore={data=>setComment(data.comment??'')}/><button onClick={()=>void draft.discard()}>Finish</button></>;}
function setup(recovery:any=null){const adapter={load:vi.fn().mockResolvedValue({draft:recovery,draftVersion:recovery?.version??0,draftPolicy:policy}),save:vi.fn().mockImplementation(async(_scope,values,version)=>({values,version:version+1,savedAt:new Date().toISOString()})),discard:vi.fn().mockResolvedValue(undefined)};const view=render(<DraftHost adapter={adapter as DraftAdapter} identity="tenant:user" available><Panel/></DraftHost>);return {...view,adapter};}
const saved={values:{schemaVersion:1,context:'current',data:{comment:'Recovered comment'}},version:2,savedAt:'2026-09-08T10:00:00Z'};
test('a reopened draft stays separate until Restore, displays time and does not autosave over it',async()=>{
 const {adapter}=setup(saved);await screen.findByRole('button',{name:'Restore draft'});expect(screen.getByLabelText('Comment')).toHaveValue('');expect(screen.getByText(/A draft is available from/)).toBeVisible();expect(adapter.save).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Restore draft'}));expect(screen.getByLabelText('Comment')).toHaveValue('Recovered comment');
});
test('outdated source requires acknowledgement and incompatible schema permits only discard',async()=>{
 const {unmount}=setup({...saved,values:{...saved.values,context:'old'}});const restore=await screen.findByRole('button',{name:'Restore draft'});expect(restore).toBeDisabled();const review=screen.getByRole('button',{name:'I reviewed the current source'});await waitFor(()=>expect(review).toBeEnabled());fireEvent.click(review);await waitFor(()=>expect(restore).toBeEnabled());unmount();const {adapter}=setup({...saved,values:{...saved.values,schemaVersion:2}});expect(await screen.findByRole('button',{name:'Restore draft'})).toBeDisabled();const discard=screen.getByRole('button',{name:'Discard draft'});await waitFor(()=>expect(discard).toBeEnabled());fireEvent.click(discard);await waitFor(()=>expect(adapter.discard).toHaveBeenCalledWith(scope,2,expect.any(String)));
});
test('failed draft write retains the exact payload and operation identity on retry',async()=>{
 const {adapter}=setup();adapter.save.mockRejectedValueOnce({status:503});await waitFor(()=>expect(adapter.load).toHaveBeenCalledOnce());fireEvent.change(screen.getByLabelText('Comment'),{target:{value:'Keep me'}});await screen.findByRole('alert',{}, {timeout:2500});expect(screen.getByLabelText('Comment')).toHaveValue('Keep me');fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(adapter.save).toHaveBeenCalledTimes(2));expect(adapter.save.mock.calls[0]).toEqual(adapter.save.mock.calls[1]);
});
test('completion waits for in-flight autosave before discarding its acknowledged revision',async()=>{
 const {adapter}=setup();let resolve!:(value:unknown)=>void;adapter.save.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));await waitFor(()=>expect(adapter.load).toHaveBeenCalledOnce());fireEvent.change(screen.getByLabelText('Comment'),{target:{value:'submitted'}});await waitFor(()=>expect(adapter.save).toHaveBeenCalledOnce(),{timeout:2500});fireEvent.click(screen.getByText('Finish'));expect(adapter.discard).not.toHaveBeenCalled();resolve({...saved,version:1});await waitFor(()=>expect(adapter.discard).toHaveBeenCalledWith(scope,1,expect.any(String)));
});
