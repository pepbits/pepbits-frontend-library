import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {suites,validateSuites} from '../suites.mjs';
import {assertApiTarget} from '../harness.mjs';
test('every suite declares a runtime; native suites never join the browser group',()=>{
 const files=readdirSync(new URL('..',import.meta.url));
 assert.doesNotThrow(()=>validateSuites(files));
 assert.throws(()=>validateSuites([...files,'forgotten.mjs']),/unregistered/);
 assert.throws(()=>validateSuites(files.filter(file=>file!=='records.mjs')),/missing/);
 assert.ok(!suites.browser.some(file=>suites.native.includes(file)));
});
test('authentication refuses a different backend before submitting credentials',()=>{
 assert.doesNotThrow(()=>assertApiTarget('http://127.0.0.1:3330/auth/login','http://127.0.0.1:3330'));
 assert.doesNotThrow(()=>assertApiTarget('http://127.0.0.1:3330/reference-modules/quality/auth/me','http://127.0.0.1:3330'));
 assert.throws(()=>assertApiTarget('http://127.0.0.1:3330/reference-modules/quality/auth/login','http://127.0.0.1:3330'),/API target mismatch/);
 assert.throws(()=>assertApiTarget('https://other.example/api/reference-modules/quality/auth/me','http://127.0.0.1:3330'),/API target mismatch/);
 assert.throws(()=>assertApiTarget('https://desktop.front-design.pepbits.com/api/auth/login','http://127.0.0.1:3330'),/API target mismatch/);
});
test('SurgiSuite identity reads use only the exact host API namespace',()=>{
 const base='http://127.0.0.1:32979/api';
 const identity=base+'/reference-modules/surgisuite/api/auth/me';
 assert.doesNotThrow(()=>assertApiTarget(identity,base,'GET'));
 assert.doesNotThrow(()=>assertApiTarget(identity+'?locale=en',base+'/','GET'));
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.throws(()=>assertApiTarget(identity,base,method),/API target mismatch/);
 for(const url of [
  'https://other.example/api/reference-modules/surgisuite/api/auth/me',
  'http://127.0.0.1:32979/other/reference-modules/surgisuite/api/auth/me',
  'http://127.0.0.1:32979/api2/reference-modules/surgisuite/api/auth/me',
  identity.replace('/auth/me','/auth/login'),
  identity.replace('/auth/me','/auth/logout'),
  identity.replace('surgisuite','unregistered'),
  identity+'/extra',
  identity.replace('http://','http://untrusted:password@'),
 ])assert.throws(()=>assertApiTarget(url,base,'GET'),/API target mismatch/);
 assert.doesNotThrow(()=>assertApiTarget(base+'/auth/login',base,'POST'));
 assert.throws(()=>assertApiTarget(base+'/reference-modules/quality/auth/me',base,'POST'),/API target mismatch/);
});

test('MedSlot identity never grants a source sign-in or a different backend',()=>{const base='http://127.0.0.1:32979/api',identity=base+'/reference-modules/medslot/api/auth/me';assert.doesNotThrow(()=>assertApiTarget(identity,base,'GET'));for(const method of ['POST','PUT','PATCH','DELETE'])assert.throws(()=>assertApiTarget(identity,base,method),/API target mismatch/);for(const path of [identity.replace('medslot','unknown'),identity.replace('/auth/me','/auth/login'),identity.replace('127.0.0.1','other.example'),identity+'/extra'])assert.throws(()=>assertApiTarget(path,base,'GET'),/API target mismatch/);});
