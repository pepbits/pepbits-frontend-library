import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const folder='docs/releases/unreleased/evidence/restructure-phase-6b-3-2026-10-23';
const protectedPaths=['desktop-clients','dummy-api','Jenkinsfile','deploy','run.sh','run_all.sh','.github'];
function run(command){const r=spawnSync(command[0],command.slice(1),{encoding:'utf8'});return {command,exitCode:r.status,stdout:r.stdout,stderr:r.stderr};}
const checks=[
 run(['git','diff','--stat','HEAD','--',...protectedPaths]),
 run(['git','status','--short','--',...protectedPaths]),
 run(['git','diff','--check']),
 run(['grep','-rnE','@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-client|ai-config|ai-ui|reference-)|desktop-clients|/src/','demo-apps/healthcare/src']),
];
const sensitive=run(['grep','-rnP',String.raw`https?://(?!localhost|127\.0\.0\.1|www\.w3\.org)[a-z0-9.-]+\.[a-z]{2,}|Bearer [A-Za-z0-9]{10}|password\s*[:=]\s*['"][^'"]{4,}`,'demo-apps/healthcare/src',folder]);
const matches=sensitive.stdout.trim().split('\n').filter(Boolean).map(line=>{
 const [,path,number,content]=line.match(/^(.+?):(\d+):(.*)$/);
 let justification;
 if(path.endsWith('/styles.css')&&path.startsWith('demo-apps/healthcare/src/modules/'))justification='Preserved upstream CSS license/browser-fix comment; no network request';
 else if(path.endsWith('/integration/console/page.tsx')&&content.includes('loinc.org'))justification='FHIR coding-system identifier in a synthetic message; not a transport URL';
 else if(content.includes('nextjs.org'))justification='Next.js diagnostic documentation link in build output; not an application request';
 else if(content.includes('turbo.build')||content.includes('turborepo.com'))justification='Turbo diagnostic documentation link in CI output; not an application request';
 else if(content.includes('react.dev'))justification='React diagnostic documentation link in retained test output; not an application request';
 else if(content.includes('testing-library.com'))justification='Testing Library diagnostic documentation link in retained test output; not an application request';
 else throw new Error('Unreviewed scan match at '+path+':'+number);
 return {path,line:Number(number),sha256:createHash('sha256').update(content).digest('hex'),justification};
});
const categories={};for(const m of matches)categories[m.justification]=(categories[m.justification]??0)+1;
const report={checks,sensitiveAndExternalScan:{command:sensitive.command,exitCode:sensitive.exitCode,stderr:sensitive.stderr},matchedLines:matches.length,categories,matches};
writeFileSync(folder+'/boundary-scans.json',JSON.stringify(report,null,2)+'\n');
if(checks.some((check,i)=>check.stdout||check.stderr||check.exitCode!==(i===3?1:0)))throw new Error('Boundary check failed');
console.log(JSON.stringify({protectedPaths:'unchanged',forbiddenImports:0,matchedLines:matches.length,categories}));
