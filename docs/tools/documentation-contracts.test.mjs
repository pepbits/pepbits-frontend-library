import test from 'node:test';
import assert from 'node:assert/strict';
import {assessReceipt} from './documentation-contracts.mjs';
import {translationRevision} from '../../mock-api/documentation-revisions.mjs';
const guide={pageId:'billing',title:'Billing',sections:[{id:'flow',title:'Flow',paragraphs:['Choose a patient']}],fields:[],tour:[]};
test('source edits and mapping changes require fresh impact review; explanations are mandatory',()=>{
 const receipt={sha256:'old',pages:['billing'],disposition:'no-content-impact',reason:'Layout spacing only; workflow unchanged'};
 assert.equal(assessReceipt(receipt,'old',['billing'],{}),null);
 assert.match(assessReceipt(receipt,'new',['billing'],{}),/source changed/);
 assert.match(assessReceipt(receipt,'old',['billing','orders'],{}),/mapping/);
 assert.match(assessReceipt({...receipt,reason:''},'old',['billing'],{}),/explanation/);
 assert.match(assessReceipt({...receipt,disposition:'updated'},'old',['billing'],{billing:guide}),/fingerprint/);
});
test('source edits invalidate reviewed translations even when their text is unchanged',()=>{
 const translated=s=>'മലയാളം '+s;
 const current=translationRevision(guide,'ml',translated);
 const records={billing:{ml:{...current,reviewer:'test-reviewer',reviewedAt:'2026-09-10',reviewEvidence:'test fixture review'}}};
 assert.equal(translationRevision(guide,'ml',translated,records).reviewStatus,'reviewed');
 const changed={...guide,sections:[{...guide.sections[0],paragraphs:['Choose a patient and confirm']}]};
 assert.equal(translationRevision(changed,'ml',translated,records).translationStatus,'outdated');
 assert.equal(translationRevision(changed,'ml',translated,records).reviewStatus,'pending');
 assert.equal(translationRevision(guide,'ml',s=>'പുതിയത് '+s,records).translationStatus,'outdated');
 assert.equal(translationRevision(guide,'ml',s=>s).translationStatus,'incomplete');
});

test('required-field metadata invalidates a translation review even if visible strings do not change',()=>{
 const source={...guide,fields:[{id:'name',label:'Name',help:'Enter name',rules:[],required:false}]};
 const translated=s=>'अनुवाद '+s, state=translationRevision(source,'hi',translated);
 const records={billing:{hi:{...state,reviewer:'fixture reviewer',reviewedAt:'2026-09-10',reviewEvidence:'fixture review'}}};
 const changed={...source,fields:[{...source.fields[0],required:true}]};
 assert.equal(translationRevision(changed,'hi',translated,records).translationStatus,'outdated');
});
