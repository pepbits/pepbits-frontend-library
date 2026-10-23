import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir='docs/releases/unreleased/evidence/restructure-phase-4c-2026-10-23';
const log=readFileSync(`${dir}/ci.log`,'utf8');
assert.match(log,/Tasks:\s+27 successful, 27 total/);assert.match(log,/Cached:\s+0 cached, 27 total/);assert.match(log,/# pass 19/);
const workspaces={};
for(const line of log.split('\n')){
 let m=line.match(/^(@[^:]+):test:\s+Test Files\s+(\d+) passed \((\d+)\)/);if(m){assert.equal(m[2],m[3]);(workspaces[m[1]]??={files:[]}).testFiles=Number(m[2]);}
 m=line.match(/^(@[^:]+):test:\s+Tests\s+(\d+) passed \((\d+)\)/);if(m){assert.equal(m[2],m[3]);(workspaces[m[1]]??={files:[]}).tests=Number(m[2]);}
 m=line.match(/^(@[^:]+):test:\s+✓ (src\/\S+) \((\d+) tests?\)/);if(m)(workspaces[m[1]]??={files:[]}).files.push({path:m[2],tests:Number(m[3])});
}
assert.equal(Object.keys(workspaces).length,13);
for(const [name,result] of Object.entries(workspaces)){assert.equal(result.files.length,result.testFiles,name);assert.equal(result.files.reduce((n,f)=>n+f.tests,0),result.tests,name);}
const totals={tests:Object.values(workspaces).reduce((n,r)=>n+r.tests,0),testFiles:Object.values(workspaces).reduce((n,r)=>n+r.testFiles,0),typechecks:13,builds:1,toolingTests:19,tasks:27,cached:0};
writeFileSync(`${dir}/ci-results.json`,JSON.stringify({source:'ci.log',scope:'Parsed final forced local run; tooling and shell browser tests are separate.',totals,workspaces},null,2)+'\n');
const inventory=JSON.parse(readFileSync(`${dir}/test-port-inventory.json`,'utf8'));
for(const entry of inventory.entries){const [,area,...parts]=entry.destination.split('/');const result=workspaces['@pepbits/'+area].files.find(f=>f.path===parts.join('/'));assert.ok(result,entry.destination);entry.destinationCases=result.tests;assert.ok(result.tests>=entry.sourceCases);}
writeFileSync(`${dir}/test-port-inventory.json`,JSON.stringify(inventory,null,2)+'\n');
console.log(JSON.stringify(totals));
