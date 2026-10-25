import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const folder=resolve(process.env.SCHOOL_VISUAL_EVIDENCE??join(root,'docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24'));
console.log(JSON.stringify({phase:'build-read-only-source-harness'}));
const harness=execFileSync(process.execPath,[join(root,'demo-apps/school/scripts/build-visual-harness.mjs')],{encoding:'utf8'}).trim();
console.log(JSON.stringify({phase:'paired-browser-comparison'}));
const browser=await chromium.launch({headless:true});
const errors=[],comparisons=[];
const interrupt=signal=>{errors.push(`Interrupted: ${signal}`);void browser.close();};
process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
const deadline=setTimeout(()=>interrupt('deadline'),1200000);deadline.unref();
const page=await browser.newPage({viewport:{width:1320,height:1000}}).catch(async error=>{await browser.close();rmSync(harness,{recursive:true,force:true});throw error;});
page.on('pageerror',error=>errors.push(error.message));
const snapshot=side=>page.evaluate(side=>{
 const root=document.querySelector('#'+side+' .reference-school-root'),origin=root.getBoundingClientRect();
 const selectors=['h1','h2','h3','button','input','select','table','th','td'];
 const counts=new Map(),items=[];
 for(const element of root.querySelectorAll(selectors.join(','))){
  if(!element.getClientRects().length)continue;
  const text=(element.getAttribute('aria-label')||element.textContent||element.getAttribute('placeholder')||element.getAttribute('type')||'').trim().replace(/\s+/g,' ').slice(0,100);
  const key=element.tagName+':'+text,occurrence=counts.get(key)??0;counts.set(key,occurrence+1);
  if(element.tagName==='TD'&&items.filter(item=>item.tag==='TD').length>=20)continue;
  const box=element.getBoundingClientRect(),css=getComputedStyle(element);
  items.push({key:key+':'+occurrence,tag:element.tagName,text,geometry:{x:+(box.x-origin.x).toFixed(2),y:+(box.y-origin.y).toFixed(2),width:+box.width.toFixed(2),height:+box.height.toFixed(2)},style:Object.fromEntries(['fontFamily','fontSize','fontWeight','lineHeight','color','backgroundColor','borderRadius','paddingTop','paddingRight','paddingBottom','paddingLeft'].map(key=>[key,css[key]]))});
 }
 const svgGeometry=svg=>({width:+svg.getBoundingClientRect().width.toFixed(2),height:+svg.getBoundingClientRect().height.toFixed(2),marks:[...svg.querySelectorAll('polyline,polygon,circle')].map(mark=>({tag:mark.tagName,points:mark.getAttribute('points'),r:mark.getAttribute('r'),strokeWidth:mark.getAttribute('stroke-width'),dash:mark.getAttribute('stroke-dasharray'),offset:mark.getAttribute('stroke-dashoffset'),stroke:getComputedStyle(mark).stroke,fill:getComputedStyle(mark).fill}))});
 const charts={lines:[...root.querySelectorAll('svg[viewBox="0 0 100 100"]')].map(svgGeometry),rings:[...root.querySelectorAll('svg')].filter(svg=>Number(svg.getAttribute('width'))>=50&&svg.querySelector('circle')).map(svgGeometry),bars:[...root.querySelectorAll('div[style]')].filter(element=>element.style.height.endsWith('%')).map(element=>({height:+element.getBoundingClientRect().height.toFixed(2),width:+element.getBoundingClientRect().width.toFixed(2),color:getComputedStyle(element).backgroundColor}))};
 return {root:{width:origin.width,height:origin.height,font:getComputedStyle(root).fontFamily},items,charts};
},side);
try{
 await page.goto(pathToFileURL(join(harness,'index.html')).href);
 await page.waitForFunction(()=>typeof window.renderParity==='function');
 await page.evaluate(()=>{const RealDate=Date;window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-10-24T12:00:00Z']));}static now(){return new RealDate('2026-10-24T12:00:00Z').getTime();}};});
 const routes=[...readFileSync(join(root,'demo-apps/school/src/modules/school/routes.ts'),'utf8').matchAll(/\{ path: "([^"]+)"/g)].map(match=>match[1].replace(':id',match[1].startsWith('/quizzes')?'qz-1':'lv-1'));
 const cases=[...routes.map(path=>({path,role:'admin'})),...['teacher','student','parent','librarian','accountant'].map(role=>({path:'/dashboard',role}))];
 const profiles=(process.env.SCHOOL_VISUAL_PROFILES??'all')==='all'?[['default',{}],['Arabic RTL',{language:'ar'}],['result-scale',{fontSizeResult:16}],['reduced-motion',{reducedMotion:true}]]:[['default',{}]];
 for(const [profile,preferences] of profiles){
  const catalog=JSON.parse(readFileSync(join(root,'mock-api/config/localization/shared',preferences.language==='ar'?'ar.json':'en.json'),'utf8')).messages;
  for(const {path,role} of cases){
   for(const side of ['source','demo']){
    await page.evaluate(async args=>window.renderParity(...args),[side,path,role,preferences,catalog]);
    await page.locator('#'+side+' .reference-school-root[data-role="'+role+'"]').waitFor();
    await page.waitForFunction(side=>{const root=document.querySelector('#'+side+' .reference-school-root');return root.textContent.length>120&&!/Opening your portal|Loading school data/.test(root.textContent)&&!root.querySelector('[aria-busy=true]');},side);
   }
   await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(150);
   const source=await snapshot('source'),demo=await snapshot('demo'),byKey=new Map(demo.items.map(item=>[item.key,item]));
   const differences=[],matched=[];
   for(const a of source.items){const b=byKey.get(a.key);if(!b)continue;const diff={};for(const group of ['geometry','style'])for(const key in a[group])if(typeof a[group][key]==='number'?Math.abs(a[group][key]-b[group][key])>.5:a[group][key]!==b[group][key])diff[group+'.'+key]={source:a[group][key],demo:b[group][key]};if(Object.keys(diff).length)differences.push({key:a.key,diff});else matched.push(a.key);}
   comparisons.push({path,role,profile,chartGeometry:{source:source.charts,demo:demo.charts,matching:Object.fromEntries(Object.keys(source.charts).map(key=>[key,JSON.stringify(source.charts[key])===JSON.stringify(demo.charts[key])]))},sourceElements:source.items.length,demoElements:demo.items.length,matchedElements:matched.length,differentElements:differences.length,unpairedElements:source.items.length-matched.length-differences.length,unpairedSource:source.items.filter(item=>!byKey.has(item.key)).map(item=>item.key),demoOnly:demo.items.filter(item=>!source.items.some(other=>other.key===item.key)).map(item=>item.key),differences});
   if(profile==='default'&&role==='admin'&&['/dashboard','/students'].includes(path))for(const side of ['source','demo'])await page.locator('#'+side).screenshot({path:join(folder,`visual-${path.slice(1)}-${side}.png`),animations:'disabled'});
   console.log(JSON.stringify({path,role,profile,matched:matched.length,different:differences.length}));
  }
 }
}catch(error){errors.push(error.message);throw error;}finally{
 clearTimeout(deadline);process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);
 await browser.close();
 const paths=execFileSync('git',['ls-files','desktop-clients/packages/reference-school','desktop-clients/packages/ops-ui','desktop-clients/packages/reference-host','desktop-clients/packages/erp-config','desktop-clients/packages/tokens'],{cwd:root,encoding:'utf8'}).trim().split('\n');
 const verificationFiles=['demo-apps/school/scripts/build-visual-harness.mjs','demo-apps/school/scripts/visual-parity.mjs','docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24/visual-harness.tsx'].map(path=>({path,sha256:createHash('sha256').update(readFileSync(join(root,path))).digest('hex')}));
 const sourceFiles=paths.map(path=>({path,sha256:createHash('sha256').update(readFileSync(join(root,path))).digest('hex')}));
 writeFileSync(join(folder,'visual-comparison.json'),JSON.stringify({generatedAt:new Date().toISOString(),scope:'Paired standalone page content from original read-only source and current demo; identical fictional in-memory fixtures, frozen clock and 1280px content width. This is not real HTTP or full-shell screenshot parity. Element metrics are diagnostics, not whole-page pixel acceptance.',sourceBase:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceFiles,verificationFiles,comparisons,errors,browserClosed:true},null,2)+'\n');
 rmSync(harness,{recursive:true,force:true});
}
if(errors.length)process.exitCode=1;
