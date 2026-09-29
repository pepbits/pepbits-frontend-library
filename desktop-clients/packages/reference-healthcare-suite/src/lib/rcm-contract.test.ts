import {parseRcmWorkspace,parseRcmCommandResponse,RCM_COLLECTIONS} from './rcm-contract';
import {buildRcmPayload,majorToMinor,RCM_SECTIONS} from '../components/rcm/definitions';
import {rcmFixture} from '../components/rcm/rcm-fixtures.test-helper';

test('workspace parser requires every collection and an explicit boolean capability',()=>{
 expect(parseRcmWorkspace(rcmFixture()).version).toBe(0);
 for(const collection of RCM_COLLECTIONS){const broken:Record<string,unknown>={...rcmFixture()};delete broken[collection];expect(()=>parseRcmWorkspace(broken)).toThrow(collection);}
 const broken=rcmFixture();(broken.capabilities as unknown as Record<string,unknown>).finance='true';expect(()=>parseRcmWorkspace(broken)).toThrow('capabilities.finance');
});
test('money parser rejects absent, null, strings, fractional, negative and unsafe amounts without defaulting to zero',()=>{
 for(const value of [undefined,null,'100',100.5,-1,Number.MAX_SAFE_INTEGER+1,NaN,Infinity]){
  const broken=rcmFixture();broken.invoices[0].outstandingMinor=value;expect(()=>parseRcmWorkspace(broken)).toThrow('outstandingMinor');
 }
 const nested=rcmFixture();nested.exchanges=[{id:'X001',response:{amountMinor:'3'}}];expect(()=>parseRcmWorkspace(nested)).toThrow('amountMinor');
});
test('workspace parser validates exact journal balance and permits signed trial account balances',()=>{
 const fixture=rcmFixture();fixture.journal=[{id:'J001',event:'Invoice',entries:[{account:'Receivable',debitMinor:100000,creditMinor:0},{account:'Revenue',debitMinor:0,creditMinor:100000}]}];
 fixture.reports.trialBalance=[{account:'Revenue',debitMinor:0,creditMinor:100000,balanceMinor:-100000}];expect(parseRcmWorkspace(fixture).journal).toHaveLength(1);
 fixture.journal[0].entries[1].creditMinor=99999;expect(()=>parseRcmWorkspace(fixture)).toThrow('entries.balance');
});
test('decimal amount conversion is exact and never silently rounds sub-cent or scientific amounts',()=>{
 expect(majorToMinor('1234.56')).toBe(123456);expect(majorToMinor('0.10')).toBe(10);expect(majorToMinor('12')).toBe(1200);
 for(const value of ['1.001','-1','1e2','Infinity','','12,34','90071992547409.92'])expect(()=>majorToMinor(value)).toThrow();
});
test('payer sequence preserves fourth and later payer positions and rejects duplicate or empty payers',()=>{
 const action=RCM_SECTIONS.claims.actions[0];
 expect(buildRcmPayload(action,{invoiceId:'RCM-INV-001',payerIds:'P1,P2,P3,P4,P5'})).toEqual({invoiceId:'RCM-INV-001',payerIds:['P1','P2','P3','P4','P5']});
 for(const sequence of ['P1,P1','P1,,P2'])expect(()=>buildRcmPayload(action,{invoiceId:'INV',payerIds:sequence})).toThrow();
});
test('refund form enforces one source and demo grouping explicitly selects the uncertified adapter',()=>{
 const action=RCM_SECTIONS['patient-finance'].actions.find(a=>a.kind==='request-refund')!;
 expect(()=>buildRcmPayload(action,{depositId:'D',creditId:'C',amountMinor:'10',reason:'Duplicate payment'})).toThrow('exactly one');
 expect(buildRcmPayload(action,{depositId:'D',amountMinor:'10.05',reason:'Duplicate payment'})).toEqual({depositId:'D',amountMinor:1005,reason:'Duplicate payment'});
 expect(buildRcmPayload(RCM_SECTIONS.drg.actions[0],{invoiceId:'INV',diagnosisCodes:'A01,B02'})).toEqual({invoiceId:'INV',diagnosisCodes:['A01','B02'],adapter:'demo-v1'});
});
test('pricing and collection date inputs require a real calendar date',()=>{
 const action=RCM_SECTIONS.commercial.actions[0];
 expect(()=>buildRcmPayload(action,{priceId:'PX',unitPriceMinor:'10',taxBasisPoints:'500',effectiveFrom:'2026-02-30'})).toThrow('valid date');
 expect(buildRcmPayload(action,{priceId:'PX',unitPriceMinor:'10',taxBasisPoints:'500',effectiveFrom:'2026-09-29'}).taxBasisPoints).toBe(500);
});
test('imported allocation remainders may be signed while payable money stays non-negative',()=>{
 const fixture=rcmFixture();fixture.invoices[0].source={patientAllocationRemainderMinor:-100,payerAllocationRemainderMinor:100};expect(()=>parseRcmWorkspace(fixture)).not.toThrow();
 fixture.invoices[0].source={amountMinor:-100};expect(()=>parseRcmWorkspace(fixture)).toThrow('amountMinor');
});
test('command results validate their own monetary fields and workspace version',()=>{
 expect(parseRcmCommandResponse({version:0,workspace:rcmFixture(),result:{netMinor:100,taxMinor:5,totalMinor:105}}).result.totalMinor).toBe(105);
 expect(()=>parseRcmCommandResponse({version:0,workspace:rcmFixture(),result:{taxMinor:'5'}})).toThrow('taxMinor');
 expect(()=>parseRcmCommandResponse({version:1,workspace:rcmFixture(),result:{}})).toThrow('command.version');
});
test('demo DRG configuration parses editable rules and enforces a unique fallback and bounded weights',()=>{
 const action=RCM_SECTIONS.drg.actions.find(a=>a.kind==='configure-drg')!;
 expect(buildRcmPayload(action,{baseRateMinor:'100.25',groups:'I,DEMO-CARDIAC,15000\n*,DEMO-GENERAL,10000'})).toEqual({baseRateMinor:10025,groups:[{prefix:'I',groupCode:'DEMO-CARDIAC',weightBasisPoints:15000},{prefix:'*',groupCode:'DEMO-GENERAL',weightBasisPoints:10000}],adapter:'demo-v1'});
 for(const rules of ['I,DEMO,10000','*,DEMO,100001','*,DEMO,10000\n*,OTHER,10000','*bad,DEMO,10000'])expect(()=>buildRcmPayload(action,{baseRateMinor:'10',groups:rules})).toThrow();
});
test('package revision identity remains unique across repeated package IDs',()=>{
 const fixture=rcmFixture();fixture.packageVersions=[{id:'PKG',revisionId:'R1',caseRateMinor:10000,excessUnitMinor:100},{id:'PKG',revisionId:'R2',caseRateMinor:20000,excessUnitMinor:100}];
 expect(parseRcmWorkspace(fixture).packageVersions).toHaveLength(2);fixture.packageVersions[1].revisionId='R1';expect(()=>parseRcmWorkspace(fixture)).toThrow();
});
test('publication scope preserves tenant and branch API values and rejects unsupported scope',()=>{
 const action=RCM_SECTIONS.commercial.actions[0],values={priceId:'SVC',unitPriceMinor:'10',taxBasisPoints:'500',effectiveFrom:'2026-09-29'};
 expect(buildRcmPayload(action,{...values,level:'tenant'}).level).toBe('tenant');expect(buildRcmPayload(action,{...values,level:'branch'}).level).toBe('branch');expect(()=>buildRcmPayload(action,{...values,level:'facility'})).toThrow('supported option');
});
