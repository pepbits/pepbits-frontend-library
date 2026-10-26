// Phase 8 retired the original workspace. Audit immutable Git objects, never its old filesystem path.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
export const sourceCommit='3558a131f0fd443693eae0dfc678e3b258b480c1';
export function readHistoricalSource(path){
 if(!path.startsWith('desktop-clients/packages/'))throw Error('Expected a historical package source path');
 return execFileSync('git',['show',`${sourceCommit}:${path}`],{maxBuffer:16*1024*1024});
}
export function writeAudit(name,receipt){
 if(!process.argv[2])throw Error('Pass a new output directory; run from the repository root. Dated evidence is never overwritten.');
 const folder=resolve(process.argv[2]);mkdirSync(folder,{recursive:true});
 writeFileSync(join(folder,name),JSON.stringify({sourceCommit,...receipt},null,2)+'\n',{flag:'wx'});
}
