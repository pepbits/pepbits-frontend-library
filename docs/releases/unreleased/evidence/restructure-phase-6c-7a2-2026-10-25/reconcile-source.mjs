import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const folder=new URL('./',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,folder),'utf8'));
const final=read('../../manifest-restructure-phase-6c-7a2-2026-10-25.json');
const compare=name=>{
 const prior=read(name),before=new Map(prior.files.map(file=>[file.path,file.sha256])),after=new Map(final.files.map(file=>[file.path,file.sha256]));
 const changed=[...new Set([...before.keys(),...after.keys()])].sort().filter(path=>before.get(path)!==after.get(path)).map(path=>({path,before:before.get(path)??null,after:after.get(path)??null}));
 assert.equal(prior.baseCommit,final.baseCommit);
 assert.ok(changed.every(file=>file.path.endsWith('.md')),'Runtime, test and driver source must remain identical after verification');
 return {receipt:name,digest:prior.implementationDigest,files:prior.files.length,changedSinceCheck:changed,runtimeTestsAndScriptsUnchanged:true};
};
const result={baseCommit:final.baseCommit,finalDigest:final.implementationDigest,finalFiles:final.files.length,ci:compare('ci-source.json'),browser:compare('browser-source.json'),reason:'Only documentation descriptions/status changed after the relevant check. Final documentation validation and boundary scans are separate receipts.'};
writeFileSync(new URL('source-reconciliation.json',folder),JSON.stringify(result,null,2)+'\n');
console.log(`Runtime/test/driver hashes unchanged; CI ${result.ci.changedSinceCheck.length} and browser ${result.browser.changedSinceCheck.length} documentation-only deltas; ${fileURLToPath(new URL('source-reconciliation.json',folder))}`);
