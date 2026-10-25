import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRecordStore} from './record-store.mjs';
import {createDraftCenter} from './draft-center.mjs';
const user={id:'one',tenantId:'tenant'},policy={revision:0,enabled:true,retentionDays:7,excludedFields:[]};
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'center-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));let time=Date.now(),allowed=true;
 const records=createRecordStore(join(dir,'records.json'),{draftPolicy:()=>policy,now:()=>time});
 const center=createDraftCenter({records,policy:()=>policy,access:()=>allowed,context:()=> 'current',labels:(_user,_product,language)=>({customers:language==='ar'?'العملاء':'Customer Master'}),now:()=>time});
 const write=(logical,actor=user,product='app',values={name:'PRIVATE FORM VALUE'})=>records.handle(actor,JSON.stringify([product,logical]),'draft',{values,version:0,baseVersion:0,operationId:'draft'});
 return {records,write,call:(input,actor=user,product='app')=>center.handle(actor,product,input),deny:()=>allowed=false,advance:()=>time+=8*86400000};
}
test('center exposes metadata only and isolates tenant, owner and application',t=>{
 const {write,call}=fixture(t);write('form:customers:A');write('$draft:approval:["customers","inbox"]',user,'app',{schemaVersion:1,context:'current',data:{comment:'PRIVATE COMMENT'}});write('form:customers:B',{...user,id:'other'});write('form:customers:C',{...user,tenantId:'other'});write('form:customers:D',user,'another');
 const result=call({action:'list'});assert.equal(result.body.total,2);assert.ok(!JSON.stringify(result).includes('PRIVATE'));assert.ok(result.body.items.every(i=>i.expiresAt&&i.productId==='app'));assert.equal(call({action:'list',kind:'approval'}).body.total,1);assert.equal(call({action:'list',query:'inbox'}).body.total,1);
});
test('unavailable entries conceal page/record identity and cannot be opened but remain discardable',t=>{
 const {write,call,deny}=fixture(t);write('form:confidential:A');const item=call({action:'list'}).body.items[0];deny();const hidden=call({action:'list'}).body.items[0];assert.equal(hidden.pageId,null);assert.equal(hidden.recordId,null);assert.equal(hidden.status,'unavailable');assert.equal(call({action:'list',query:'confidential'}).body.total,0);
 assert.equal(call({action:'open',id:item.id,version:1}).status,403);const body={action:'discard',id:item.id,version:1,operationId:'discard'};assert.equal(call(body).status,204);assert.equal(call(body).status,204);assert.equal(call({action:'list'}).body.total,0);
});
test('changed source versions, approval contexts and missing files have distinct statuses',t=>{
 const {write,records,call}=fixture(t);write('form:customers:A');records.handle({...user,id:'other'},JSON.stringify(['app','form:customers:A']),'save',{version:0,draftVersion:0,values:{name:'newer'},operationId:'save'});
 write('$draft:approval:["customers","inbox"]',user,'app',{schemaVersion:1,context:'old',data:{comment:'old'}});write('$draft:import:["customers","mapping"]',user,'app',{schemaVersion:1,context:'headers',data:{mapping:{name:'0'}}});const items=call({action:'list'}).body.items;assert.equal(items.filter(i=>i.status==='outdated').length,2);assert.equal(items.find(i=>i.kind==='import').status,'file-required');
});
test('stale discard cannot erase a newer revision, expiry removes drafts and pagination is bounded',t=>{
 const {write,records,call,advance}=fixture(t);for(let i=0;i<27;i++)write('form:customers:'+i);const page=call({action:'list'}).body;assert.equal(page.total,27);assert.equal(page.items.length,25);assert.equal(call({action:'list',offset:25}).body.items.length,2);
 const item=page.items[0];records.handle(user,JSON.stringify(['app','form:customers:'+item.recordId]),'draft',{version:1,baseVersion:0,values:{name:'new'},operationId:'update'});assert.equal(call({action:'discard',id:item.id,version:1,operationId:'discard'}).status,409);advance();assert.equal(call({action:'list'}).body.total,0);
});
test('a stolen opaque reference cannot open or delete another owner draft',t=>{
 const {write,call}=fixture(t);write('form:customers:A');const item=call({action:'list'}).body.items[0],other={...user,id:'other'};
 for(const action of ['open','discard'])assert.equal(call({action,id:item.id,version:1,operationId:'other'},other).status,404);
 assert.equal(call({action:'list'}).body.total,1);
});

test('search matches localized page titles without searching unavailable identities',t=>{const {write,call,deny}=fixture(t);write('form:customers:A');assert.equal(call({action:'list',query:'Customer Master'}).body.total,1);assert.equal(call({action:'list',query:'العملاء',language:'ar'}).body.total,1);deny();assert.equal(call({action:'list',query:'العملاء',language:'ar'}).body.total,0);});
