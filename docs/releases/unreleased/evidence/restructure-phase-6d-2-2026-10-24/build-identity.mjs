import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='demo-apps/school/.next',files=[];
function walk(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){if(['cache','diagnostics'].includes(entry.name))continue;const path=directory+'/'+entry.name;if(entry.isDirectory())walk(path);else files.push({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});}}
walk(root);files.sort((a,b)=>a.path.localeCompare(b.path));
writeFileSync('docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24/build-identity.json',JSON.stringify({buildId:readFileSync(root+'/BUILD_ID','utf8').trim(),scope:'Local production-mode school Next build used by the real-HTTP check; caches/diagnostics excluded. Not deployment or native execution.',files},null,2)+'\n');
console.log(`School build: ${files.length} artifact hashes`);
