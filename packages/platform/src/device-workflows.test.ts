import {test,expect,vi} from 'vitest';
import {createDeviceConnector,createIdentityDeviceConnector} from './devices';
import {withDeviceConnector,withIdentityConnector} from './device-workflows';
import type {IntegrationAdapter,IntegrationJob} from '@pepbits/data/device-integrations';
import type {IdentityAdapter,IdentityAttempt} from '@pepbits/data/identity-devices';
test('identity port rejects expired tickets and mismatched captures, and strips unrelated data',async()=>{
 const call=vi.fn().mockResolvedValue({challengeId:'other',status:'captured',assertionReference:'ref'}),port=createIdentityDeviceConnector(call);
 const ticket={challengeId:'challenge',subjectReference:'subject',deviceId:'reader',method:'card' as const,expiresAt:'2099-01-01'};
 await expect(port.capture({...ticket,expiresAt:'2000-01-01'})).rejects.toThrow();expect(call).not.toHaveBeenCalled();
 await expect(port.capture(ticket)).rejects.toThrow('Invalid identity capture result');
 call.mockResolvedValue({challengeId:'challenge',status:'captured',assertionReference:'ref',raw:'excluded'});
 expect(await port.capture(ticket)).toEqual({challengeId:'challenge',status:'captured',assertionReference:'ref'});
});
test('device bridge preserves operation identity across an uncertain dispatch and records only validated acknowledgements',async()=>{
 const job={id:'job',deviceId:'printer'} as IntegrationJob,command=vi.fn().mockResolvedValue(job),call=vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue({jobId:'job',state:'accepted'}),acknowledge=vi.fn(async()=>({...job,status:'accepted' as const}));
 const adapter=withDeviceConnector({library:vi.fn(),command} as IntegrationAdapter,{connector:createDeviceConnector(call),ticket:async()=>({jobId:'job',deviceId:'printer',contentReference:'opaque',expiresAt:'2099-01-01'}),acknowledge});
 const input={action:'dispatch' as const,stationId:'station',jobId:'job',operationId:'operation'};
 await expect(adapter.command(input)).rejects.toThrow('offline');expect(acknowledge).not.toHaveBeenCalled();
 await expect(adapter.command(input)).resolves.toMatchObject({status:'accepted'});expect(command.mock.calls.map(c=>c[0])).toEqual([input,input]);expect(acknowledge).toHaveBeenCalledWith(job,{jobId:'job',state:'accepted'},input);
});
test('bridges reject a ticket for another job or subject before invoking any port',async()=>{
 const submit=vi.fn(),capture=vi.fn();
 const devices=withDeviceConnector({library:vi.fn(),command:vi.fn().mockResolvedValue({id:'job',deviceId:'printer'})},{connector:{submit,status:vi.fn()},ticket:async()=>({jobId:'other',deviceId:'printer',contentReference:'ref',expiresAt:'2099-01-01'}),acknowledge:vi.fn()});
 await expect(devices.command({action:'dispatch',stationId:'station'})).rejects.toThrow('does not match');expect(submit).not.toHaveBeenCalled();
 const identity=withIdentityConnector({library:vi.fn(),command:vi.fn().mockResolvedValue({id:'challenge',subjectId:'subject',deviceId:'reader'})},{connector:{capture},ticket:async()=>({challengeId:'challenge',subjectReference:'other',deviceId:'reader',method:'card',expiresAt:'2099-01-01'}),verify:vi.fn()});
 await expect(identity.command({action:'start',stationId:'station'})).rejects.toThrow('does not match');expect(capture).not.toHaveBeenCalled();
});
test('identity verification stays with the backend and browser jobs bypass native ports',async()=>{
 const attempt={id:'challenge',subjectId:'subject',deviceId:'reader',authenticated:false} as IdentityAttempt,verify=vi.fn(async()=>attempt);
 const adapter=withIdentityConnector({library:vi.fn(),command:vi.fn().mockResolvedValue(attempt)} as IdentityAdapter,{connector:createIdentityDeviceConnector(async()=>({challengeId:'challenge',status:'captured',assertionReference:'opaque'})),ticket:async()=>({challengeId:'challenge',subjectReference:'subject',deviceId:'reader',method:'card',expiresAt:'2099-01-01'}),verify});
 expect(await adapter.command({action:'start',stationId:'station'})).toEqual(attempt);expect(verify).toHaveBeenCalledWith(attempt,{challengeId:'challenge',status:'captured',assertionReference:'opaque'},expect.anything());
 const submit=vi.fn(),job={id:'browser',status:'print-requested'};const browser=withDeviceConnector({library:vi.fn(),command:vi.fn().mockResolvedValue(job)},{connector:{submit,status:vi.fn()},ticket:async()=>null,acknowledge:vi.fn()});expect(await browser.command({action:'dispatch',stationId:'station'})).toEqual(job);expect(submit).not.toHaveBeenCalled();
});
