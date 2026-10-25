import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApplicationConfig} from './application-config.mjs';
import {createDocumentationStore} from './documentation-store.mjs';
import {PAGE_REGISTRY} from '../desktop-clients/packages/erp-config/src/navigation.ts';
import {MEDSLOT_REFERENCE} from '../desktop-clients/packages/erp-config/src/medslot-reference.ts';

test('actual MedSlot navigation and all fourteen English guides obey host role grants', () => {
 const root=fileURLToPath(new URL('./config',import.meta.url));
 const config=createApplicationConfig(root,new Set(Object.keys(PAGE_REGISTRY)));
 const directory=mkdtempSync(join(tmpdir(),'medslot-guide-'));
 let store;
 try {
  store=createDocumentationStore(join(directory,'help.sqlite'),root,config);
  const user={id:'synthetic-medslot-guide',tenantId:'NEX-AE-001',branch:'hq',role:'enterprise-admin'};
  const nav=config.navigation(user,'nexora');assert.equal(nav.status,200);
  assert.ok(nav.body.nodes.some(n=>n.moduleId==='reference-medslot'));
  for(const page of MEDSLOT_REFERENCE.pages){
   assert.ok(nav.body.pages.some(p=>p.id===page.id));
   const result=store.query(user,'nexora',new URLSearchParams({releaseId:'2026-10-02-medslot-reference-import',pageId:page.id,language:'en'}));
   assert.equal(result.status,200,page.id);
   assert.equal(result.body.guide.status,'authored');
   assert.ok(result.body.guide.sections.every(s=>s.paragraphs.length));
  }
  const scheduler=config.navigation({...user,role:'medslot-scheduler'},'nexora');assert.equal(scheduler.status,200);
  assert.ok(scheduler.body.pages.some(p=>p.id==='reference-medslot-book'));
  assert.ok(!scheduler.body.pages.some(p=>p.id==='reference-medslot-settings'));
  const provider=config.navigation({...user,role:'medslot-provider'},'nexora');assert.equal(provider.status,200);
  assert.ok(provider.body.pages.some(p=>p.id==='reference-medslot-calendar'));
  assert.ok(!provider.body.pages.some(p=>p.id==='reference-medslot-book'));
  const forbidden=store.query({...user,role:'school-teacher'},'nexora',new URLSearchParams({releaseId:'2026-10-02-medslot-reference-import',pageId:'reference-medslot-dashboard',language:'en'}));assert.equal(forbidden.status,403);
 } finally {store?.close();rmSync(directory,{recursive:true,force:true});}
});
