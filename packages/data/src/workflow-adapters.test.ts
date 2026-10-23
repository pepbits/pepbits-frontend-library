import {test,expect,vi} from 'vitest';
import {createDesignerAdapter} from './dcp-designer';
import {createLabelAdapter} from './label-printing';
import {createIdentityAdapter} from './identity-devices';
import {createIntegrationAdapter} from './device-integrations';
import {WorkflowRequestFailure} from './workflow-failure';
test.each([['labels',createLabelAdapter],['identity',createIdentityAdapter],['devices',createIntegrationAdapter]] as const)('%s adapter preserves explicit endpoint, scope header, operation and structured rejection',async(_name,factory)=>{
 const request=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:'retry'}),{status:503})).mockResolvedValueOnce(new Response(JSON.stringify({id:'ack'})));
 const adapter=factory(request,'application','/host/workflow'),command={action:'preference' as const,stationId:'station',operationId:'operation'};
 await expect(adapter.command(command)).rejects.toBeInstanceOf(WorkflowRequestFailure);await expect(adapter.command(command)).resolves.toEqual({id:'ack'});
 expect(request.mock.calls[0]).toEqual(request.mock.calls[1]);expect(request.mock.calls[0]![0]).toBe('/host/workflow');expect(request.mock.calls[0]![1]).toMatchObject({headers:{'X-Product-Id':'application'},body:JSON.stringify(command)});
});
test('designer adapter checks the host response and keeps field failures',async()=>{
 const request=vi.fn().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(JSON.stringify({fieldErrors:{name:'required'}}),{status:422}));
 const adapter=createDesignerAdapter(request,'application','/host/designer');await expect(adapter.command({action:'load'})).rejects.toMatchObject({status:502});await expect(adapter.command({action:'save'})).rejects.toMatchObject({status:422,fieldErrors:{name:'required'}});
});
