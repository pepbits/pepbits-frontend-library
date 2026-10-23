import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const folder='docs/releases/unreleased/evidence/restructure-phase-6b-4-2026-10-23/';
const read=name=>JSON.parse(readFileSync(folder+name,'utf8'));
const final=JSON.parse(readFileSync('docs/releases/unreleased/manifest-restructure-phase-6b-4-2026-10-23.json','utf8'));
const ci=read('ci-source.json'),build=read('browser-build-source.json');
const sha=value=>createHash('sha256').update(value).digest('hex');
assert.ok(final.files.every(file=>sha(readFileSync(file.path))===file.sha256),'Final manifest matches working tree');
function changes(before,after){const old=new Map(before.map(file=>[file.path,file.sha256])),current=new Map(after.map(file=>[file.path,file.sha256]));return [...new Set([...old.keys(),...current.keys()])].filter(path=>old.get(path)!==current.get(path)).sort();}
const changesAfterCiStart=changes(ci.files,final.files);
assert.deepEqual(changesAfterCiStart,[]);
// Integration drivers do not enter the Next bundle. They are identified separately below.
const compiled=file=>(file.path.startsWith('packages/')||file.path.startsWith('demo-apps/healthcare/')||['package.json','package-lock.json','tsconfig.base.json'].includes(file.path))&&!file.path.endsWith('.md')&&!file.path.startsWith('demo-apps/healthcare/scripts/');
const buildInputs=final.files.filter(compiled),runtimeChanges=changes(build.files.filter(compiled),buildInputs);
assert.deepEqual(runtimeChanges,[]);
const drivers=final.files.filter(file=>file.path.startsWith('demo-apps/healthcare/scripts/'));
const report={base:final.baseCommit,ciImplementationDigest:ci.implementationDigest,finalImplementationDigest:final.implementationDigest,finalFiles:final.files.length,changesAfterCiStart,changeReason:'No implementation or indexed documentation changed after final forced CI started. The release record and evidence are excluded from the manifest to avoid self-reference.',browserBuild:{ciSource:'ci-source.json',snapshot:'browser-build-source.json',matchingBuildInputs:buildInputs.length,runtimeChanges,digest:sha(buildInputs.map(file=>file.path+'\0'+file.sha256+'\n').join(''))},finalIntegrationDrivers:drivers,manifestMatchesWorkingTree:true};
writeFileSync(folder+'source-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({finalFiles:report.finalFiles,finalImplementationDigest:report.finalImplementationDigest,matchingBuildInputs:buildInputs.length,changesAfterCiStart,runtimeChanges}));
