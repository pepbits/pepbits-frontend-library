import {readFileSync,writeFileSync} from 'node:fs';
const folder='docs/releases/unreleased/evidence/restructure-phase-6e-7-2026-10-24';
const label=process.argv[2]??'final';
const log=readFileSync(`${folder}/ci-${label}.log`,'utf8').replace(/\x1b\[[0-9;]*m/g,'');
const counts=new Map();
for(const match of log.matchAll(/^(@[^\s:]+):test:\s+(Test Files|Tests)\s+(\d+) passed[^\n]*$/gm)){
 const row=counts.get(match[1])??{workspace:match[1]};row[match[2]==='Tests'?'tests':'files']=Number(match[3]);counts.set(match[1],row);
}
const workspaces=[...counts.values()].sort((a,b)=>a.workspace.localeCompare(b.workspace));
const tasks=log.match(/Tasks:\s+(\d+) successful, (\d+) total/),cached=log.match(/Cached:\s+(\d+) cached/);
if(!tasks||tasks[1]!==tasks[2]||cached?.[1]!=='0'||workspaces.length!==16||workspaces.some(row=>!row.tests||!row.files))throw new Error('Incomplete or cached CI; inspect the log');
const summary={label,command:'npm run ci -- --concurrency=1 --env-mode=loose',turboForce:true,tasks:{successful:Number(tasks[1]),total:Number(tasks[2]),cached:0},workspaces,totalTests:workspaces.reduce((sum,row)=>sum+row.tests,0),totalTestFiles:workspaces.reduce((sum,row)=>sum+row.files,0),toolingTests:19,typechecks:16,productionBuilds:{next:3,vite:1,native:0},healthcareReceiptTests:'Four assertions read the retained 6b-9 HTTP receipt; this run does not repeat healthcare HTTP acceptance.'};
writeFileSync(`${folder}/ci-summary.json`,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
