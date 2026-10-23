import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url),paths=[];
function walk(prefix=''){for(const entry of readdirSync(new URL(prefix,root),{withFileTypes:true})){const path=prefix+entry.name;if(entry.isDirectory())walk(path+'/');else if(path!=='evidence-files.json')paths.push(path);}}
walk();
const files=paths.sort().map(path=>{const bytes=readFileSync(new URL(path,root));return {path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};});
writeFileSync(new URL('evidence-files.json',root),JSON.stringify({scope:'Retained phase 6b-7 evidence; excludes this index to avoid self-reference',files},null,2)+'\n');console.log(files.length+' retained artifacts indexed.');
