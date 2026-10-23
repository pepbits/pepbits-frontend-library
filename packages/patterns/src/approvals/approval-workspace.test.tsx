import {render} from '../test/render';
import React from 'react';
import {screen,fireEvent,waitFor} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import {ApprovalWorkspace} from './approval-workspace';
import {DraftHost} from '../drafts/draft-host';
import type {ApprovalData} from '@pepbits/data';
const drafts={load:vi.fn().mockResolvedValue({draft:null,draftVersion:0,draftPolicy:{enabled:true,revision:0,retentionDays:7,excludedFields:[]}}),save:vi.fn(),discard:vi.fn().mockResolvedValue(undefined)};
const empty:ApprovalData={config:{version:0,stages:[{name:'Review',roles:['reviewer']}]},canConfigure:false,items:[],notifications:[]};
function setup(data=empty,recordId?:string){const adapter={read:vi.fn().mockResolvedValue(data),change:vi.fn().mockResolvedValue(data)};render(<DraftHost adapter={drafts} identity="tenant:requester" available><ApprovalWorkspace adapter={adapter} productId="test" actorId="requester" roleOptions={["reviewer"]} pageId="item-master" recordId={recordId}/></DraftHost>);return adapter;}
test('submission requires a comment and confirmation; unknown outcomes reuse the operation id',async()=>{
 const adapter=setup(empty,'A');await waitFor(()=>expect(screen.getByLabelText('Approval comment')).toBeEnabled());expect(screen.getByRole('button',{name:'Submit for approval'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Approval comment'),{target:{value:'Please review'}});fireEvent.click(screen.getByRole('button',{name:'Submit for approval'}));expect(adapter.change).not.toHaveBeenCalled();adapter.change.mockRejectedValueOnce(new Error('Connection lost'));
 fireEvent.click(screen.getByRole('button',{name:'Confirm approval action'}));expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the service');fireEvent.click(screen.getByRole('button',{name:'Retry approval action'}));await waitFor(()=>expect(adapter.change).toHaveBeenCalledTimes(2));expect(adapter.change.mock.calls[1]).toEqual(adapter.change.mock.calls[0]);
});
test('bulk selection excludes ineligible rows and preserves per-row errors',async()=>{
 const item={recordId:'A',requesterId:'other',requester:'Other',version:1,status:'pending' as const,stage:0,stages:empty.config.stages,canAct:true,canSubmit:false,history:[]};
 const data={...empty,items:[item,{...item,recordId:'B',canAct:false}]};const adapter=setup(data);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Select eligible rows on this page'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Select eligible rows on this page'}));expect(screen.getByLabelText('Select B')).not.toBeChecked();fireEvent.change(screen.getByLabelText('Bulk decision comment'),{target:{value:'Checked'}});
 adapter.change.mockResolvedValue({...data,results:[{recordId:'A',ok:false,error:'Record changed'}]});fireEvent.click(screen.getByRole('button',{name:'Approve selected'}));fireEvent.click(screen.getByRole('button',{name:'Confirm approval action'}));await waitFor(()=>expect(adapter.change).toHaveBeenCalledOnce());expect(adapter.change.mock.calls[0]![1].items).toEqual([{recordId:'A',version:1}]);expect(await screen.findByText('A: Record changed')).toBeVisible();
});

test('changed saved versions visibly require resubmission and cannot be approved',async()=>{
 setup({...empty,items:[{recordId:'A',requesterId:'other',requester:'Other',version:2,status:'approved',stage:0,stages:empty.config.stages,canAct:false,canSubmit:false,recordChanged:true,history:[]}]},'A');
 expect(await screen.findByText(/Saved record changed/)).toBeVisible();expect(screen.queryByRole('button',{name:'Approve'})).not.toBeInTheDocument();
});

test.each([408,429,503])('HTTP %i retains the comment and retries the identical approval action',async status=>{
 const {ApprovalError}=await import('@pepbits/data');const adapter=setup(empty,'A');await waitFor(()=>expect(screen.getByLabelText('Approval comment')).toBeEnabled());
 fireEvent.change(screen.getByLabelText('Approval comment'),{target:{value:'Keep this comment'}});fireEvent.click(screen.getByRole('button',{name:'Submit for approval'}));adapter.change.mockRejectedValueOnce(new ApprovalError('INTERNAL PRIVATE',status,'trace-approval'));
 fireEvent.click(screen.getByRole('button',{name:'Confirm approval action'}));await screen.findByRole('alert');expect(screen.getByLabelText('Approval comment')).toHaveValue('Keep this comment');expect(screen.getByRole('alert')).not.toHaveTextContent('INTERNAL');
 fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(adapter.change).toHaveBeenCalledTimes(2));expect(adapter.change.mock.calls[1]).toEqual(adapter.change.mock.calls[0]);
});

test('return from a failed inbox delegates to its owning dialog',async()=>{
 const {ApprovalError}=await import('@pepbits/data');const onReturn=vi.fn(),adapter={read:vi.fn().mockRejectedValue(new ApprovalError('PRIVATE',403)),change:vi.fn()};
 render(<DraftHost adapter={drafts} identity="tenant:requester" available><ApprovalWorkspace adapter={adapter} productId="test" actorId="requester" roleOptions={["reviewer"]} pageId="item-master" onReturn={onReturn}/></DraftHost>);
 await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Return to page'}));expect(onReturn).toHaveBeenCalledOnce();expect(adapter.change).not.toHaveBeenCalled();
});
