import {translationRevision} from './documentation-revisions.mjs';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync,chmodSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
const languages=['en','ar','hi','ml'];
const slug=/^[a-z0-9][a-z0-9.-]*$/;
export function validateDocumentation(content) {
 if(content?.schemaVersion!==1||!Array.isArray(content.releases)||!content.releases.length||!Array.isArray(content.changes))throw Error('Invalid documentation manifest');
 const releases=new Map();
 for(const release of content.releases){
  if(!slug.test(release.id)||releases.has(release.id)||!['release','patch'].includes(release.type)||!release.guides||typeof release.title!=='string'||!Array.isArray(release.pageIds)||!Array.isArray(release.knownIssues)||!/^\d{4}-\d{2}-\d{2}$/.test(release.date))throw Error('Invalid documentation release');
  for(const [id,guide] of Object.entries(release.guides)){
   if(id!==guide.pageId||!slug.test(id)||!Number.isInteger(guide.revision)||guide.revision<1||!['reference','authored'].includes(guide.status)||!Array.isArray(guide.sections)||!Array.isArray(guide.fields)||!Array.isArray(guide.tour))throw Error('Invalid page guide');
   const sections=new Set();for(const section of guide.sections){if(!slug.test(section.id)||sections.has(section.id)||typeof section.title!=='string'||!Array.isArray(section.paragraphs)||section.paragraphs.some(p=>typeof p!=='string'))throw Error('Invalid guide section');sections.add(section.id);}
   for(const step of guide.tour)if(!slug.test(step.target)||typeof step.title!=='string'||typeof step.text!=='string')throw Error('Invalid tour step');
  }
  releases.set(release.id,release);
 }
 for(const release of releases.values())if(release.type==='patch'&&(!releases.has(release.parentId)||release.parentId===release.id))throw Error('Invalid patch parent');
 const changes=new Set();
 for(const change of content.changes){const guide=releases.get(change.releaseId)?.guides[change.pageId];if(!slug.test(change.id)||changes.has(change.id)||!Number.isInteger(change.revision)||change.revision<1||!guide?.sections.some(s=>s.id===change.sectionId)||typeof change.requiresAcknowledgment!=='boolean')throw Error('Invalid change link');changes.add(change.id);}
 return content;
}
export function createDocumentationStore(file,configRoot,applicationConfig) {
 const content=validateDocumentation(JSON.parse(readFileSync(join(configRoot,'documentation/releases.json'),'utf8')));
 const availabilityPath=join(configRoot,'documentation/availability.json');
 const availability=existsSync(availabilityPath)?JSON.parse(readFileSync(availabilityPath,'utf8')):null;
 const productContent=new Map();
 const contentFor=product=>{if(!productContent.has(product)){const path=join(configRoot,'documentation','products',product,'releases.json');productContent.set(product,existsSync(path)?validateDocumentation(JSON.parse(readFileSync(path,'utf8'))):content);}return productContent.get(product);};
 const revisionPath=join(configRoot,'documentation/translation-revisions.json');
 const revisions=existsSync(revisionPath)?JSON.parse(readFileSync(revisionPath,'utf8')):{};
 const translations=JSON.parse(readFileSync(join(configRoot,'documentation/translations.json'),'utf8'));
 mkdirSync(dirname(file),{recursive:true,mode:0o700});const db=new DatabaseSync(file);chmodSync(file,0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS documentation_reading(tenant TEXT,product TEXT,owner TEXT,change_id TEXT,revision INTEGER,read_at TEXT,dismissed_at TEXT,acknowledged_at TEXT,PRIMARY KEY(tenant,product,owner,change_id,revision));`);
 const fail=(status,error)=>({status,body:{error}});
 const state=(user,product,change)=>db.prepare('SELECT read_at AS readAt,dismissed_at AS dismissedAt,acknowledged_at AS acknowledgedAt FROM documentation_reading WHERE tenant=? AND product=? AND owner=? AND change_id=? AND revision=?').get(user.tenantId,product,user.id,change.id,change.revision)??{readAt:null,dismissedAt:null,acknowledgedAt:null};
 function context(user,product,releaseId,language){
  if(!user)return fail(401,'Not signed in.');
  const nav=applicationConfig.navigation(user,product);if(nav.status!==200)return fail(nav.status,nav.error);
  if(!languages.includes(language))return fail(400,'Unsupported language.');
  const content=contentFor(product);
  const activeId=availability?.products?.[product]?.tenants?.[user.tenantId]??availability?.products?.[product]?.defaultReleaseId??availability?.defaultReleaseId??content.releases.at(-1).id;
  const activeIndex=content.releases.findIndex(r=>r.id===activeId);
  const release=content.releases.find(r=>r.id===releaseId);if(!release||activeIndex<0||content.releases.indexOf(release)>activeIndex)return fail(404,'Documentation version is unavailable.');
  const locale=applicationConfig.localization(user,product,language).body;
  const reverse=new Map(Object.entries(locale.fallbackMessages).map(([key,value])=>[value,key]));
  const missing=new Set();
  const text=value=>{if(!value||language==='en')return value;const translated=translations[language]?.[value]??locale.messages[value]??locale.messages[reverse.get(value)];if(translated===undefined||translated===value){if(/[a-zA-Z]{3}/.test(value))missing.add(value);return value;}return translated;};
  const pages=new Set(nav.body.pages.map(p=>p.id));
  const allowed=change=>pages.has(change.pageId)&&content.releases.findIndex(r=>r.id===change.releaseId)<=content.releases.indexOf(release)&&(!change.roles||change.roles.includes(user.role));
  return {release,pages,text,missing,allowed,content};
 }
 return {
  query(user,product,params){
   const language=params.get('language')??'en',releaseId=params.get('releaseId');const ctx=context(user,product,releaseId,language);if(ctx.status)return ctx;
   const {release,pages,text,missing,allowed,content}=ctx;
   const pageId=params.get('pageId');
   if(pageId){
    if(!pages.has(pageId))return fail(403,'Page is unavailable.');const guide=release.guides[pageId];if(!guide)return fail(404,'Documentation version is unavailable.');
    const translated={...guide,title:text(guide.title),sections:guide.sections.map(s=>({...s,title:text(s.title),paragraphs:s.paragraphs.map(text)})),fields:guide.fields.map(f=>({...f,label:text(f.label),help:text(f.help),rules:f.rules.map(text)})),tour:guide.tour.map(s=>({...s,title:text(s.title),text:text(s.text)})),requestedLanguage:language,language,...translationRevision(guide,language,text,revisions[product]?.[releaseId]??revisions.default?.[releaseId])};
    translated.language=missing.size?'mixed':language;
    return {status:200,body:{guide:translated,releaseId,contentHash:createHash('sha256').update(JSON.stringify(translated)).digest('hex')}};
   }
   const q=(params.get('q')??'').normalize('NFKC').toLocaleLowerCase().slice(0,200);
   const visible=Object.values(release.guides).filter(g=>pages.has(g.pageId));
   const guides=visible.map(g=>({pageId:g.pageId,module:g.module,title:text(g.title),status:g.status,search:[g.title,g.module,...g.sections.flatMap(s=>[s.title,...s.paragraphs])].map(text).join(' ').normalize('NFKC').toLocaleLowerCase()})).filter(g=>!q||g.search.includes(q)).map(({search,...g})=>g);
   const offset=Number(params.get('offset')??0);if(!Number.isSafeInteger(offset)||offset<0)return fail(400,'Invalid documentation request.');
   const changes=content.changes.filter(allowed).map(c=>({...c,title:text(c.title),summary:text(c.summary),...state(user,product,c)}));
   const releases=content.releases.slice(0,content.releases.indexOf(release)+1).filter(r=>r.pageIds.some(id=>pages.has(id))).map(({guides,...r})=>({...r,pageIds:r.pageIds.filter(id=>pages.has(id)),guidePageIds:Object.keys(guides).filter(id=>pages.has(id)),sections:(r.sections??[]).map(s=>({...s,title:text(s.title),paragraphs:s.paragraphs.map(text)})),title:text(r.title),summary:text(r.summary),knownIssues:r.knownIssues.map(text)})).reverse();
   return {status:200,body:{releaseId,language,pages:guides.slice(offset,offset+50),total:guides.length,nextOffset:offset+50<guides.length?offset+50:null,releases,changes,unread:changes.filter(c=>!c.readAt&&!c.dismissedAt).length}};
  },
  write(user,product,input){
   const ctx=context(user,product,input?.releaseId,'en');if(ctx.status)return ctx;
   const change=ctx.content.changes.find(c=>c.id===input?.changeId&&ctx.allowed(c));if(!change)return fail(404,'Change notice is unavailable.');
   if(input.revision!==change.revision)return fail(409,'Change notice changed. Reload before continuing.');
   if(!['read','dismiss','acknowledge'].includes(input.action)||input.action==='acknowledge'&&!change.requiresAcknowledgment)return fail(400,'Invalid documentation request.');
   const column={read:'read_at',dismiss:'dismissed_at',acknowledge:'acknowledged_at'}[input.action];
   // Each operation sets its own timestamp once. Dismiss and read never acknowledge.
   db.prepare(`INSERT INTO documentation_reading(tenant,product,owner,change_id,revision,${column}) VALUES(?,?,?,?,?,?) ON CONFLICT(tenant,product,owner,change_id,revision) DO UPDATE SET ${column}=COALESCE(${column},excluded.${column})`).run(user.tenantId,product,user.id,change.id,change.revision,new Date().toISOString());
   return {status:200,body:state(user,product,change)};
  },close(){db.close();}
 };
}
