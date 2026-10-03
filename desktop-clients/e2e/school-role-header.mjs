import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {loadPlaywright,BASE,API} from './harness.mjs';
import {SCHOOL_ROLE_VIEWS} from '../packages/erp-config/src/school-role-views.ts';

// Real authenticated demo API; no fixture interception, account changes, or role headers.
const output=process.env.E2E_ARTIFACTS??'/tmp/school-role-header-browser';mkdirSync(output,{recursive:true});
const args=process.env.E2E_DNS_OVERRIDE?[`--host-resolver-rules=${process.env.E2E_DNS_OVERRIDE}`]:[];
const browser=await loadPlaywright().chromium.launch({chromiumSandbox:false,args});
const results=[],errors=[],sessions=[];
const record=(name)=>{results.push({name,status:'passed'});console.log('PASS '+name);};
async function login(username,url=BASE){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(30000);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(request.url().includes('/school/api/session'))sessions.push({url:request.url(),moduleId:request.headers()['x-reference-module']});});
 await page.goto(url,{waitUntil:'networkidle'});await page.locator('input').first().fill(username);await page.locator('input[type=password]').fill(username);await page.locator('button[type=submit]').click();await page.locator('header [data-tour=module]').waitFor();
 return {context,page};
}
const root=page=>page.locator('.reference-school-root');
async function ready(page,role){await page.waitForLoadState('networkidle');await page.locator(`.reference-school-root[data-role="${role}"]`).waitFor();await page.waitForFunction(()=>{const r=document.querySelector('.reference-school-root');return r&&r.textContent.length>60&&!r.textContent.includes('Opening your portal');});}
async function openSwitcher(page){await page.mouse.move(1100,60);await page.locator('header [data-tour=module] button').focus();await page.locator('header [data-tour=module] button').click();}
async function select(page,view){await openSwitcher(page);const menu=page.getByRole('listbox');await menu.waitFor();await menu.getByRole('option',{name:new RegExp(view.title)}).click();await ready(page,view.role);assert.equal(new URL(page.url()).pathname,`/${view.id}/reference-school-dashboard`);}
async function api(page,path,moduleId){return page.evaluate(async({apiUrl,path,moduleId})=>{const response=await fetch(apiUrl+path,{headers:{Authorization:'Bearer '+localStorage.getItem('nexora-session-token'),'X-Product-Id':'nexora','X-Reference-Branch':'hq',...(moduleId?{'X-Reference-Module':moduleId}:{})}});return {status:response.status,body:await response.json()};},{apiUrl:API,path,moduleId});}
try{
 const {context,page}=await login('admin');
 await openSwitcher(page);await page.getByRole('listbox').waitFor();await page.getByRole('listbox').getByRole('option',{name:/School Accountant/}).scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/school-role-header-options.png`});await page.keyboard.press('Escape');
 for(const view of SCHOOL_ROLE_VIEWS){
  await select(page,view);
  assert.ok(sessions.some(session=>new URL(session.url).searchParams.get('role')===view.role&&session.moduleId===view.id),`${view.id} selected API session`);
  const sidebar=page.locator('aside[data-tour=sidebar]');await sidebar.hover();const links=await sidebar.locator('a').evaluateAll(nodes=>nodes.map(node=>({href:node.getAttribute('href'),text:node.textContent.trim()})));
  for(const item of view.groups.flatMap(group=>group.items))assert.ok(links.some(link=>link.text===item.label&&link.href.startsWith('/'+view.id+'/')),`${view.id} sidebar ${item.label}`);
  if(view.role==='student'||view.role==='parent')assert.ok(!links.some(link=>/admissions|teachers|students/.test(link.href)),`${view.id} hidden administration`);
  await page.screenshot({path:`${output}/${view.id}.png`});record(`${view.id} header, dashboard, session and sidebar`);
 }
 const student=SCHOOL_ROLE_VIEWS.find(view=>view.role==='student'),teacher=SCHOOL_ROLE_VIEWS.find(view=>view.role==='teacher');
 await select(page,student);
 await page.locator('aside[data-tour=sidebar]').hover();const fees=page.locator('aside[data-tour=sidebar] a[href*="reference-school-fees"]');await fees.click();await page.waitForURL('**/reference-school-student/reference-school-fees');await ready(page,'student');const feesUrl=page.url();assert.ok(feesUrl.includes('/reference-school-student/'));
 await page.reload({waitUntil:'networkidle'});await ready(page,'student');assert.equal(page.url(),feesUrl);record('student sidebar navigation and refresh preserve role');
 const newTab=await context.newPage();await newTab.goto(feesUrl,{waitUntil:'networkidle'});await ready(newTab,'student');await newTab.close();record('new browser tab preserves role URL');
 await select(page,teacher);await page.goBack({waitUntil:'networkidle'});await ready(page,'student');record('browser back restores student view');
 await page.keyboard.press('Control+k');await page.getByRole('dialog').locator('input').first().fill('reference-school-admissions');assert.equal(await page.getByRole('dialog').locator('button.group').count(),0);await page.keyboard.press('Escape');record('student command search excludes administrator pages');
 await page.goto(`${BASE}/reference-school-student/reference-school-admissions`,{waitUntil:'networkidle'});await page.getByText('Page unavailable for your role',{exact:true}).waitFor();assert.equal(await root(page).count(),0);record('student direct URL blocks hidden admissions');
 await page.goto(`${BASE}/reference-school-teacher/reference-school-quizzes-new`,{waitUntil:'networkidle'});await ready(page,'teacher');assert.ok((await root(page).innerText()).includes('Quiz settings'));record('teacher direct builder route preserves view');
 const studentData=await api(page,'/reference-modules/school/api/session?role=student',student.id);assert.equal(studentData.status,200);
 const students=await api(page,'/reference-modules/school/api/students',student.id);assert.equal(students.status,200);assert.equal(students.body.data.length,1);assert.equal(students.body.data[0].id,studentData.body.data.user.id);record('student selected view data limited to own student');
 const parentId='reference-school-parent',parent=await api(page,'/reference-modules/school/api/session?role=parent',parentId),parentStudents=await api(page,'/reference-modules/school/api/students',parentId);assert.equal(parent.status,200);assert.equal(parentStudents.status,200);assert.ok(parentStudents.body.data.every(student=>parent.body.data.children.includes(student.id)));record('parent selected view data limited to linked children');
 for(const [moduleId,pageId,marker] of [['reference-erp1','reference-erp1-masters-customers','Customers'],['reference-erp2','reference-erp2-masters-customers','Customers'],['reference-reports','reference-reports-overview','Workspace'],['healthcare','healthcare-dashboard','Healthcare']]){
  await page.goto(`${BASE}/${moduleId}/${pageId}`,{waitUntil:'networkidle'});await page.locator('header [data-tour=module]').waitFor();assert.ok((await page.locator('main').first().innerText()).length>30,marker);record(moduleId+' route regression');
 }
 await page.keyboard.press('Control+k');await page.getByRole('dialog').locator('input').first().fill('reference-school-dashboard');await page.getByRole('dialog').locator('button.group').first().click();await ready(page,'admin');assert.equal(new URL(page.url()).pathname,'/reference-school/reference-school-dashboard');record('cross-module command search opens an authorized School view');
 const schoolStudent=await login('school-student');await schoolStudent.page.goto(`${BASE}/reference-school-student/reference-school-dashboard`,{waitUntil:'networkidle'});await ready(schoolStudent.page,'student');
 await schoolStudent.page.locator('header [data-tour=module] button').count().then(async count=>{if(count){await schoolStudent.page.locator('header [data-tour=module] button').click();const labels=await schoolStudent.page.getByRole('listbox').innerText();assert.ok(!labels.includes('School Administrator'));await schoolStudent.page.keyboard.press('Escape');}});
 const denied=await api(schoolStudent.page,'/reference-modules/school/api/session?role=admin','reference-school');assert.equal(denied.status,403);record('ordinary student cannot claim Administrator module header');await schoolStudent.context.close();
 const schoolTeacher=await login('school-teacher');await schoolTeacher.page.goto(`${BASE}/reference-school/reference-school-dashboard`,{waitUntil:'networkidle'});await ready(schoolTeacher.page,'teacher');assert.ok(schoolTeacher.page.url().includes('/reference-school-teacher/'));await schoolTeacher.page.goto(`${BASE}/reference-school/reference-school-students-new`,{waitUntil:'networkidle'});await schoolTeacher.page.getByText('Page unavailable for your role',{exact:true}).waitFor();record('legacy School URL resolves authorized teacher view and blocks registration');await schoolTeacher.context.close();
 for(const view of SCHOOL_ROLE_VIEWS){const account=await login('school-'+view.role,`${BASE}/${view.id}/reference-school-dashboard`);await ready(account.page,view.role);await account.page.goto(BASE,{waitUntil:'networkidle'});await ready(account.page,view.role);assert.ok(new URL(account.page.url()).pathname.startsWith('/'+view.id+'/'));record('ordinary '+view.role+' login and homepage retain authorized role view');await account.context.close();}
 assert.deepEqual(errors,[]);record('no browser page errors');await context.close();
}finally{writeFileSync(`${output}/results.json`,JSON.stringify({base:BASE,api:API,results,errors,sessions},null,2)+'\n');await browser.close();}
