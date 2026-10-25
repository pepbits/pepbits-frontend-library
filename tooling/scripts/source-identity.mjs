import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync,lstatSync,readlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
export function sourceIdentity(root){
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
 const paths=[...new Set(git('ls-files','--cached','--others','--exclude-standard','-z').split('\0').filter(Boolean))].filter(p=>!p.startsWith('docs/releases/')&&!p.startsWith('release/')).sort();
 const sha=b=>createHash('sha256').update(b).digest('hex');
 const files=paths.map(path=>{const full=join(root,path);if(!existsSync(full))return {path,deleted:true};return {path,sha256:sha(lstatSync(full).isSymbolicLink()?readlinkSync(full):readFileSync(full))};});
 return {baseCommit:git('rev-parse','HEAD').trim(),algorithm:'sha256 of JSON file entries sorted by path; deleted tracked paths explicit; excludes release evidence/output to avoid self-reference',digest:sha(JSON.stringify(files)),files};
}
