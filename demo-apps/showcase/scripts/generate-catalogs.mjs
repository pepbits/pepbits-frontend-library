import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),root=resolve(app,'../..');
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?(entry.name==='node_modules'||entry.name==='test'?[]:walk(resolve(dir,entry.name))):/\.(tsx?|json)$/.test(entry.name)&&!entry.name.includes('.test.')?[resolve(dir,entry.name)]:[]);
const source=[...walk(resolve(root,'packages')),...walk(resolve(app,'src/examples'))].filter(path=>!path.includes('/node_modules/')&&!path.includes('/test/')).map(path=>readFileSync(path,'utf8')).join('\n');
// Keep dynamic message families such as `lifecycle.status.${status}` intact.
const dynamicFamilies=['designer.','identity.','devices.','labels.'];
const dynamicPrefixes=[...new Set([...source.matchAll(/`([A-Za-z]\w*(?:\.[A-Za-z]\w*)+\.)\$\{/g)].map(match=>match[1]))];
const catalogs={};
for(const language of ['en','ar','hi','ml']) {
 const canonical=JSON.parse(readFileSync(resolve(root,`mock-api/config/localization/shared/${language}.json`),'utf8')).messages;
 catalogs[language]=Object.fromEntries(Object.entries(canonical).filter(([key])=>source.includes(key)||key.startsWith('catalog.')||[...dynamicPrefixes,...dynamicFamilies].some(prefix=>key.startsWith(prefix))));
}
writeFileSync(resolve(app,'src/generated/library-catalogs.json'),JSON.stringify(catalogs,null,2)+'\n');
console.log(`Canonical catalog subset: ${Object.keys(catalogs.en).length} keys × four languages`);
