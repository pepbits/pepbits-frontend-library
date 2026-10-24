import {readFileSync,writeFileSync} from 'node:fs';
const folder='docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24';
const log=readFileSync(folder+'/'+(process.argv[2]??'ci-verified.log'),'utf8').replace(/\x1b\[[0-9;]*m/g,'');
const workspaces={};
for(const line of log.split('\n')){
 let m=line.match(/^([^ ]+):test:.*Test Files\s+(\d+) passed/);if(m)(workspaces[m[1]]??={}).files=Number(m[2]);
 m=line.match(/^([^ ]+):test:.*Tests\s+(\d+) passed/);if(m)(workspaces[m[1]]??={}).tests=Number(m[2]);
 m=line.match(/^([^ ]+):test:.*maxWorkers=(\d+)/);if(m)(workspaces[m[1]]??={}).maxWorkers=Number(m[2]);
}
const tests=Object.values(workspaces).reduce((sum,row)=>sum+row.tests,0),files=Object.values(workspaces).reduce((sum,row)=>sum+row.files,0);
const summary={workspaces,tests,files,tasks:log.match(/Tasks:\s+(.+)/)?.[1]?.trim(),cached:log.match(/Cached:\s+(.+)/)?.[1]?.trim(),toolingTests:log.match(/# tests (\d+)/)?.[1],typechecks:[...new Set([...log.matchAll(/^([^ ]+):typecheck:.*\btsc\b/gm)].map(m=>m[1]))],builds:[...new Set([...log.matchAll(/^([^ ]+):build:.*\bnext build\b/gm)].map(m=>m[1]))]};
writeFileSync(folder+'/ci-summary.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
