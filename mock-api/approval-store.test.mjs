import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApprovalStore} from './approval-store.mjs';
const requester={id:'r',name:'Requester',role:'operations-analyst',tenantId:'t'},finance={id:'f',name:'Finance',role:'finance-manager',tenantId:'t'},admin={id:'a',name:'Admin',role:'enterprise-admin',tenantId:'t'};
function setup(t){const dir=mkdtempSync(join(tmpdir(),'approvals-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const records={A:{name:'A'},B:{name:'B'}};const file=join(dir,'approvals.json'),options={record:(_u,_p,_page,id)=>records[id]};let store=createApprovalStore(file,options);return {records,reopen:()=>{store=createApprovalStore(file,options);},call:(user,body)=>store.handle(user,{scope:['test','customer-master'],operationId:randomUUID(),...body})};}
test('ordered stages, config snapshot, comments, requester notifications and persistence',t=>{
 const {call,reopen}=setup(t);
 assert.equal(call(finance,{action:'configure',version:0,stages:[]}).status,403);
 const stages=[{name:'Finance',roles:['finance-manager']},{name:'Final',roles:['enterprise-admin']}];
 assert.equal(call(admin,{action:'configure',version:0,stages}).status,200);
 assert.equal(call(requester,{action:'submit',recordId:'A',version:0,comment:''}).status,422);
 const submitted=call(requester,{action:'submit',recordId:'A',version:0,comment:'Please review'});assert.equal(submitted.body.items[0].status,'pending');
 call(admin,{action:'configure',version:1,stages:[{name:'Replacement',roles:['operations-analyst']}]});
 assert.equal(call(admin,{action:'decide',decision:'approve',items:[{recordId:'A',version:1}],comment:'Too early'}).body.results[0].ok,false);
 assert.equal(call(finance,{action:'decide',decision:'approve',items:[{recordId:'A',version:1}],comment:'Finance checked'}).body.items[0].stage,1);
 assert.equal(call(admin,{action:'decide',decision:'approve',items:[{recordId:'A',version:2}],comment:'Final checked'}).body.items[0].status,'approved');
 reopen();const mine=call(requester,{action:'read'}).body;assert.equal(mine.items[0].history.length,3);assert.equal(mine.notifications.length,3);assert.equal(mine.notifications[0].message,'Approved');
 call(requester,{action:'mark-read',ids:mine.notifications.map(n=>n.id)});assert.ok(call(requester,{action:'read'}).body.notifications.every(n=>n.read));assert.equal(call(finance,{action:'read'}).body.notifications.length,0);
});
test('self approval, tenant/product isolation, stale versions and changed saved records are blocked',t=>{
 const {call,records}=setup(t);
 call(finance,{action:'submit',recordId:'A',version:0,comment:'Review'});
 assert.equal(call(finance,{action:'decide',decision:'approve',items:[{recordId:'A',version:1}],comment:'Self'}).body.results[0].ok,false);
 assert.equal(call({...admin,tenantId:'other'},{action:'read'}).body.items.length,0);
 assert.equal(call(admin,{action:'read',scope:['other','customer-master']}).body.items.length,0);
 call(requester,{action:'submit',recordId:'B',version:0,comment:'Review'});records.B.name='Edited';
 const changed=call(finance,{action:'read'}).body.items.find(i=>i.recordId==='B');assert.equal(changed.recordChanged,true);assert.equal(changed.canAct,false);
 assert.match(call(finance,{action:'decide',decision:'approve',items:[{recordId:'B',version:1}],comment:'Review'}).body.results[0].error,/changed/);
 assert.equal(call(requester,{action:'submit',recordId:'B',version:1,comment:'Revised'}).body.items.find(i=>i.recordId==='B').version,2);
 assert.equal(call(finance,{action:'decide',decision:'approve',items:[{recordId:'B',version:1}],comment:'Stale'}).body.results[0].ok,false);
});
test('bulk partial results, request changes, rejection, resubmission and idempotent recovery',t=>{
 const {call,reopen}=setup(t);for(const recordId of ['A','B'])call(requester,{action:'submit',recordId,version:0,comment:'Review'});
 const operation={action:'decide',decision:'request-changes',items:[{recordId:'A',version:1},{recordId:'B',version:0}],comment:'Fix details',operationId:randomUUID()};
 assert.deepEqual(call(finance,operation).body.results.map(r=>r.ok),[true,false]);reopen();assert.deepEqual(call(finance,operation).body.results.map(r=>r.ok),[true,false]);assert.equal(call(requester,{action:'read'}).body.items[0].history.length,2);
 assert.equal(call(finance,{...operation,comment:'Different'}).status,409);
 call(requester,{action:'submit',recordId:'A',version:2,comment:'Fixed'});
 const rejected=call(finance,{action:'decide',decision:'reject',items:[{recordId:'A',version:3}],comment:'Not acceptable'});assert.equal(rejected.body.items.find(i=>i.recordId==='A').status,'rejected');
 assert.equal(call(requester,{action:'submit',recordId:'A',version:4,comment:'Try again'}).status,200);
});
