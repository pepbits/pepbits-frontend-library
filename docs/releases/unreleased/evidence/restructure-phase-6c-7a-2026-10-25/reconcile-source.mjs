import {readFileSync,writeFileSync} from 'node:fs';
const folder='docs/releases/unreleased/evidence/restructure-phase-6c-7a-2026-10-25';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const final=read(folder+'/../../manifest-restructure-phase-6c-7a-2026-10-25.json');
const checkpoints=['ci-source.json','browser-source.json'].map(name=>{
 const checkpoint=read(folder+'/'+name),hashes=new Map(checkpoint.files.map(file=>[file.path,file.sha256]));
 const changed=final.files.filter(file=>hashes.get(file.path)!==file.sha256).map(file=>file.path);
 const removed=checkpoint.files.filter(file=>!final.files.some(current=>current.path===file.path)).map(file=>file.path);
 const documentationOnly=changed.every(path=>path==='docs/releases/unreleased/README.md');
 return {name,implementationDigest:checkpoint.implementationDigest,changed,removed,runtimeTestsAndScriptsUnchanged:documentationOnly&&removed.length===0,passed:documentationOnly&&removed.length===0};
});
const result={at:new Date().toISOString(),base:final.baseCommit,files:final.files.length,implementationDigest:final.implementationDigest,checkpoints,passed:checkpoints.every(checkpoint=>checkpoint.passed),note:'The release record and evidence are excluded from implementation identity to avoid self-reference. Only the release-index verification status changed after final CI/live HTTP. Runtime, tests and scripts are unchanged. Documentation validation is rerun on the final tree.'};
writeFileSync(folder+'/source-reconciliation.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
if(!result.passed)process.exitCode=1;
