// Protected-path, forbidden-import and URL/credential scans for phase 6e-2. Run from the worktree root; writes boundary-scans.json.
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const evidence='docs/releases/unreleased/evidence/restructure-phase-6e-2-2026-10-24';
const protectedPaths=['desktop-clients','dummy-api','Jenkinsfile','deploy','run.sh','run_all.sh','.github'];
const git=args=>execFileSync('git',args,{encoding:'utf8'});
const grep=args=>{const r=spawnSync('grep',args,{encoding:'utf8'});return r.stdout.split('\n').filter(Boolean);};
const forbidden=grep(['-rnE','@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-client|ai-config|ai-ui|reference-)|desktop-clients|/src/|demo-apps/(healthcare|erp|school)','demo-apps/tenant-admin/src']);
const urlPattern='https?://(?!localhost|127\\.0\\.0\\.1|www\\.w3\\.org)[a-z0-9.-]+\\.[a-z]{2,}|Bearer [A-Za-z0-9]{10}|password\\s*[:=]\\s*[\'"][^\'"]{4,}';
const matches=grep(['-rnP',urlPattern,'demo-apps/tenant-admin/src',evidence]);
const reason=line=>{
 if(/styles\.css:\d+:/.test(line))return 'Upstream Tailwind 3 preflight license/compatibility comment inside the byte-identical generated stylesheet; not loaded or requested.';
 if(/test-utils\.tsx:\d+:.*https:\/\/host\.test/.test(line))return 'Original fake-transport base for parsing module-relative paths in tests; reserved .test domain, never requested.';
 if(/\.log:\d+:.*https:\/\/react\.dev\/link\//.test(line))return 'Public React diagnostic link printed by an existing test warning in a retained CI log; documentation, not an endpoint.';
 if(/check-boundaries\.mjs:/.test(line))return 'The scanner\'s own pattern literal.';
 return 'UNEXPLAINED';
};
const urlMatches=matches.map(line=>{const [path,number]=line.split(':');return {path,line:Number(number),lineSha256:createHash('sha256').update(line.slice(path.length+number.length+2)).digest('hex'),reason:reason(line)};});
const result={time:new Date().toISOString(),base:git(['rev-parse','HEAD']).trim(),
 protectedDiff:git(['diff','--stat','HEAD','--',...protectedPaths]).trim(),protectedStatus:git(['status','--short','--',...protectedPaths]).trim(),
 forbiddenImportMatches:forbidden,urlCredentialMatches:urlMatches,unexplained:urlMatches.filter(m=>m.reason==='UNEXPLAINED').length,
 whitespace:spawnSync('git',['diff','--check','HEAD'],{encoding:'utf8'}).stdout.trim()};
writeFileSync(evidence+'/boundary-scans.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({protectedDiff:result.protectedDiff.length,protectedStatus:result.protectedStatus.length,forbidden:forbidden.length,urlMatches:urlMatches.length,unexplained:result.unexplained,whitespace:result.whitespace.length}));
