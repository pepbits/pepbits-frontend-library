import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,cpSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {SCHOOL_ROLE_VIEWS} from '../desktop-clients/packages/erp-config/src/school-role-views.ts';
import {createApplicationConfig} from './application-config.mjs';
import {resolveSchoolView} from './school-view-policy.mjs';
import {PAGE_REGISTRY} from '../desktop-clients/packages/erp-config/src/navigation.ts';

test('additional School views require an explicit authenticated server grant',()=>{
 const config=createApplicationConfig(fileURLToPath(new URL('./config/',import.meta.url)),new Set(Object.keys(PAGE_REGISTRY)));
 const schoolModules=user=>config.navigation(user,'nexora').body.nodes.filter(node=>node.kind==='module'&&node.moduleId.startsWith('reference-school')).map(node=>node.moduleId);
 assert.deepEqual(schoolModules({role:'enterprise-admin'}),['reference-school']);
 assert.deepEqual(schoolModules({role:'school-admin'}),['reference-school']);
 assert.equal(resolveSchoolView({role:'enterprise-admin'},'reference-school-teacher'),null);
 assert.deepEqual(schoolModules({role:'school-admin',referenceSchoolViews:['teacher','unrecognized']}),['reference-school','reference-school-teacher']);
 assert.equal(resolveSchoolView({role:'school-admin',referenceSchoolViews:['teacher']},'reference-school-teacher').role,'teacher');
});

test('School grants preserve configured node restrictions and do not expose roleless pages to other users',()=>{
 const dir=mkdtempSync(join(tmpdir(),'school-config-'));
 try{
  cpSync(fileURLToPath(new URL('./config/',import.meta.url)),dir,{recursive:true});
  const file=join(dir,'navigation','nexora.json'),nav=JSON.parse(readFileSync(file,'utf8'));
  nav.roles.push('support-analyst');
  const supportModule=nav.nodes.find(node=>node.kind==='module'&&!node.moduleId.startsWith('reference-school'));
  supportModule.roles=[...(supportModule.roles??[]),'support-analyst'];supportModule.pageId=nav.defaultPageId;
  const supportPage=nav.pages.find(page=>page.id===nav.defaultPageId);
  supportPage.roles=[...(supportPage.roles??[]),'support-analyst'];
  const studentNode=nav.nodes.find(node=>node.id==='reference-school-teacher-page-students');
  studentNode.roles=['school-admin'];
  delete nav.pages.find(page=>page.id==='reference-school-settings').roles;
  writeFileSync(file,JSON.stringify(nav));
  const config=createApplicationConfig(dir,new Set(Object.keys(PAGE_REGISTRY)));
  const teacher=config.navigation({role:'school-teacher'},'nexora');
  assert.equal(teacher.status,200);
  assert.ok(!teacher.body.nodes.some(node=>node.id===studentNode.id));
  const support=config.navigation({role:'support-analyst'},'nexora');
  assert.equal(support.status,200);
  assert.ok(!support.body.pages.some(page=>page.id.startsWith('reference-school-')));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('six School header views enforce server roles, navigation, tenant branches and actor identity',async t=>{
 const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
 const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const dir=mkdtempSync(join(tmpdir(),'school-role-http-'));
 const child=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,PORT:String(port),RECORD_DATA_DIR:dir,NEXORA_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}rmSync(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${port}`;
 let ready=false;for(let i=0;i<100;i++){try{await fetch(base);ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}assert.ok(ready,output);
 const login=async username=>{
  const response=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:username})});
  assert.equal(response.status,200);return response.json();
 };
 const demo=await login('admin');
 const request=(token,path,options={})=>fetch(base+path,{method:options.method??'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers},...(options.body?{body:JSON.stringify(options.body)}:{})});
 const school=(token,module,path,options={})=>request(token,'/reference-modules/school'+path,{...options,headers:{...(module?{'X-Reference-Module':module}:{}),...options.headers}});
 const json=async response=>{assert.equal(response.status,200,await response.clone().text());return response.json();};
 const nav=await json(await request(demo.token,'/navigation?productId=nexora'));
 const schoolNodes=nav.nodes.filter(node=>node.kind==='module'&&node.moduleId.startsWith('reference-school'));
 assert.deepEqual(schoolNodes.map(node=>node.moduleId),SCHOOL_ROLE_VIEWS.map(view=>view.id));
 assert.ok(schoolNodes.every(node=>node.pageId==='reference-school-dashboard'));
 assert.equal(nav.pages.filter(page=>page.id.startsWith('reference-school-')).length,24);
 const locales=await json(await request(demo.token,'/localization?productId=nexora&language=en'));
 for(const view of SCHOOL_ROLE_VIEWS){
  await t.test(view.title,async()=>{
   const module=schoolNodes.find(node=>node.moduleId===view.id);
   assert.equal(locales.messages[module.labelKey],view.title);
   const sections=nav.nodes.filter(node=>node.parentId===module.id);
   assert.deepEqual(sections.map(node=>locales.messages[node.labelKey]),[...view.groups.map(group=>group.label),'Account']);
   for(const [index,group] of view.groups.entries()){
    const pages=nav.nodes.filter(node=>node.parentId===sections[index].id);
    assert.deepEqual(pages.map(node=>node.pageId),group.items.map(item=>'reference-school'+item.href.replaceAll('/','-')));
    assert.deepEqual(pages.map(node=>locales.messages[node.labelKey]),group.items.map(item=>item.label));
   }
   const session=await json(await school(demo.token,view.id,'/api/session?role='+view.role));
   assert.equal(session.data.role,view.role);
   assert.equal((await school(demo.token,view.id,'/api/session?role='+(view.role==='admin'?'teacher':'admin'))).status,403);
   const account=await login('school-'+view.role);
   const own=await json(await request(account.token,'/navigation?productId=nexora'));
   assert.deepEqual(own.nodes.filter(node=>node.kind==='module'&&node.moduleId.startsWith('reference-school')).map(node=>node.moduleId),[view.id]);
   assert.equal((await json(await school(account.token,null,'/api/session'))).data.role,view.role,'legacy route keeps actual account role');
   for(const foreign of SCHOOL_ROLE_VIEWS.filter(other=>other.id!==view.id))assert.equal((await school(account.token,foreign.id,'/api/session')).status,403);
   if(view.role==='teacher'){
    assert.equal((await school(account.token,'reference-school-student','/api/session?referenceSchoolViews=student',{headers:{'X-Reference-School-Views':'student'}})).status,403);
    assert.equal((await school(account.token,'reference-school-student','/api/students',{method:'POST',body:{referenceSchoolViews:['student'],role:'school-student'}})).status,403);
   }
   assert.equal((await school(account.token,view.id,'/api/meta',{headers:{'X-Product-Id':'ledger'}})).status,403);
   assert.equal((await school(account.token,view.id,'/api/meta',{headers:{'X-Reference-Branch':'unknown'}})).status,403);
   if(view.role!=='admin')assert.equal((await school(account.token,view.id,'/api/meta',{headers:{'X-Reference-Branch':'dubai'}})).status,403);
  });
 }
 for(const invalid of ['reference-reports','reference-erp1','reference-school-unknown','unknown'])assert.equal((await school(demo.token,invalid,'/api/session')).status,403);
 for(const [username,role] of [['user1','accountant'],['user2','teacher']]){
  const account=await login(username),view=SCHOOL_ROLE_VIEWS.find(view=>view.role===role);
  const own=await json(await request(account.token,'/navigation?productId=nexora'));
  assert.deepEqual(own.nodes.filter(node=>node.kind==='module'&&node.moduleId.startsWith('reference-school')).map(node=>node.moduleId),[view.id]);
  assert.equal((await json(await school(account.token,null,'/api/session'))).data.role,role);
  assert.equal((await school(account.token,'reference-school','/api/meta')).status,403);
  assert.equal((await school(account.token,view.id,'/api/meta',{headers:{'X-Reference-Branch':'hq'}})).status,403);
 }

 await t.test('selected roles retain School resource reads and mutations',async()=>{
  const admin='reference-school',teacher='reference-school-teacher',student='reference-school-student',parent='reference-school-parent',librarian='reference-school-librarian',accountant='reference-school-accountant';
  const students=await json(await school(demo.token,student,'/api/students'));
  assert.deepEqual(students.data.map(row=>row.id),['s-1192']);
  const children=await json(await school(demo.token,parent,'/api/students'));
  assert.deepEqual(children.data.map(row=>row.id).sort(),['s-1072','s-1192']);
  assert.equal((await school(demo.token,student,'/api/students/s-1000')).status,403);
  assert.equal((await school(demo.token,parent,'/api/students/s-1000')).status,403);
  assert.equal((await school(demo.token,teacher,'/api/marks?classId=c-10A')).status,200);
  assert.equal((await school(demo.token,teacher,'/api/marks',{method:'POST',body:{term:'QTR',entries:[{studentId:'s-1192',subjectId:'sub-math',value:80}]}})).status,200);
  assert.equal((await school(demo.token,teacher,'/api/marks',{method:'POST',body:{term:'QTR',entries:[{studentId:'s-1192',subjectId:'sub-eng',value:80}]}})).status,403);
  for(const module of [teacher,student,parent,librarian,accountant]){
   assert.equal((await school(demo.token,module,'/api/students?role=admin',{method:'POST',body:{name:'Denied Student',classId:'c-10A'}})).status,403);
   assert.equal((await school(demo.token,module,'/api/students/new')).status,403);
   assert.equal((await school(demo.token,module,'/api/teachers/new')).status,403);
  }
  for(const module of [student,parent,librarian,accountant]){
   assert.equal((await school(demo.token,module,'/api/quizzes/new')).status,403);
   for(const path of ['/api//quizzes/new','/api/quizzes/new//','/api/quizzes/%6eew','/api/quizzes/new/preview'])assert.equal((await school(demo.token,module,path)).status,403);
   assert.equal((await school(demo.token,module,'/api/quizzes',{method:'POST',body:{title:'Denied quiz',classId:'c-10A'}})).status,403);
  }
  assert.equal((await school(demo.token,teacher,'/api/reports/summary')).status,403);
  const created=await school(demo.token,admin,'/api/students',{method:'POST',body:{name:'Header Student',classId:'c-10A'}});
  assert.equal(created.status,201,await created.clone().text());
  const books=await json(await school(demo.token,librarian,'/api/books'));
  assert.equal((await school(demo.token,librarian,'/api/books/'+books.data[0].id,{method:'PATCH',body:{shelf:'A-99'}})).status,200);
  assert.equal((await school(demo.token,accountant,'/api/books/'+books.data[0].id,{method:'PATCH',body:{shelf:'Denied'}})).status,403);
  const invoices=await json(await school(demo.token,accountant,'/api/invoices'));
  const invoice=invoices.data.find(row=>row.amount>row.paid);
  assert.equal((await school(demo.token,accountant,'/api/invoices/'+invoice.id,{method:'PATCH',body:{payAmount:1,method:'Cash'}})).status,200);
  assert.equal((await school(demo.token,librarian,'/api/invoices/'+invoice.id,{method:'PATCH',body:{payAmount:1}})).status,403);
  for(const module of [student,parent])assert.equal((await school(demo.token,module,'/api/marks',{method:'POST',body:{term:'QTR',entries:[{studentId:'s-1192',subjectId:'sub-math',value:99}]}})).status,403);
  assert.equal((await school(demo.token,parent,'/api/stats?role=student&id=s-1192')).status,200);
  assert.equal((await school(demo.token,parent,'/api/stats?role=student&id=s-1000')).status,403);
  assert.equal((await school(demo.token,parent,'/api/stats?role=admin')).status,403);
  assert.equal((await school(demo.token,admin,'/api/stats?role=accountant')).status,200);
  assert.equal((await school(demo.token,teacher,'/api/stats?role=accountant')).status,403);
 });
 assert.deepEqual((await json(await request(demo.token,'/auth/me'))).user,demo.user,'view selection does not mutate the authenticated actor');
 assert.equal((await request(demo.token,'/reference-modules/erp1/api/dashboard',{headers:{'X-Reference-Module':'reference-school-student'}})).status,200,'School selection does not replace ERP authority');
 const preflight=await fetch(base+'/reference-modules/school/api/session',{method:'OPTIONS'});
 assert.match(preflight.headers.get('access-control-allow-headers'),/X-Reference-Module/i);
});
