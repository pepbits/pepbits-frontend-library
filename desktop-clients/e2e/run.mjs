#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {startApi} from './managed-api.mjs';
import {suites, validateSuites} from './suites.mjs';
const directory=fileURLToPath(new URL('.',import.meta.url));
validateSuites(readdirSync(directory));
const group=process.argv[2]??'browser';
if(group==='--check'){console.log(`PASS ${Object.values(suites).flat().length} suites registered in ${Object.keys(suites).length} runtime groups`);process.exit(0);}
if(!Object.hasOwn(suites,group))throw new Error(`Unknown suite group ${group}`);
const isolated=group!=='browser';
const env={...process.env,
 E2E_API:process.env.E2E_API??`http://127.0.0.1:${isolated?3330:3200}`,
 E2E_DESKTOP:process.env.E2E_DESKTOP??`http://127.0.0.1:${isolated?3109:3101}`,
};
const only=process.argv.find(arg=>arg.startsWith("--suite="))?.slice(8);
if(only&&!suites[group].includes(only))throw new Error(`Suite ${only} does not belong to ${group}`);
const selected=only?[only]:suites[group];
// Five minutes per suite, except sweeps whose length grows with the registry (184 reference pages and counting).
const SUITE_TIMEOUT_MS={'reference-modules.mjs':900000};
let failed=0;
for(const suite of selected){
 let stop;
 try{
 if(process.argv.includes("--managed-api")||process.env.E2E_MANAGED_API==="1")stop=await startApi(env.E2E_API,suite);execFileSync(process.execPath,[fileURLToPath(new URL(suite,import.meta.url))],{stdio:'inherit',env,timeout:SUITE_TIMEOUT_MS[suite]??300000});}
 catch(error){failed++;console.error(`FAIL ${group}/${suite}: ${error.message}`);}
 finally{await stop?.();}
}
console.log(`${selected.length-failed}/${selected.length} ${group} suites passed`);
process.exitCode=failed?1:0;
