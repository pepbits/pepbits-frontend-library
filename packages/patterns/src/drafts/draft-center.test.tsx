import {render} from '../test/render';
import React from 'react';
import {screen,fireEvent,waitFor,within} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import {DraftRecoveryCenter} from './draft-center';
import {DraftHost} from '../drafts/draft-host';
const navigate=vi.fn();
import {NavigationProvider} from '@pepbits/platform/navigation';
const drafts={load:vi.fn(),save:vi.fn(),discard:vi.fn()};
const application={id:'app',name:'Application',pages:{items:{id:'items',title:'Items'}}};
const item={id:'a'.repeat(64),productId:'app',kind:'form' as const,version:1,savedAt:'2026-09-08T12:00:00Z',expiresAt:'2026-09-15T12:00:00Z',status:'ready' as const,pageId:'items',recordId:'A'};
function setup(items:any[]=[item]){const data={items,total:items.length,offset:0,policy:{revision:0,enabled:true,retentionDays:7,excludedFields:[]},counts:{all:items.length,outdated:0,unavailable:0},serverTime:'2026-09-08T12:00:00Z'};const adapter={list:vi.fn().mockResolvedValue(data),open:vi.fn().mockResolvedValue(item),discard:vi.fn().mockResolvedValue(undefined)};render(<DraftHost adapter={drafts} identity="tenant:one" available><NavigationProvider value={{open:navigate,current:{pageId:"drafts"},hrefFor:()=>"#",openInNewContext:navigate}}><DraftRecoveryCenter application={application} adapter={adapter}/></NavigationProvider></DraftHost>);return adapter;}
test('metadata and policy appear, search/filter use the API and open rechecks access',async()=>{
 const adapter=setup();await screen.findByText('A');expect(screen.getByText(/Retention: 7 days/)).toBeVisible();fireEvent.change(screen.getByLabelText('Search by page or record ID'),{target:{value:'A'}});fireEvent.change(screen.getByLabelText('Draft type'),{target:{value:'form'}});await waitFor(()=>expect(adapter.list).toHaveBeenLastCalledWith('app',expect.objectContaining({query:'A',kind:'form'})));fireEvent.click(screen.getByRole('button',{name:'Open draft'}));await waitFor(()=>expect(navigate).toHaveBeenCalledWith({pageId:'items',mode:'edit',recordId:'A'}));expect(adapter.open).toHaveBeenCalledWith('app',item);
});
test('inaccessible rows hide details, disable open, and retain discard',async()=>{
 setup([{...item,pageId:null,recordId:null,status:'unavailable'}]);await screen.findByText('Record details hidden because access is unavailable');expect(screen.getByRole('button',{name:'Open draft'})).toBeDisabled();expect(screen.getByRole('button',{name:'Discard draft'})).toBeEnabled();
});
test('discard retry retains its operation id and does not remove a row until confirmed',async()=>{
 const adapter=setup();adapter.discard.mockRejectedValueOnce({status:503});await screen.findByText('A');fireEvent.click(screen.getByRole('button',{name:'Discard draft'}));await screen.findByRole('alert');expect(screen.getByText('A')).toBeVisible();adapter.list.mockResolvedValue({items:[],total:0,offset:0,policy:{enabled:true,retentionDays:7,excludedFields:[]},counts:{all:0,outdated:0,unavailable:0}} as any);fireEvent.click(screen.getByRole('button',{name:'Retry'}));await screen.findByText('No saved drafts match these filters.');expect(adapter.discard.mock.calls[0]).toEqual(adapter.discard.mock.calls[1]);
});
