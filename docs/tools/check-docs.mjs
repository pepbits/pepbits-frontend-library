/** Repository documentation contracts; no external services or runtime mutation. */
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname,relative,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function walk(directory){return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(resolve(directory,entry.name)):[resolve(directory,entry.name)]);}
function readJson(path,errors){try{return JSON.parse(readFileSync(path,'utf8'));}catch(error){errors.push(`${path}: ${error.message}`);return null;}}
export function checkLinks(repository,files){
 const errors=[];
 for(const file of files){
  const source=readFileSync(file,'utf8').replace(/```[\s\S]*?```/g,'');
  for(const match of source.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)){
   let target=match[1].trim();if(target.startsWith('<'))target=target.slice(1,target.indexOf('>'));
   if(/^(?:https?:|mailto:)/.test(target))continue;
   const [pathname,anchor]=target.split('#');
   let resolved;try{resolved=resolve(dirname(file),decodeURIComponent(pathname||'.'));if(!pathname)resolved=file;}catch{errors.push(`${file}: invalid URL ${target}`);continue;}
   if(relative(repository,resolved).startsWith('..'+sep)||relative(repository,resolved)==='..'){errors.push(`${file}: link escapes repository: ${target}`);continue;}
   if(!existsSync(resolved)){errors.push(`${file}: missing link target ${target}`);continue;}
   if(anchor&&extname(resolved)==='.md'){
    const headings=[...readFileSync(resolved,'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)].map(m=>m[1].toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').replace(/\s/g,'-'));
    if(!headings.includes(decodeURIComponent(anchor)))errors.push(`${file}: missing heading ${target}`);
   }
  }
 }
 return errors;
}
export function checkRelease(manifest){
 const errors=[];
 if(manifest.schemaVersion!==1)errors.push('release schemaVersion must be 1');
 for(const key of ['recordId','status','baseCommit','testGuideVersion','implementationDigest','digestAlgorithm','identityScope','evidence'])if(typeof manifest[key]!=='string'||!manifest[key])errors.push(`release missing ${key}`);
 if(!/^[a-f0-9]{40}$/.test(manifest.baseCommit??''))errors.push('release baseCommit must be a full SHA');
 if(!['unreleased-working-tree','candidate','published','failed'].includes(manifest.status))errors.push('invalid release status');
 if(typeof manifest.published!=='boolean'||typeof manifest.deployed!=='boolean')errors.push('release publication/deployment flags must be boolean');
 if(manifest.status==='unreleased-working-tree'&&(manifest.published||manifest.deployed))errors.push('unreleased working tree cannot claim publication/deployment');
 if(manifest.published&&(!/^[a-f0-9]{40}$/.test(manifest.commit??'')||!manifest.tag))errors.push('published record needs an actual commit and tag');
 if(manifest.deployed&&!manifest.deployment)errors.push('deployed record needs deployment identity');
 if(!Array.isArray(manifest.limits))errors.push('release must state limits');
 if(!Array.isArray(manifest.files)||!manifest.files.length)errors.push('release must identify implementation files');
 else{
  const seen=new Set();for(const file of manifest.files){if(!file.path||seen.has(file.path)||!/^[a-f0-9]{64}$/.test(file.sha256??''))errors.push('invalid/duplicate implementation hash entry');seen.add(file.path);}
  // The manifest records byte/code-point ordering, not locale-dependent ordering.
  const canonical=hash([...manifest.files].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0).map(file=>`${file.path}\0${file.sha256}\n`).join(''));
  if(canonical!==manifest.implementationDigest)errors.push('implementation digest does not match recorded entries');
 }
 return errors;
}
export async function validateDocumentation(repository=root){
 const errors=[],docs=resolve(repository,'docs'),files=walk(docs).filter(p=>extname(p)==='.md');
 files.push(...['AGENTS.md','README.md'].map(path=>resolve(repository,path)));
 errors.push(...checkLinks(repository,files));
 const current=readJson(resolve(docs,'testing/current.json'),errors);
 if(current){
  if(current.schemaVersion!==1||!/^\d+\.\d+\.\d+$/.test(current.documentVersion??''))errors.push('invalid testing pointer/version');
  for(const key of ['guide','inventory','cases','matrix']){
   if(typeof current[key]!=='string'||!current[key].startsWith(`v${current.documentVersion}/`)||!existsSync(resolve(docs,'testing',current[key])))errors.push(`invalid/missing current testing ${key}`);
  }
  if(current.inventory){
   const inventory=readJson(resolve(docs,'testing',current.inventory),errors);
   if(inventory){
    const {LIBRARY_PAGE_IDS}=await import(pathToFileURL(resolve(repository,'mock-api/contracts/erp-config/library-pages.ts')));
    const actual=inventory.routes?.map(route=>route.id)??[];
    if(inventory.schemaVersion!==1||inventory.documentVersion!==current.documentVersion)errors.push('inventory version differs from current guide');
    if(new Set(actual).size!==actual.length||JSON.stringify([...actual].sort())!==JSON.stringify([...LIBRARY_PAGE_IDS].sort()))errors.push('Library route inventory differs from current registered destinations');
    for(const path of [...(inventory.tests??[]),inventory.staticGate])if(!path||!existsSync(resolve(repository,path)))errors.push(`missing inventory test/gate ${path}`);
   }
  }
 }
 for(const path of walk(resolve(docs,'releases')).filter(path=>/manifest-.*\.json$/.test(path))){
  const manifest=readJson(path,errors);if(!manifest)continue;
  errors.push(...checkRelease(manifest).map(error=>`${relative(repository,path)}: ${error}`));
  if(!existsSync(resolve(dirname(path),manifest.evidence??'missing')))errors.push(`${path}: missing evidence document`);
  if(!existsSync(resolve(docs,`testing/v${manifest.testGuideVersion}/PRE-COMMIT.md`)))errors.push(`${path}: missing historical testing guide`);
 }
 for(const path of walk(resolve(docs,'releases')).filter(path=>path.endsWith('/evidence/results.json'))){
  const evidence=readJson(path,errors);if(!evidence)continue;
  if(evidence.schemaVersion!==1||!Array.isArray(evidence.runs))errors.push(`${path}: invalid evidence schema`);
  for(const run of evidence.runs??[]){
   if(!['passed','failed','blocked','not-run'].includes(run.status))errors.push(`${path}: invalid run status ${run.id}`);
   const artifact=resolve(dirname(path),run.artifact??'missing');
   if(!existsSync(artifact)||hash(readFileSync(artifact))!==run.artifactSha256)errors.push(`${path}: missing/changed evidence artifact ${run.id}`);
  }
 }
 return {errors,documents:files.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await validateDocumentation();
 if(result.errors.length){result.errors.forEach(error=>console.error(error));process.exitCode=1;}
 else console.log(`PASS ${result.documents} documentation files: local links/headings, current testing guide, Library inventory, release identity/status and retained evidence hashes`);
}
