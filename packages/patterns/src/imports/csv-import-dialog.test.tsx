import {render} from '../test/render';
import React from 'react';
import {screen,fireEvent,waitFor} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
const page={id:"item-master",title:"Items"};
const definition={id:"item",label:"Items",uniqueField:"itemCode",schema:{sections:[{fields:[{id:"itemCode",label:"Item code",required:true},{id:"email",label:"Email"}]}]}};
import type {ImportJob} from '@pepbits/data';
import {DraftHost} from '../drafts/draft-host';
import {CsvImportDialog} from './csv-import-dialog';
const drafts={load:vi.fn().mockResolvedValue({draft:null,draftVersion:0,draftPolicy:{enabled:true,revision:0,retentionDays:7,excludedFields:[]}}),save:vi.fn(),discard:vi.fn().mockResolvedValue(undefined)};
const pending:ImportJob={id:'job',productId:'test',pageId:'item-master',confirmed:false,createdAt:new Date().toISOString(),rows:[{row:1,values:{itemCode:'NEW'},errors:{},status:'pending'},{row:2,values:{itemCode:'BAD'},errors:{email:'Invalid email'},status:'invalid'}]};
function setup(job:ImportJob){const adapter={latest:vi.fn().mockResolvedValue(job),preview:vi.fn(),run:vi.fn()};const onImported=vi.fn();render(<DraftHost adapter={drafts} identity="tenant:user" available><CsvImportDialog open onClose={vi.fn()} page={page} definition={definition} adapter={adapter} productId="test" onImported={onImported}/></DraftHost>);return {adapter,onImported};}
test('restored validation requires explicit confirmation before writing',async()=>{
 const {adapter,onImported}=setup(pending);adapter.run.mockResolvedValue({...pending,confirmed:true,rows:pending.rows.map(row=>row.status==='pending'?{...row,status:'success'}:row)});
 fireEvent.click(await screen.findByRole('button',{name:'Import valid rows: 1'}));expect(adapter.run).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Confirm import'}));await waitFor(()=>expect(onImported).toHaveBeenCalledOnce());expect(adapter.run).toHaveBeenCalledWith('job',false);expect(screen.getByText(/Imported: 1 · Invalid: 1/)).toBeVisible();
});
test('retry preserves completed rows and retries failed writes once',async()=>{
 const job:ImportJob={...pending,confirmed:true,rows:[{...pending.rows[0]!,status:'success'},{...pending.rows[1]!,status:'failed',retryable:true}]};
 const {adapter}=setup(job);adapter.run.mockResolvedValue({...job,rows:job.rows.map(row=>({...row,status:'success',errors:{}}))});
 fireEvent.click(await screen.findByRole('button',{name:'Retry failed rows'}));await waitFor(()=>expect(adapter.run).toHaveBeenCalledOnce());expect(adapter.run).toHaveBeenCalledWith('job',true);expect(screen.getByText(/Imported: 2/)).toBeVisible();
});
test('an interrupted request retains the job for safe resume',async()=>{
 const {adapter}=setup({...pending,confirmed:true});adapter.run.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValue({...pending,confirmed:true,rows:pending.rows.map(row=>row.status==='pending'?{...row,status:'success'}:row)});
 fireEvent.click(await screen.findByRole('button',{name:'Resume import'}));expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the service');fireEvent.click(screen.getByRole('button',{name:'Resume import'}));await waitFor(()=>expect(adapter.run).toHaveBeenCalledTimes(2));expect(adapter.run.mock.calls[0]).toEqual(adapter.run.mock.calls[1]);
});

test.each([408,429,503])('HTTP %i retains import rows and the job identity',async status=>{
 const {ImportRequestError}=await import('@pepbits/data');const {adapter}=setup({...pending,confirmed:true});adapter.run.mockRejectedValueOnce(new ImportRequestError('PRIVATE',status,'trace-import')).mockResolvedValue({...pending,confirmed:true,rows:pending.rows.map(row=>({...row,status:'success'}))});
 fireEvent.click(await screen.findByRole('button',{name:'Resume import'}));await screen.findByRole('alert');expect(screen.getByText('NEW')).toBeVisible();expect(screen.getByRole('alert')).not.toHaveTextContent('PRIVATE');fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(adapter.run).toHaveBeenCalledTimes(2));expect(adapter.run.mock.calls[1]).toEqual(adapter.run.mock.calls[0]);
});
