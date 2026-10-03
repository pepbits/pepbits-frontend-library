#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {PAGE_REGISTRY} from '../../desktop-clients/packages/erp-config/src/navigation.ts';
import {DOCUMENTATION_RELEASE} from '../../desktop-clients/packages/erp-config/src/documentation.ts';
import {assessReceipt} from './documentation-contracts.mjs';
import {digest,guideText,translationRevision} from '../../dummy-api/documentation-revisions.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url))), config=resolve(root,'dummy-api/config/documentation');
const read=p=>JSON.parse(readFileSync(p,'utf8')), write=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const manifestPath=resolve(root,'docs/documentation/impact.json');
const content=read(resolve(config,'releases.json')), release=content.releases.find(r=>r.id===DOCUMENTATION_RELEASE);
const locales=Object.fromEntries(['en','ar','hi','ml'].map(l=>[l,read(resolve(root,`dummy-api/config/localization/shared/${l}.json`)).messages]));
const translations=read(resolve(config,'translations.json'));
const reverse=new Map(Object.entries(locales.en).map(([k,v])=>[v,k]));
const translate=l=>text=>l==='en'?text:translations[l]?.[text]??locales[l][text]??locales[l][reverse.get(text)]??text;
const revisionsPath=resolve(config,'translation-revisions.json');
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]);
const families={
 'label-printing':['barcode-labels', 'specimen-labels', 'patient-wristbands', 'qr-library', 'payment-qr', 'batch-label-printing', 'printer-profiles'],
 'op-registration':['op-registration'],
 'clinic-billing':['billing-clinic','list-of-pages'], 'page-library':['list-of-pages'],
 'clinical-templates':['allyvora-patient-query','allyvora-patient-record','allyvora-patient-360','billing-clinic','clinical-triage','clinical-consultation','op-consultation','comprehensive-consultation','op-registration'],
 'clinical-triage':['clinical-triage'], 'clinical-consultation':['clinical-consultation'],
 'op-consultation':['op-consultation'], 'comprehensive-consultation':['comprehensive-consultation'],
};
const all=Object.keys(PAGE_REGISTRY).sort();
function affected(path){
 const referencePackage=path.match(/^desktop-clients\/packages\/reference-(host|reports|erp1|erp2|school|healthcare-suite|keystone-core|diagnostics|lis1|lis2|ris1|teleconsult|quality|pharmacy|tenant-admin|medband|rcm|surgisuite|medslot)\//)?.[1];
 if(referencePackage)return Object.values(PAGE_REGISTRY).filter(page=>referencePackage==='host'?String(page.module).startsWith('reference-'):referencePackage==='diagnostics'?['reference-lis1','reference-lis2','reference-ris1'].includes(String(page.module)):referencePackage==='teleconsult'?['reference-teleconsult-provider','reference-teleconsult-patient'].includes(String(page.module)):referencePackage==='keystone-core'?['reference-erp1','reference-erp2'].includes(String(page.module)):page.module==='reference-'+referencePackage).map(page=>page.id).sort();
 if(path.includes('dcp-designer')||path.includes('dcp-catalog')||path.includes('dcp-rules')||path.includes('dcp-lifecycle')||path.includes('dcp-host')||path.includes('dcp-runtime')||path.includes('/imports/workbook-options')||path.includes('/imports/csv-options'))return ['dcp-designer'];
 if(path.includes('identity-devices')||path.includes('identity-device-store'))return ['identity-card-readers', 'passport-scanner', 'patient-biometric-verification'];

 if(path.includes('device-integrations')||path.includes('device-integration-store')||path.includes('scanner-input'))return ['device-integrations', 'scanner-workbench', 'device-automation'];

 if(path.includes('label-printing'))return ['barcode-labels', 'specimen-labels', 'patient-wristbands', 'qr-library', 'payment-qr', 'batch-label-printing', 'printer-profiles'];
 if(path==='dummy-api/op-registration-store.ts'||path.includes('/op-registration/')||path.endsWith('/op-registration.ts'))return ['op-registration'];
 for(const [family,pages] of Object.entries(families))if(path.includes(`/erp-screens/src/${family}/`))return pages;
 // Shared UI, adapters, configuration and unmapped renderers conservatively affect every page.
 return ["*"];
}
function sources(){return [...walk(resolve(root,'dummy-api/config/dcp-designer')).map(p=>relative(root,p)),...walk(resolve(root,'dummy-api/config/identity-devices')).map(p=>relative(root,p)),...walk(resolve(root,'dummy-api/config/device-integrations')).map(p=>relative(root,p)),...walk(resolve(root,'dummy-api/config/label-printing')).map(p=>relative(root,p)),'dummy-api/op-registration-store.ts',...walk(resolve(root,'dummy-api/config/op-registration')).map(p=>relative(root,p)),...['tokens','erp-screens','erp-shell','erp-config','erp-data','ops-ui','platform-ports','reference-host','reference-reports','reference-erp1','reference-erp2','reference-school','reference-healthcare-suite','reference-keystone-core','reference-diagnostics','reference-lis1','reference-lis2','reference-ris1','reference-teleconsult','reference-quality','reference-pharmacy','reference-tenant-admin','reference-medband','reference-rcm','reference-surgisuite','reference-medslot'].flatMap(pkg=>walk(resolve(root,`desktop-clients/packages/${pkg}/src`))).filter(p=>/\.(tsx?|css)$/.test(p)&&!/(\.test\.|\/locales\/|messages.en.ts)/.test(p)).map(p=>relative(root,p)), ...['web','desktop'].flatMap(app=>walk(resolve(root,`desktop-clients/apps/${app}/src`))).filter(p=>/\.(tsx?|css)$/.test(p)&&!p.includes('.test.')).map(p=>relative(root,p)), ...readdirSync(resolve(root,'dummy-api')).filter(p=>p.endsWith('.mjs')&&!p.includes('.test.')).map(p=>'dummy-api/'+p), ...['en','ar','hi','ml'].map(l=>`dummy-api/config/localization/shared/${l}.json`), ...walk(resolve(root,'dummy-api/config/navigation')).map(p=>relative(root,p))];}
const hashFile=p=>createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex');
const command=process.argv[2]??'check';
if(command==='snapshot'){
 const reason=process.argv[3];if(!reason?.trim())throw Error('Provide a reviewable impact explanation');
 const previous=existsSync(manifestPath)?read(manifestPath):null;
 const receipts={...previous?.receipts};
 for(const p of sources())if(receipts[p]?.sha256!==hashFile(p)||JSON.stringify(receipts[p]?.pages)!==JSON.stringify(affected(p)))receipts[p]={sha256:hashFile(p),pages:affected(p),disposition:'no-content-impact',reason};
 for(const p of Object.keys(receipts))if(!existsSync(resolve(root,p)))receipts[p]={...receipts[p],removed:true,reason};
 write(manifestPath,{schemaVersion:1,releaseId:DOCUMENTATION_RELEASE,registeredPages:previous?.registeredPages??all,legacyReferences:previous?.legacyReferences??Object.values(release.guides).filter(g=>g.status==='reference').map(g=>g.pageId),receipts});
 console.log('Impact receipts updated. Review affected pages and change disposition to updated with guideHashes when guide content changed. A receipt is not human approval.');
}else if(command==='receipt'){
 const p=process.argv[3],disposition=process.argv[4],reason=process.argv[5];
 if(!sources().includes(p)||!['updated','no-content-impact'].includes(disposition)||!reason?.trim())throw Error('Supply a tracked source path, updated/no-content-impact, and a reason');
 const manifest=read(manifestPath),pages=affected(p);
 manifest.receipts[p]={sha256:hashFile(p),pages,disposition,reason,...(disposition==='updated'?{guideHashes:Object.fromEntries((pages.includes('*')?all:pages).map(id=>[id,digest(release.guides[id])]))}:{})};
 write(manifestPath,manifest);console.log('Reviewable receipt recorded for '+p);
}else if(command==='packet'){
 const guide=release.guides[process.argv[3]],lang=process.argv[4];
 if(!guide||!['ar','hi','ml'].includes(lang))throw Error('Supply a page ID and ar, hi or ml');
 console.log(JSON.stringify({releaseId:DOCUMENTATION_RELEASE,pageId:guide.pageId,language:lang,...translationRevision(guide,lang,translate(lang)),text:guideText(guide).map(source=>({source,translation:translate(lang)(source)}))},null,2));
}else if(command==='translations'){
 const data=existsSync(revisionsPath)?read(revisionsPath):{};data.default??={};data.default[DOCUMENTATION_RELEASE]??={};
 for(const guide of Object.values(release.guides)){
 const page=data.default[DOCUMENTATION_RELEASE][guide.pageId]??={};
 for(const lang of ['ar','hi','ml'])if(!page[lang]){const state=translationRevision(guide,lang,translate(lang));page[lang]={sourceHash:state.sourceHash,translationHash:state.translationHash,reviewer:null,reviewedAt:null};}
 }
 write(revisionsPath,data);console.log('Missing translation baselines registered as pending. Existing stale/reviewed records were not overwritten.');
 }else if(command==='translation-sync'){
 const id=process.argv[3],lang=process.argv[4],guide=release.guides[id];
 if(!guide||!['ar','hi','ml'].includes(lang))throw Error('Supply a registered page ID and ar, hi or ml');
 const data=existsSync(revisionsPath)?read(revisionsPath):{};data.default??={};data.default[DOCUMENTATION_RELEASE]??={};data.default[DOCUMENTATION_RELEASE][id]??={};
 const state=translationRevision(guide,lang,translate(lang));
 if(state.translationStatus!=='current')throw Error('Complete all translated titles, sections, fields and tours before synchronizing');
 data.default[DOCUMENTATION_RELEASE][id][lang]={sourceHash:state.sourceHash,translationHash:state.translationHash,reviewer:null,reviewedAt:null,reviewEvidence:null};
 write(revisionsPath,data);console.log('Translation synchronized; native review remains pending.');
}else if(command==='register'){
 const id=process.argv[3],nextId=process.argv[4],page=PAGE_REGISTRY[id];if(!page)throw Error('Register the page in PAGE_REGISTRY first');if(release.guides[id])throw Error('Page already has a guide');
 if(!/^[a-z0-9][a-z0-9.-]*$/.test(nextId??'')||content.releases.some(r=>r.id===nextId))throw Error('Provide a unique new release ID');
 const guide=read(resolve(root,'docs/documentation/page-guide.template.json'));Object.assign(guide,{pageId:id,module:page.module,title:page.title});
 const next={...structuredClone(release),id:nextId,parentId:release.id,type:'patch',version:nextId,date:new Date().toISOString().slice(0,10),title:page.title,summary:'New page documentation draft',pageIds:[id],knownIssues:['Page guide authoring and translation review pending.']};next.guides[id]=guide;content.releases.push(next);
 write(resolve(config,'releases.json'),content);
 const availability=read(resolve(config,'availability.json'));availability.defaultReleaseId=nextId;write(resolve(config,'availability.json'),availability);
 const pointer=resolve(root,'desktop-clients/packages/erp-config/src/documentation.ts');writeFileSync(pointer,readFileSync(pointer,'utf8').replace(DOCUMENTATION_RELEASE,nextId));
 console.log('Draft registered in new snapshot '+nextId+'. Complete the sections and translations, then mark authored after workflow review. CI rejects an unfinished new page.');
}else if(command==='check'||command==='report'){
 const manifest=read(manifestPath), errors=[];
 for(const id of all){const guide=release.guides[id];if(!guide)errors.push(`${id}: missing documentation registration`);else if(!manifest.legacyReferences.includes(id)){if(guide.status!=='authored')errors.push(`${id}: new page needs authored documentation`);if(!guide.sections.length||guide.sections.some(s=>!s.paragraphs.length))errors.push(`${id}: empty guide sections`);}}
 const template=read(resolve(root,'docs/documentation/page-guide.template.json'));
 const placeholders=new Set(template.sections.flatMap(s=>s.paragraphs));
 const sourceText=sources().filter(p=>/\.tsx?$/.test(p)).map(p=>readFileSync(resolve(root,p),'utf8')).join('\n');
 for(const id of all.filter(id=>!manifest.registeredPages?.includes(id))){
 const guide=release.guides[id];if(!guide)continue;
 for(const section of template.sections)if(!guide.sections.some(s=>s.id===section.id))errors.push(`${id}: missing required section ${section.id}`);
 if(guide.sections.some(s=>s.paragraphs.some(p=>placeholders.has(p))))errors.push(`${id}: scaffold placeholders require authoring`);
 for(const step of guide.tour)if(!sourceText.includes(`data-tour="${step.target}"`)&&!sourceText.includes(`data-tour='${step.target}'`))errors.push(`${id}: tour target ${step.target} has no static source anchor; add a stable data-tour hook`);
 }
 for(const p of sources()){const error=assessReceipt(manifest.receipts[p],hashFile(p),affected(p),release.guides);if(error)errors.push(`${p}: ${error}`);}
 for(const p of Object.keys(manifest.receipts))if(!existsSync(resolve(root,p))&&(!manifest.receipts[p].removed||!manifest.receipts[p].reason?.trim()))errors.push(`${p}: removed source requires impact review`);
 const base=process.env.DOCS_BASE_SHA||'HEAD';
 if(!/^0+$/.test(base)){
  const prior=JSON.parse(execFileSync('git',['show',`${base}:dummy-api/config/documentation/releases.json`],{cwd:root,encoding:'utf8',maxBuffer:50*1024*1024}));
  for(const old of prior.releases)if(digest(old)!==digest(content.releases.find(r=>r.id===old.id)))errors.push(`${old.id}: historical release changed; create a new snapshot`);
 }
 const revisions=existsSync(revisionsPath)?read(revisionsPath):{};
 const backlog=[];
 for(const guide of Object.values(release.guides)){
 if(guide.status==='reference')backlog.push({pageId:guide.pageId,issue:'domain workflow authoring required'});
 for(const lang of ['ar','hi','ml']){
 const record=revisions.default?.[DOCUMENTATION_RELEASE]?.[guide.pageId]?.[lang];
 const state=translationRevision(guide,lang,translate(lang),revisions.default?.[DOCUMENTATION_RELEASE]);
 if(!record)errors.push(`${guide.pageId}/${lang}: missing translation revision`);
 else if(state.translationStatus==='outdated')errors.push(`${guide.pageId}/${lang}: outdated translation; update content and revision record`);
 if(state.reviewStatus!=='reviewed'||state.translationStatus!=='current')backlog.push({pageId:guide.pageId,language:lang,issue:state.translationStatus,review:state.reviewStatus,sourceHash:state.sourceHash,translationHash:state.translationHash});
 }
 }
 if(command==='report'){write(resolve(root,'docs/documentation/backlog.json'),backlog);console.log(`${backlog.length} authoring/translation review entries written`);}
 else{if(process.argv.includes('--strict')&&backlog.length)errors.push(`${backlog.length} authoring/native review items block strict release acceptance`);if(errors.length)throw Error(errors.join('\n'));console.log(`PASS documentation impact receipts, ${all.length} page registrations and translation revisions; ${backlog.length} authoring/review items remain explicitly pending`);}
}else throw Error('Use check, report, snapshot <reason>, translations, or register <page-id>');
