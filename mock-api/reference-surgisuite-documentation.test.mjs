import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApplicationConfig} from './application-config.mjs';
import {createDocumentationStore} from './documentation-store.mjs';
import {PAGE_REGISTRY} from '../desktop-clients/packages/erp-config/src/navigation.ts';

test('actual SurgiSuite help configuration serves all nine guides in four languages and denies unrelated roles',()=>{
 const configRoot=fileURLToPath(new URL('./config',import.meta.url));
 const config=createApplicationConfig(configRoot,new Set(Object.keys(PAGE_REGISTRY)));
 const directory=mkdtempSync(join(tmpdir(),'surgisuite-guide-'));
 let store;
 try{
  store=createDocumentationStore(join(directory,'state.sqlite'),configRoot,config);
  const user={id:'synthetic-surgical-guide',tenantId:'NEX-AE-001',branch:'hq',role:'enterprise-admin'};
  for(const language of ['en','ar','hi','ml'])for(const page of ['board','schedule','cases','approvals','patients','inventory','analytics','masters','case']){
   const response=store.query(user,'nexora',new URLSearchParams({releaseId:'2026-10-02-surgisuite-reference-import',pageId:'reference-surgisuite-'+page,language}));
   assert.equal(response.status,200,language+' '+page);
   const guide=response.body.guide;
   assert.equal(guide.language,language,language+' '+page+' must not silently fall back to mixed English');
   assert.equal(guide.translationStatus,language==='en'?'source':'current');
   assert.equal(guide.tour.length,2);
   assert.ok(guide.tour.every(step=>typeof step.text==='string'&&step.text.trim()));
   if(language!=='en')assert.equal(guide.reviewStatus,'pending','generated language content is not human approval');
  }
  const forbidden=store.query({...user,role:'school-teacher'},'nexora',new URLSearchParams({releaseId:'2026-10-02-surgisuite-reference-import',pageId:'reference-surgisuite-case',language:'en'}));
  assert.equal(forbidden.status,403);
 }finally{store?.close();rmSync(directory,{recursive:true,force:true});}
});
