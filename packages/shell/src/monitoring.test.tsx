import React from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {reportSentinelFailure,reportOperationFailure} from '@pepbits/platform';
import {ShellTestHost,session} from './test/host';
import {SentinelBridge} from './sentinel';
import {ErrorMonitor} from './error-monitor';
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
const diagnostic={kind:'runtime' as const,code:'runtime-error',pageId:'items',release:'2026-10-23-example',platform:'web' as const,breadcrumbs:['items']};
const incident={id:'reference-a',status:'new',revision:1,firstSeen:'2026-10-23T10:00:00Z',lastSeen:'2026-10-23T10:00:00Z',occurrences:2,diagnostic};
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
test('the bridge sends only sanitized diagnostics through the injected transport',async()=>{
  vi.useFakeTimers();const request=vi.fn().mockResolvedValue(response({})),monitoring={request,releaseId:'2026-10-23-example'};
  const view=render(<ShellTestHost monitoring={monitoring}><SentinelBridge/></ShellTestHost>);
  act(()=>{reportSentinelFailure({kind:'render',code:'render-error',message:'PRIVATE VALUE'} as never);reportOperationFailure();});
  await act(async()=>{vi.advanceTimersByTime(5000);});expect(request).toHaveBeenCalledOnce();
  const [path,init]=request.mock.calls[0]!;expect(path).toBe('/monitoring/events');expect(init.headers['X-Product-Id']).toBe('example');
  const body=JSON.parse(init.body);expect(body.events).toHaveLength(2);expect(body.events[0]).toMatchObject({pageId:'items',release:'2026-10-23-example',code:'render-error',platform:'web'});expect(init.body).not.toContain('PRIVATE');
  view.unmount();act(()=>reportOperationFailure());await act(async()=>{vi.advanceTimersByTime(10000);});expect(request).toHaveBeenCalledOnce();
});
test('bridge stops delivery after an authorization rejection',async()=>{
  vi.useFakeTimers();const request=vi.fn().mockResolvedValue(response({},403));render(<ShellTestHost monitoring={{request,releaseId:'2026-10-23-example'}}><SentinelBridge/></ShellTestHost>);
  act(()=>reportOperationFailure());await act(async()=>{vi.advanceTimersByTime(5000);});act(()=>reportOperationFailure());await act(async()=>{vi.advanceTimersByTime(10000);});expect(request).toHaveBeenCalledOnce();
});
test('no monitoring host means no capture or network and no monitor UI',()=>{
  const fetch=vi.spyOn(globalThis,'fetch');const view=render(<ShellTestHost><SentinelBridge/><ErrorMonitor/></ShellTestHost>);act(()=>reportOperationFailure());expect(fetch).not.toHaveBeenCalled();expect(view.container.querySelector('[data-error-monitor]')).toBeNull();
});
test('monitor uses injected service, effective presentation/formatting and revision conflicts',async()=>{
  const request=vi.fn(async(path:string,init?:RequestInit)=>init?.method==='PATCH'?response({},409):path.includes('/reference-a')?response({incident,history:[{actor:'Editor',status:'new',at:incident.firstSeen}]}):response({incidents:[incident],nextOffset:null}));
  render(<ShellTestHost monitoring={{request,releaseId:'2026-10-23-example'}} settings={{preferences:{density:'compact',dateFormat:'iso',timeFormat:'24h'}}}><ErrorMonitor/></ShellTestHost>);
  fireEvent.click(await screen.findByRole('button',{name:'View details'}));expect(await screen.findByText('reference-a')).toBeVisible();
  expect(screen.getByRole('table')).toHaveAttribute('data-density','compact');expect(screen.getAllByText(/2026-10-23/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button',{name:'sentinel.status.investigating'}));expect(await screen.findByRole('alert')).toHaveTextContent('Reload before saving');
  expect(request).toHaveBeenCalledWith('/monitoring/incidents/reference-a',expect.objectContaining({method:'PATCH',body:JSON.stringify({status:'investigating',revision:1})}));
});
test('monitor exposes permission errors without diagnostic response content',async()=>{
  const request=vi.fn().mockResolvedValue(response({error:'PRIVATE'},403));render(<ShellTestHost monitoring={{request,releaseId:'2026-10-23-example'}}><ErrorMonitor/></ShellTestHost>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Monitoring administrator permission is required.');expect(screen.queryByText('PRIVATE')).toBeNull();
});
test('late incident results cannot populate a changed session',async()=>{
  let settle!:(response:Response)=>void;const request=vi.fn(()=>new Promise<Response>(resolve=>{settle=resolve;}));const monitoring={request,releaseId:'2026-10-23-example'};
  const view=render(<ShellTestHost monitoring={monitoring}><ErrorMonitor/></ShellTestHost>);
  view.rerender(<ShellTestHost monitoring={monitoring} session={{...session,status:'anonymous',user:null}}><ErrorMonitor/></ShellTestHost>);
  await act(async()=>{settle(response({incidents:[incident],nextOffset:null}));});expect(screen.queryByRole('button',{name:'View details'})).toBeNull();
});
