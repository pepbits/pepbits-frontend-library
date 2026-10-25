import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describeMessage,withMessageMetadata} from './message-descriptors.mjs';
const registry=JSON.parse(readFileSync(new URL('./config/api-messages.json',import.meta.url)));
test('every registered backend message has four complete translations',()=>{
 for(const language of ['en','ar','hi','ml']){
  const messages=JSON.parse(readFileSync(new URL(`./config/localization/shared/${language}.json`,import.meta.url))).messages;
  for(const key of Object.values(registry))assert.ok(messages[key],`${language}: ${key}`);
 }
});
test('the wire envelope preserves old clients, statuses and literal user data',()=>{
 const body={error:'Not signed in.',notifications:[{message:'Submitted for Finance {stage} A-19',recordId:'CUS-001'}],activity:[{detail:'Added a comment',author:'Alice',comment:'Do not translate this'}],results:[{recordId:'CUS-002',ok:false,error:'Version conflict.'}]};
 const result=withMessageMetadata(body);
 assert.equal(result.error,body.error);assert.ok(result.errorMessage.messageKey.startsWith('api.'));
 assert.deepEqual(result.notifications[0].messageValues,{stage:'Finance {stage} A-19'});
 assert.equal(result.activity[0].comment,body.activity[0].comment);
 assert.ok(result.activity[0].messageKey);assert.ok(result.results[0].errorMessage);
 assert.equal(body.errorMessage,undefined,'no mutation of stored data');
});
test('unknown errors and old persisted activity retain readable details',()=>{
 assert.equal(describeMessage('toString'),undefined);
 assert.deepEqual(withMessageMetadata({error:'External detail X-17'}).errorMessage,{messageKey:'api.error.unknown',messageValues:{detail:'External detail X-17'}});
 for(const detail of ['Added an attachment','Removed an item from comments','Linked a related record'])assert.ok(withMessageMetadata({activity:[{detail}]}).activity[0].messageKey.startsWith('api.'));
});
