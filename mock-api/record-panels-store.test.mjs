import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRecordPanelsStore} from './record-panels-store.mjs';
const user={id:'one',name:'One',tenantId:'tenant',role:'finance-manager'},scope=['product','customers','A'];
function setup(t){const dir=mkdtempSync(join(tmpdir(),'panels-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const file=join(dir,'data.json');return {file,store:createRecordPanelsStore(file)};}
test('attachments round trip and list responses omit bytes; removal and retries are atomic',t=>{
 const {file,store}=setup(t);const call=body=>store.handle(user,{scope,...body});
 const upload={action:'upload',operationId:'upload-one',name:'demo.txt',content:Buffer.from('demo file').toString('base64')};
 const first=call(upload);assert.equal(first.status,200);assert.equal(first.body.attachments[0].content,undefined);assert.equal(first.body.activity.length,1);
 assert.equal(call(upload).body.attachments.length,1);assert.equal(call({...upload,name:'other'}).status,409);
 const id=first.body.attachments[0].id;assert.equal(call({action:'download',id}).body.content,upload.content);
 assert.equal(createRecordPanelsStore(file).handle(user,{scope,action:'list'}).body.attachments.length,1);
 const remove={action:'remove',collection:'attachments',id,operationId:'remove-one'};
 assert.equal(call(remove).body.attachments.length,0);assert.equal(call(remove).body.activity.length,2);
 assert.equal(call({action:'download',id}).status,404);
});
test('comments, related records and activity are scoped; invalid or denied writes leave no event',t=>{
 const {store}=setup(t);const call=(body,owner=user)=>store.handle(owner,{scope,...body});
 assert.equal(call({action:'comment',text:'hello',operationId:'comment-one'}).status,200);
 assert.equal(call({action:'list'},{...user,id:'two'}).body.comments.length,1);
 assert.equal(call({action:'list'},{...user,tenantId:'other'}).body.comments.length,0);
 assert.equal(call({action:'list',scope:['other','customers','A']}).body.comments.length,0);
 const id=call({action:'list'}).body.comments[0].id;
 assert.equal(call({action:'remove',collection:'comments',id,operationId:'remove-two'},{...user,id:'two'}).status,403);
 assert.equal(call({action:'comment',text:'denied',operationId:'comment-two'},{...user,role:'viewer'}).status,403);
 assert.equal(call({action:'upload',name:'large',content:Buffer.alloc(2*1024*1024+1).toString('base64'),operationId:'large-file'}).status,413);
 assert.equal(call({action:'link',pageId:'customers',recordId:'A',label:'self',operationId:'link-self'}).status,400);
 const link={action:'link',pageId:'customers',recordId:'B',label:'Parent',operationId:'link-other'};
 assert.equal(call(link).body.related.length,1);assert.equal(call(link).body.activity.length,2);
 assert.equal(call({...link,operationId:'duplicate-link'}).status,409);
 assert.equal(call({action:'list'}).body.activity.length,2);
});
