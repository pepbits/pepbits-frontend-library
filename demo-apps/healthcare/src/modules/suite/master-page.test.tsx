import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {HealthcareProviders} from '../../providers';
import {HealthcarePage} from '../../renderer';
import {fixtureSession} from '../../test/session';
import {mockHttp} from '../../test/mock-http';
import {hrefFor} from '../../navigation';
import type {Request} from '../../adapters/http';
test('configured master creation preserves fields on failure and navigates only after API acknowledgement',async()=>{
 const mock=mockHttp(),open=vi.fn(),writes:Record<string,unknown>[]=[];let failing=true;
 const request:Request=async(path,init)=>{if(path==='/reference-modules/healthcare-suite/api/masters/facilities'&&init?.method==='POST'){const body=JSON.parse(String(init.body));writes.push(body);return failing?Response.json({message:'Fictional service unavailable'},{status:503}):Response.json({...body,id:'F-DEMO'});}return mock.request(path,init);};
 const target={pageId:'suite-master-facilities',mode:'new' as const};
 render(<HealthcareProviders apiBaseUrl="/api" request={request} session={fixtureSession} navigation={{current:target,hrefFor,open,openInNewContext:vi.fn()}}><HealthcarePage target={target}/></HealthcareProviders>);
 const name=await screen.findByRole('textbox',{name:/^Name/});fireEvent.change(name,{target:{value:'Fictional clinic'}});
 fireEvent.change(screen.getByRole('textbox',{name:/^Code/}),{target:{value:'demo'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));
 await waitFor(()=>expect(writes).toHaveLength(1));await screen.findByRole('button',{name:/Retry/});expect(name).toHaveValue('Fictional clinic');expect(writes[0]?.code).toBe('DEMO');expect(open).not.toHaveBeenCalled();
 failing=false;fireEvent.click(screen.getByRole('button',{name:/Retry/}));await waitFor(()=>expect(open).toHaveBeenCalledWith(expect.objectContaining({pageId:target.pageId,recordId:'F-DEMO'})));expect(writes[1]).toEqual(writes[0]);expect(mock.unexpected).toEqual([]);
});
