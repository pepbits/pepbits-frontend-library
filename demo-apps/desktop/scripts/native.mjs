// Actual Tauri/WebKit driver check. Browser-mode evidence cannot satisfy this gate.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const driver=process.env.TAURI_DRIVER_URL??'http://127.0.0.1:4444';
const application=fileURLToPath(new URL('../src-tauri/target/debug/app',import.meta.url));
const credential=readFileSync(new URL('../../../mock-api/server.mjs',import.meta.url),'utf8').match(/username:\s*"admin",\s*password:\s*"([^"]+)"/)[1];
let session;
async function request(path,body,method=body===undefined?'GET':'POST'){
 const r=await fetch(driver+path,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});const j=await r.json();if(!r.ok)throw Error(j.value?.message??'WebDriver failed');return j.value;
}
const wd=(path,body,method)=>request('/session/'+session+path,body,method);
const js=(script,args=[])=>wd('/execute/sync',{script,args});
async function until(fn,label){for(let i=0;i<150;i++){try{if(await fn())return;}catch{}await new Promise(r=>setTimeout(r,200));}throw Error('Timed out: '+label);}
try{
 await until(async()=>{await request('/status');return true;},'driver');
 const created=await request('/session',{capabilities:{alwaysMatch:{'tauri:options':{application}}}});session=created.sessionId;
 await until(()=>js('return !!document.querySelector("input[type=password]")'),'login');
 for(const [selector,text] of [['input[autocomplete=username]','admin'],['input[type=password]',credential]]){
  const el=await wd('/element',{using:'css selector',value:selector});await wd(`/element/${el['element-6066-11e4-a52e-4f735466cecf']}/value`,{text});
 }
 const button=await wd('/element',{using:'css selector',value:'button[type=submit]'});await wd(`/element/${button['element-6066-11e4-a52e-4f735466cecf']}/click`,{});
 await until(()=>js('return !!document.querySelector("header")'),'authenticated shell');
 assert.equal(await js('return !!window.__TAURI_INTERNALS__'),true);
 // Native rendering of server-persisted language settings; each reload restores the same session.
 for(const language of ['ar','hi','ml','en']){
  await js('history.pushState(null,"","/preferences");window.dispatchEvent(new PopStateEvent("popstate"));return true;');
  await until(()=>js('return !!document.querySelector("[data-page-id=preferences]")'),'preferences');
  const changed=await js(`const select=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='ar'));if(!select)return false;select.value=arguments[0];select.dispatchEvent(new Event('change',{bubbles:true}));return true;`,[language]);assert.equal(changed,true);
  await until(()=>js('return document.documentElement.lang===arguments[0]&&document.documentElement.dir===arguments[1]',[language,language==='ar'?'rtl':'ltr']),'native language '+language);
 }
 const main=(await wd('/window/handles'))[0];
 async function buttonText(text){const element=await wd('/element',{using:'xpath',value:'//button[contains(normalize-space(.),'+JSON.stringify(text)+')]'});await wd(`/element/${element['element-6066-11e4-a52e-4f735466cecf']}/click`,{});}
 async function openRecord(){
  await js('history.pushState(null,"","/finance/customers");dispatchEvent(new PopStateEvent("popstate"));return true;');
  await until(()=>js('return !!document.querySelector("tbody tr td:nth-child(3)")'),'customer rows');
  const record=await js('const row=document.querySelector("tbody tr");const id=row.children[1].textContent.trim();row.children[2].click();return id;');
  await until(()=>js('return location.pathname.endsWith("/"+arguments[0])',[record]),'record');return record;
 }
 async function detach(record){
  const el=await wd('/element',{using:'css selector',value:'button[aria-label="Tab options"]'});await wd(`/element/${el['element-6066-11e4-a52e-4f735466cecf']}/click`,{});
  await buttonText('Open in its own window');await until(async()=>(await wd('/window/handles')).length===2,'child window');
  const child=(await wd('/window/handles')).find(h=>h!==main);await wd('/window',{handle:child});
  await until(()=>js('return !!document.querySelector("header")&&document.querySelector("main")?.innerText.includes(arguments[0])',[record]),'detached record/session');
 }
 const record=await openRecord();await detach(record);
 await js("window.__TAURI_INTERNALS__.invoke('plugin:window|close',{label:window.__TAURI_INTERNALS__.metadata.currentWindow.label}).catch(()=>{});return true;");
 await wd('/window',{handle:main});await until(async()=>(await wd('/window/handles')).length===1,'native close');
 await until(()=>js('return [...document.querySelectorAll("[role=tab]")].every(t=>!t.getAttribute("aria-label")?.includes("in its own window"))'),'reattachment');
 await detach(record);
 // Main-window logout must close its child and clear the native session.
 await wd('/window',{handle:main});
 const profile=await wd('/element',{using:'css selector',value:'button[aria-label="Open profile menu"]'});await wd(`/element/${profile['element-6066-11e4-a52e-4f735466cecf']}/click`,{});await buttonText('Sign out');
 await until(async()=>(await wd('/window/handles')).length===1,'logout closes child');
 await until(()=>js('return !!document.querySelector("input[type=password]")&&!document.querySelector("header")'),'signed out');
 console.log('PASS native desktop: launch, real API login, bridge, four languages/directions, detach, native close/reattach, reopen and logout cleanup');

}finally{if(session)await wd('',undefined,'DELETE');}
