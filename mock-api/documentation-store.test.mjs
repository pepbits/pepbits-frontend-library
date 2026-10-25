import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createDocumentationStore,validateDocumentation} from './documentation-store.mjs';
const user={id:'one',tenantId:'tenant-one',role:'reader'};
function fixture(){const root=mkdtempSync(join(tmpdir(),'documentation-'));mkdirSync(join(root,'documentation'));const guide={pageId:'page',title:'Page',module:'finance',revision:1,status:'authored',sections:[{id:'workflow',title:'How to',paragraphs:['English']}],fields:[],tour:[]};const content={schemaVersion:1,releases:[{id:'old',version:'1',type:'release',date:'2026-09-01',title:'Old',summary:'Old',knownIssues:[],pageIds:['page'],guides:{page:guide}},{id:'current',version:'2',type:'patch',parentId:'old',date:'2026-09-08',title:'Current',summary:'Current',knownIssues:[],pageIds:['page'],guides:{page:{...guide,revision:2}}}],changes:[{id:'change',revision:2,releaseId:'current',pageId:'page',sectionId:'workflow',title:'Change',summary:'Read',requiresAcknowledgment:true}]};writeFileSync(join(root,'documentation/releases.json'),JSON.stringify(content));writeFileSync(join(root,'documentation/translations.json'),JSON.stringify({ml:{English:'മലയാളം'}}));const config={navigation:(u,p)=>p==='blocked'?{status:403,error:'Product is unavailable.'}:{status:200,body:{pages:u.role==='blocked'?[]:[{id:'page'}]}},localization:()=>({body:{messages:{},fallbackMessages:{}}})};const open=()=>createDocumentationStore(join(root,'state.sqlite'),root,config);return {root,content,open};}
const query=(store,u=user,release='current',extra='')=>store.query(u,'product',new URLSearchParams(`releaseId=${release}&language=en${extra}`));
test('versioned guides, role-filtered search, explicit language fallback and invalid requests',()=>{const f=fixture(),s=f.open();try{
 assert.equal(query(s,user,'old').body.changes.length,0);assert.equal(query(s,user,'old','&pageId=page').body.guide.revision,1);
 assert.equal(query(s,user,'missing').status,404);assert.equal(query(s,{...user,role:'blocked'}).body.pages.length,0);assert.equal(query(s,{...user,role:'blocked'},'current','&pageId=page').status,403);
 assert.equal(query(s,user,'current','&q=english').body.total,1);assert.equal(query(s,user,'current','&offset=-1').status,400);
 const ml=s.query(user,'product',new URLSearchParams('releaseId=current&language=ml&pageId=page'));assert.equal(ml.body.guide.sections[0].paragraphs[0],'മലയാളം');assert.equal(ml.body.guide.language,'mixed');
 assert.equal(s.query(user,'blocked',new URLSearchParams('releaseId=current')).status,403);
 }finally{s.close();rmSync(f.root,{recursive:true,force:true});}});
test('reading state is idempotent, persistent and isolated; only explicit acknowledgment acknowledges',()=>{const f=fixture();let s=f.open();try{
 const input={releaseId:'current',changeId:'change',revision:2,action:'read'};
 assert.equal(s.write(user,'product',{...input,revision:1}).status,409);
 const first=s.write(user,'product',input).body;assert.ok(first.readAt);assert.equal(first.acknowledgedAt,null);assert.deepEqual(s.write(user,'product',input).body,first);
 assert.equal(query(s,{...user,tenantId:'two'}).body.unread,1);assert.equal(query(s,{...user,id:'two'}).body.unread,1);assert.equal(s.query(user,'another',new URLSearchParams('releaseId=current')).body.unread,1);
 s.write(user,'product',{...input,action:'dismiss'});assert.equal(query(s).body.changes[0].acknowledgedAt,null);
 s.write(user,'product',{...input,action:'acknowledge'});s.close();s=f.open();assert.ok(query(s).body.changes[0].acknowledgedAt);
 assert.equal(s.write({...user,role:'blocked'},'product',input).status,404);
 }finally{s.close();rmSync(f.root,{recursive:true,force:true});}});
test('manifest rejects broken notices, duplicate versions and invalid tour anchors',()=>{const f=fixture();try{
 const bad=structuredClone(f.content);bad.changes[0].sectionId='missing';assert.throws(()=>validateDocumentation(bad));
 const duplicate=structuredClone(f.content);duplicate.releases.push(duplicate.releases[0]);assert.throws(()=>validateDocumentation(duplicate));
 const tour=structuredClone(f.content);tour.releases[0].guides.page.tour=[{target:'"] script',title:'x',text:'x'}];assert.throws(()=>validateDocumentation(tour));
 }finally{rmSync(f.root,{recursive:true,force:true});}});
test('tenant rollout refuses future snapshots and product manifests stay separate',()=>{
 const f=fixture();writeFileSync(join(f.root,'documentation/availability.json'),JSON.stringify({defaultReleaseId:'current',products:{product:{tenants:{'tenant-one':'old'}}}}));
 mkdirSync(join(f.root,'documentation/products/custom'),{recursive:true});const custom=structuredClone(f.content);custom.releases[1].guides.page.title='Custom product guide';writeFileSync(join(f.root,'documentation/products/custom/releases.json'),JSON.stringify(custom));
 const s=f.open();try{
  assert.equal(query(s).status,404);assert.equal(query(s,user,'old').status,200);assert.equal(query(s,{...user,tenantId:'second'}).status,200);
  assert.equal(s.query(user,'custom',new URLSearchParams('releaseId=current&pageId=page')).body.guide.title,'Custom product guide');
  assert.equal(query(s,{...user,tenantId:'second'},'current','&pageId=page').body.guide.title,'Page');
 }finally{s.close();rmSync(f.root,{recursive:true,force:true});}
});
