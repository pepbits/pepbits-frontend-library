import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createDiagnosticStore} from '../reference-diagnostics-store.mjs';
// Missing dependencies fail explicitly. This suite never reports a skipped backend as passing.
const require=createRequire(import.meta.url);
for(const name of ['@nestjs/core','typeorm','better-sqlite3','light-my-request','dicom-parser'])require.resolve(name);
const user={id:'synthetic-admin',name:'Integration Test',tenantId:'synthetic-tenant',role:'enterprise-admin'};
const scope={applicationId:'nexora',branchId:'test-hq'};
for(const variant of ['lis1','lis2','ris1'])test(`${variant}: actual service persists records and separates branches`,{timeout:120000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pepbits-diagnostic-test-'));
 let store=createDiagnosticStore({variant,dataDir:directory});
 const send=(method,path,body,branch=scope.branchId,actor=user)=>store.handle(actor,{...scope,branchId:branch},{method,path,body,headers:{'content-type':'application/json'}});
 try{
  const session=await send('GET','/api/session');assert.equal(session.status,200,JSON.stringify(session.body));assert.equal(session.body.user.name,user.name);
  const patient=variant==='lis1'?{firstName:'SyntheticDiagnostic',lastName:'Acceptance',dob:'1990-01-01',gender:'M'}:{first_name:'SyntheticDiagnostic',last_name:'Acceptance',dob:'1990-01-01',gender:'M',sex:'M'};
  const created=await send('POST','/api/patients',patient);assert.ok([200,201].includes(created.status),JSON.stringify(created.body));
  const rows=r=>Array.isArray(r.body)?r.body:r.body.data;
  const list=await send('GET','/api/patients?q=SyntheticDiagnostic');assert.equal(list.status,200);assert.equal(rows(list).length,1);
  const other=await send('GET','/api/patients?q=SyntheticDiagnostic',undefined,'test-other');assert.equal(other.status,200);assert.equal(rows(other).length,0);
  assert.equal((await send('POST','/api/patients',patient,scope.branchId,{...user,role:'operations-analyst'})).status,403);
  await store.close();store=createDiagnosticStore({variant,dataDir:directory});
  assert.equal(rows(await send('GET','/api/patients?q=SyntheticDiagnostic')).length,1);
 }finally{await store.close();await rm(directory,{recursive:true,force:true});}
});
