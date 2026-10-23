import React from 'react';
import {screen,fireEvent,waitFor} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import {RecordPanelsPanel} from './record-panels';
import {render,TestHost} from '../test/render';
import {RecordAdapterProvider} from './use-record-editor';
import {createMemoryRecordAdapter} from '@pepbits/data';
const recordHost={adapter:createMemoryRecordAdapter(),identity:'tenant:user',applicationId:'app',sessionAvailable:true};
import {RecordPanelsError,type RecordPanelsAdapter} from '@pepbits/data';
const empty={attachments:[],comments:[],related:[],activity:[]};
const make=()=>({load:vi.fn().mockResolvedValue(empty),change:vi.fn().mockResolvedValue(empty),download:vi.fn()});
const tree=(adapter:RecordPanelsAdapter,id?:string)=><TestHost screenHost={{can:()=>true}}><RecordAdapterProvider value={recordHost}><RecordPanelsPanel adapter={adapter} actorId="user" pages={[{id:"item-master",title:"Items"}]} pageId="item-master" recordId={id} /></RecordAdapterProvider></TestHost>;
test('unsaved records cannot send panel requests',()=>{
 const adapter=make();render(tree(adapter));expect(screen.getByText(/Save the record to add/)).toBeVisible();expect(adapter.load).not.toHaveBeenCalled();
});
test('unknown save outcomes preserve the comment and reuse the operation id on retry',async()=>{
 const adapter=make();adapter.change.mockRejectedValueOnce(new Error('Connection lost'));
 render(tree(adapter,'A'));await waitFor(()=>expect(screen.getByLabelText('Add attachment (maximum 2 MB)')).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Comments'}));fireEvent.change(screen.getByLabelText('New comment'),{target:{value:'Keep this comment'}});fireEvent.click(screen.getByRole('button',{name:'Post comment'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');expect(screen.getByLabelText('New comment')).toHaveValue('Keep this comment');
 fireEvent.click(screen.getByRole('button',{name:'Retry change'}));await waitFor(()=>expect(adapter.change).toHaveBeenCalledTimes(2));
 expect(adapter.change.mock.calls[1]).toEqual(adapter.change.mock.calls[0]);await waitFor(()=>expect(screen.getByLabelText('New comment')).toHaveValue(''));
});
test('definitive validation errors allow correction',async()=>{
 const adapter=make();adapter.change.mockRejectedValueOnce(new RecordPanelsError('Choose an existing record',404));
 render(tree(adapter,'A'));await waitFor(()=>expect(screen.getByLabelText('Add attachment (maximum 2 MB)')).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Comments'}));
 fireEvent.change(screen.getByLabelText('New comment'),{target:{value:'Correct me'}});fireEvent.click(screen.getByRole('button',{name:'Post comment'}));expect(await screen.findByRole('alert')).toHaveTextContent('Choose an existing record');expect(screen.getByLabelText('New comment')).toBeEnabled();
});
test('switching records discards stale load results',async()=>{
 const adapter=make();let complete:(value:unknown)=>void=()=>{};adapter.load.mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
 const {rerender}=render(tree(adapter,'A'));rerender(tree(adapter,'B'));await waitFor(()=>expect(screen.getByText('No attachments yet.')).toBeVisible());
 complete({...empty,attachments:[{id:'old',name:'Wrong record',size:1,author:'Old',authorId:'old',createdAt:new Date().toISOString()}]});
 await waitFor(()=>expect(adapter.load).toHaveBeenCalledTimes(2));expect(screen.queryByText(/Wrong record/)).not.toBeInTheDocument();
});
