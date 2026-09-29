import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {ReferenceHostProvider,type ReferenceHost} from '@pepbits/reference-host';
import {DEFAULT_PREFERENCES} from '@pepbits/erp-config';
import {ApiProvider} from '../../lib/api';
import {SessionProvider} from '../../lib/session';
import type {RcmWorkspace} from '../../lib/rcm-contract';
import {HealthcareSuiteRcmWorkspace} from './HealthcareSuiteRcmWorkspace';
import {RCM_SECTIONS} from './definitions';
import {rcmFixture} from './rcm-fixtures.test-helper';

const session={canWrite:true,user:{id:'operator',name:'Fictional Operator',role:'enterprise-admin',email:'fixture@example.test',initials:'FO'},facilities:[{id:'F001',name:'Fictional clinic',status:'Active'}],defaultFacilityId:'F001',currency:'AED',today:'2026-09-29'};
function mount(section:string,workspace=rcmFixture(),post?:(init:RequestInit)=>Response|Promise<Response>,preferences={},sessionOverrides={}){
 let current=workspace;
 const host:ReferenceHost={scope:{moduleId:'reference-healthcare-suite',tenantId:'isolated-fixture',applicationId:'healthcare',branchId:'branch',userId:'operator',roles:['enterprise-admin']},preferences:{...DEFAULT_PREFERENCES,...preferences},navigate:vi.fn(),request:vi.fn(),fetch:vi.fn(async(path:string,init?:RequestInit)=>{
  if(path==='/api/session')return new Response(JSON.stringify({...session,...sessionOverrides}));
  if(path==='/api/rcm/commands')return post?post(init!):new Response(JSON.stringify({version:current.version,result:{},workspace:current}));
  if(path==='/api/rcm/workspace')return new Response(JSON.stringify(current));
  return new Response('{}',{status:404});
 })};
 const mounted=render(<ReferenceHostProvider host={host}><ApiProvider><SessionProvider><HealthcareSuiteRcmWorkspace section={section}/></SessionProvider></ApiProvider></ReferenceHostProvider>);
 return {...mounted,host,replaceWorkspace:(next:RcmWorkspace)=>{current=next;}};
}

test.each(Object.entries(RCM_SECTIONS))('section %s renders its domain actions and server-backed empty lists',async(section,definition)=>{
 mount(section);expect(await screen.findByRole('heading',{level:1,name:definition.title})).toBeInTheDocument();
 expect(screen.getByLabelText('Workflow action')).toHaveValue(definition.actions[0].kind);
 expect(screen.getByRole('button',{name:definition.actions[0].label})).toBeInTheDocument();
 if(section==='drg')expect(screen.getByText(/not certified for reimbursement/)).toBeInTheDocument();
});

test('claims send exact versioned command and idempotency identity, retaining inputs on a recoverable failure',async()=>{
 const posts:RequestInit[]=[];let attempt=0;
 mount('claims',rcmFixture(),init=>{posts.push(init);attempt++;return new Response(JSON.stringify(attempt===1?{message:'Temporary service failure'}:{version:1,workspace:{...rcmFixture(),version:1},result:{id:'CL001'}}),{status:attempt===1?503:200});});
 await screen.findByRole('heading',{level:1});
 fireEvent.change(screen.getByLabelText('Workflow action'),{target:{value:'create-claim'}});
 fireEvent.change(screen.getByLabelText(/Invoice/),{target:{value:'RCM-INV-001'}});fireEvent.change(screen.getByLabelText(/Payer ID/),{target:{value:'PAYER-FOUR'}});
 fireEvent.click(screen.getByRole('button',{name:'Create claim'}));await screen.findByText('Temporary service failure');
 expect(screen.getByLabelText(/Payer ID/)).toHaveValue('PAYER-FOUR');
 fireEvent.click(screen.getByRole('button',{name:'Create claim'}));await screen.findByText('Command completed. The latest workspace is shown.');
 const first=JSON.parse(posts[0].body as string),second=JSON.parse(posts[1].body as string);
 expect(first).toMatchObject({kind:'create-claim',expectedVersion:0,currency:'AED',invoiceId:'RCM-INV-001',payerId:'PAYER-FOUR'});
 expect(first.idempotencyKey).toBe(second.idempotencyKey);expect(new Headers(posts[0].headers).get('Idempotency-Key')).toBe(first.idempotencyKey);
 expect(screen.getByText('Workspace version 1 · Currency AED')).toBeInTheDocument();
});

test('server capability denies commands and controls even when the general suite session allows writes',async()=>{
 const fixture=rcmFixture();fixture.capabilities.claims=false;const {host}=mount('claims',fixture);await screen.findByRole('heading',{level:1});
 fireEvent.change(screen.getByLabelText('Workflow action'),{target:{value:'create-claim'}});
 expect(screen.getByRole('button',{name:'Create claim'})).toBeDisabled();expect(screen.getByLabelText(/Payer ID/)).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Create claim'}));expect((host.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([path])=>path==='/api/rcm/commands')).toHaveLength(0);
});

test('invalid monetary contract fails closed before showing a financial table or command form',async()=>{
 const fixture=rcmFixture();fixture.invoices[0].outstandingMinor='100000';mount('claims',fixture);
 expect(await screen.findByRole('alert')).toHaveTextContent('outstandingMinor');expect(screen.queryByRole('button',{name:'Configure payer sequence'})).not.toBeInTheDocument();expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('version conflicts preserve entered values and require a refreshed workspace before retry',async()=>{
 const {replaceWorkspace}=mount('claims',rcmFixture(),()=>new Response(JSON.stringify({message:'Workspace version conflict'}),{status:409}));await screen.findByRole('heading',{level:1});
 fireEvent.change(screen.getByLabelText('Workflow action'),{target:{value:'create-claim'}});
 fireEvent.change(screen.getByLabelText(/Invoice/),{target:{value:'RCM-INV-001'}});fireEvent.change(screen.getByLabelText(/Payer ID/),{target:{value:'PAYER-A'}});
 fireEvent.click(screen.getByRole('button',{name:'Create claim'}));await screen.findByText(/The workspace changed/);
 expect(screen.getByLabelText(/Payer ID/)).toHaveValue('PAYER-A');expect(screen.getByRole('button',{name:'Create claim'})).toBeDisabled();
 replaceWorkspace({...rcmFixture(),version:2});fireEvent.click(screen.getByRole('button',{name:'Reload latest workspace'}));
 await screen.findByText('Workspace version 2 · Currency AED');expect(screen.getByLabelText(/Payer ID/)).toHaveValue('PAYER-A');await waitFor(()=>expect(screen.getByRole('button',{name:'Create claim'})).not.toBeDisabled());
});

test('effective table preferences and result cards apply to RCM records',async()=>{
 mount('claims',rcmFixture(),undefined,{density:'spacious',zebraStripes:false,wrapCellText:true,stickyTableHeader:false});await screen.findByRole('heading',{level:1});
 const table=screen.getAllByRole('table')[0];expect(table).toHaveAttribute('data-density','spacious');expect(table).toHaveAttribute('data-striped','false');expect(table).toHaveAttribute('data-wrap','true');expect(table).toHaveAttribute('data-sticky','false');
});

test('unknown section avoids an RCM request and exposes a localized empty state',async()=>{
 const {host}=mount('missing');expect(screen.getByText('Unknown RCM workspace')).toBeInTheDocument();await waitFor(()=>expect(host.fetch).toHaveBeenCalled());expect((host.fetch as ReturnType<typeof vi.fn>).mock.calls.some(([path])=>path==='/api/rcm/workspace')).toBe(false);
});

test('maker-checker approval prevents approving the current actor proposal',async()=>{
 const fixture=rcmFixture();fixture.pricingVersions=[{id:'PRV-001',priceId:'SVC',unitPriceMinor:1000,taxBasisPoints:500,status:'Proposed',version:1,makerId:'operator'}];
 mount('commercial',fixture);await screen.findByRole('heading',{level:1});fireEvent.change(screen.getByLabelText('Workflow action'),{target:{value:'approve-pricing'}});
 fireEvent.change(screen.getByLabelText(/Pricing revision/),{target:{value:'PRV-001'}});
 expect(screen.getByRole('button',{name:'Approve pricing revision'})).toBeDisabled();expect(screen.getByText('A different authorized checker must approve your proposal.')).toBeInTheDocument();
});

test('a profile without server provider configuration disables dispatch with a recovery explanation',async()=>{
 const fixture=rcmFixture();fixture.exchangeProfiles=[{id:'PROFILE',payerId:'PY001',wireFormat:'REST_JSON',providerConfigured:false}];fixture.exchanges=[{id:'EXC',profileId:'PROFILE',status:'Queued'}];
 mount('exchange',fixture);await screen.findByRole('heading',{level:1});fireEvent.change(screen.getByLabelText('Workflow action'),{target:{value:'dispatch-exchange'}});
 fireEvent.change(screen.getByLabelText(/Queued exchange/),{target:{value:'EXC'}});
 expect(screen.getByRole('button',{name:'Dispatch exchange'})).toBeDisabled();expect(screen.getByText('Configure the provider on the server before submitting or dispatching exchange requests.')).toBeInTheDocument();
});

test('business conflicts retain the domain explanation and values without claiming a workspace version conflict',async()=>{
 mount('claims',rcmFixture(),()=>new Response(JSON.stringify({message:'Resolve the current payer before forwarding the balance.'}),{status:409}));await screen.findByRole('heading',{level:1});
 fireEvent.change(screen.getByLabelText('Workflow action'),{target:{value:'create-claim'}});fireEvent.change(screen.getByLabelText(/Invoice/),{target:{value:'RCM-INV-001'}});fireEvent.change(screen.getByLabelText(/Payer ID/),{target:{value:'PY002'}});
 fireEvent.click(screen.getByRole('button',{name:'Create claim'}));await screen.findByText('Resolve the current payer before forwarding the balance.');
 expect(screen.getByLabelText(/Payer ID/)).toHaveValue('PY002');expect(screen.queryByRole('button',{name:'Reload latest workspace'})).not.toBeInTheDocument();
});

test('finance RCM permission permits a deposit command when the clinical suite is read-only',async()=>{
 const posts:RequestInit[]=[];mount('patient-finance',rcmFixture(),init=>{posts.push(init);return new Response(JSON.stringify({version:1,workspace:{...rcmFixture(),version:1},result:{id:'D001',amountMinor:1005}}));},{},{canWrite:false,canWriteRcm:true});
 await screen.findByRole('heading',{level:1});fireEvent.change(screen.getByLabelText(/Patient ID/),{target:{value:'PT00001'}});fireEvent.change(screen.getByLabelText(/^Amount/),{target:{value:'10.05'}});fireEvent.change(screen.getByLabelText(/Payment reference/),{target:{value:'FINANCE-RECEIPT'}});
 fireEvent.click(screen.getByRole('button',{name:'Record deposit'}));await screen.findByText('Command completed. The latest workspace is shown.');
 expect(JSON.parse(posts[0].body as string)).toMatchObject({kind:'record-deposit',patientId:'PT00001',amountMinor:1005});
});

test('provider payment actions are disabled until the backend reports money provider configuration',async()=>{
 mount('patient-finance');await screen.findByRole('heading',{level:1});fireEvent.change(screen.getByLabelText('Workflow action'),{target:{value:'capture-deposit'}});
 expect(screen.getByRole('button',{name:'Capture provider deposit'})).toBeDisabled();expect(screen.getByText('Configure the money provider on the server before this action.')).toBeInTheDocument();
});

test('tenant payer inheritance has a distinct workflow identity and sends no fabricated payer sequence',async()=>{
 const posts:RequestInit[]=[];mount('claims',rcmFixture(),init=>{posts.push(init);return new Response(JSON.stringify({version:1,workspace:{...rcmFixture(),version:1},result:{id:'POLICY-INHERITED'}}));});await screen.findByRole('heading',{level:1});
 fireEvent.change(screen.getByLabelText('Workflow action'),{target:{value:'inherit-payer-policy'}});fireEvent.change(screen.getByLabelText(/Effective from/),{target:{value:'2026-09-29'}});fireEvent.click(screen.getByRole('button',{name:'Inherit tenant payer defaults'}));
 await screen.findByText('Command completed. The latest workspace is shown.');const body=JSON.parse(posts[0].body as string);expect(body).toMatchObject({kind:'configure-payer-policy',level:'branch',inherit:true,effectiveFrom:'2026-09-29'});expect(body).not.toHaveProperty('payerIds');expect(body).not.toHaveProperty('maximumPayers');
});

test('a configured MockIns profile permits AED eligibility requests without an unsupported-currency warning',async()=>{
 const fixture=rcmFixture();fixture.exchangeProfiles=[{id:'AED-PROFILE',payerId:'PY001',wireFormat:'REST_JSON',providerConfigured:true,maximumPayerLevel:4}];const posts:RequestInit[]=[];
 mount('exchange',fixture,init=>{posts.push(init);return new Response(JSON.stringify({version:1,workspace:{...fixture,version:1},result:{id:'AED-EXCHANGE',status:'Queued'}}));});
 await screen.findByRole('heading',{level:1});fireEvent.change(screen.getByLabelText('Workflow action'),{target:{value:'queue-exchange'}});fireEvent.change(screen.getByLabelText(/Exchange profile/),{target:{value:'AED-PROFILE'}});fireEvent.change(screen.getByLabelText(/Exchange operation/),{target:{value:'ELIGIBILITY'}});
 expect(screen.getByRole('button',{name:'Queue exchange'})).not.toBeDisabled();expect(screen.queryByText(/MockIns exchange supports/)).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Queue exchange'}));await screen.findByText('Command completed. The latest workspace is shown.');expect(JSON.parse(posts[0].body as string)).toMatchObject({currency:'AED',kind:'queue-exchange',operation:'ELIGIBILITY'});
});

test('a pending provider refund cannot cancel its reserved funds',async()=>{
 const fixture=rcmFixture();fixture.refunds=[{id:'PENDING-REFUND',amountMinor:1000,status:'Pending',providerRef:'PROVIDER-REFUND'}];mount('patient-finance',fixture);await screen.findByRole('heading',{level:1});fireEvent.change(screen.getByLabelText('Workflow action'),{target:{value:'cancel-refund'}});fireEvent.change(screen.getByLabelText(/Refund/),{target:{value:'PENDING-REFUND'}});
 expect(screen.getByRole('button',{name:'Cancel refund reservation'})).toBeDisabled();expect(screen.getByText('A submitted or completed refund cannot release reserved funds. Reconcile the provider first.')).toBeInTheDocument();
});

test('replacement freezes a settled claim revision through the stable versioned command',async()=>{
 const fixture=rcmFixture(),claim={id:'CLAIM-REVISION',invoiceId:'RCM-INV-001',payerId:'PY001',sequenceIndex:0,status:'Settled',chargeMinor:80000,paidMinor:10000,adjustmentMinor:5000,deniedMinor:65000,version:1};fixture.claims=[claim];const posts:RequestInit[]=[];
 mount('claims',fixture,init=>{posts.push(init);const result={...claim,status:'Appealed',version:2,revisions:[{version:1,chargeMinor:80000,paidMinor:10000,adjustmentMinor:5000,deniedMinor:65000}]};return new Response(JSON.stringify({version:1,workspace:{...fixture,version:1,claims:[result]},result}));});
 await screen.findByRole('heading',{level:1});fireEvent.change(screen.getByLabelText('Workflow action'),{target:{value:'replace-claim'}});fireEvent.change(screen.getByLabelText(/Claim/),{target:{value:'CLAIM-REVISION'}});fireEvent.change(screen.getByLabelText(/Reason/),{target:{value:'Synthetic replacement correction'}});fireEvent.click(screen.getByRole('button',{name:'Replace claim revision'}));await screen.findByText('Command completed. The latest workspace is shown.');
 expect(JSON.parse(posts[0].body as string)).toMatchObject({kind:'replace-claim',claimId:'CLAIM-REVISION',reason:'Synthetic replacement correction',expectedVersion:0});
});

test('replacement is disabled when a later payer already owns the coordinated balance',async()=>{
 const fixture=rcmFixture();fixture.claims=[{id:'PRIOR',invoiceId:'RCM-INV-001',sequenceIndex:0,status:'Settled',chargeMinor:80000,paidMinor:10000,adjustmentMinor:5000,deniedMinor:65000},{id:'LATER',invoiceId:'RCM-INV-001',sequenceIndex:1,status:'Draft',chargeMinor:65000,paidMinor:0,adjustmentMinor:0,deniedMinor:0}];mount('claims',fixture);await screen.findByRole('heading',{level:1});fireEvent.change(screen.getByLabelText('Workflow action'),{target:{value:'replace-claim'}});fireEvent.change(screen.getByLabelText(/Claim/),{target:{value:'PRIOR'}});
 expect(screen.getByRole('button',{name:'Replace claim revision'})).toBeDisabled();expect(screen.getByText('Resolve the current submission and any later payer before replacing a claim with remaining payer liability.')).toBeInTheDocument();
});

test('an unsent queued exchange can be cancelled without provider credentials',async()=>{
 const fixture=rcmFixture();fixture.exchanges=[{id:'UNSENT',status:'Queued',attempts:0}];const posts:RequestInit[]=[];mount('exchange',fixture,init=>{posts.push(init);return new Response(JSON.stringify({version:1,workspace:{...fixture,version:1,exchanges:[{id:'UNSENT',status:'Cancelled',attempts:0}]},result:{id:'UNSENT',status:'Cancelled'}}));});
 await screen.findByRole('heading',{level:1});fireEvent.change(screen.getByLabelText('Workflow action'),{target:{value:'cancel-exchange'}});fireEvent.change(screen.getByLabelText(/Queued exchange/),{target:{value:'UNSENT'}});fireEvent.change(screen.getByLabelText(/Reason/),{target:{value:'Synthetic queue correction'}});fireEvent.click(screen.getByRole('button',{name:'Cancel unsent exchange'}));await screen.findByText('Command completed. The latest workspace is shown.');expect(JSON.parse(posts[0].body as string)).toMatchObject({kind:'cancel-exchange',exchangeId:'UNSENT',reason:'Synthetic queue correction'});
});

test('an uncertain exchange cannot be cancelled after a dispatch attempt',async()=>{
 const fixture=rcmFixture();fixture.exchanges=[{id:'UNCERTAIN',status:'Uncertain',attempts:1}];mount('exchange',fixture);await screen.findByRole('heading',{level:1});fireEvent.change(screen.getByLabelText('Workflow action'),{target:{value:'cancel-exchange'}});fireEvent.change(screen.getByLabelText(/Queued exchange/),{target:{value:'UNCERTAIN'}});
 expect(screen.getByRole('button',{name:'Cancel unsent exchange'})).toBeDisabled();expect(screen.getByText('Only an unsent queued exchange can be cancelled. Reconcile uncertain provider outcomes.')).toBeInTheDocument();
});
