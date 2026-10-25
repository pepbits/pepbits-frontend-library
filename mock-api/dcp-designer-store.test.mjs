import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createDesignerStore} from './dcp-designer-store.mjs';import {isDesignerDefinition,isDesignerView,previewErrors} from '../desktop-clients/packages/erp-config/src/dcp-designer.ts';
const admin={id:'admin',tenantId:'a',role:'enterprise-admin'};const form={title:'Synthetic form',sections:[{id:'main',title:'Main',fields:[{id:'score',label:'Score',type:'number',required:true,min:0}]}]};
test('designer persists drafts, deduplicates retries, isolates scope and rejects stale saves',()=>{const dir=mkdtempSync(join(tmpdir(),'designer-')),file=join(dir,'state.csv');try{let api=createDesignerStore(file);const cmd={action:'save',operationId:'one',definition:form};const first=api.handle(admin,'app',cmd);assert.equal(first.status,200);assert.equal(isDesignerView(first.body),true);assert.deepEqual(api.handle(admin,'app',cmd),first);const r=first.body.record;api=createDesignerStore(file);assert.equal(api.handle(admin,'app',{action:'load',id:r.id}).body.record.revision,1);for(const [user,product]of [[{...admin,tenantId:'b'},'app'],[{...admin,id:'other'},'app'],[admin,'other']])assert.equal(api.handle(user,product,{action:'load',id:r.id}).status,404);assert.equal(api.handle(admin,'app',{...cmd,operationId:'two',id:r.id,revision:0}).status,409);assert.equal(api.handle({...admin,role:'user'},'app',cmd).status,403);assert.equal(api.handle(admin,'app',{...cmd,definition:{...form,title:'Changed'}}).status,409);}finally{rmSync(dir,{recursive:true,force:true});}});
test('designer rejects duplicate IDs, unsupported components and ambiguous options',()=>{assert.equal(isDesignerDefinition(form),true);for(const fields of [[{id:'main',label:'Duplicate section ID',type:'text'}],[{id:'bad',label:'Code',type:'script'}],[{id:'pick',label:'Pick',type:'select',options:[{value:'01',label:'One'},{value:'01',label:'Duplicate'}]}]])assert.equal(isDesignerDefinition({...form,sections:[{...form.sections[0],fields}]}),false);assert.equal(previewErrors(form,{score:-1}).score,'designer.numberError');assert.deepEqual(previewErrors(form,{score:0}),{});assert.equal(previewErrors(form,{}).score,'designer.requiredError');});
const cascade={title:'Locations',sections:[{id:'location',title:'Location',fields:[
{id:'country',label:'Country',type:'select',options:[{value:'IN',label:'India'},{value:'AE',label:'UAE'}]},
{id:'state',label:'State',type:'select',required:true,dependsOn:'country',options:[{value:'01',label:'Kerala',parentValue:'IN'},{value:'02',label:'Karnataka',parentValue:'IN'},{value:'03',label:'Abu Dhabi',parentValue:'AE'},{value:'04',label:'Dubai',parentValue:'AE'}]},
{id:'city',label:'City',type:'select',dependsOn:'state',options:[{value:'001',label:'Kochi',parentValue:'01'}]}
]}]};
test('dependent API options persist leading-zero mappings and reject forged relationships and cross-scope access',()=>{
 const dir=mkdtempSync(join(tmpdir(),'designer-cascade-'));try{const file=join(dir,'state.csv');let api=createDesignerStore(file);
 const saved=api.handle(admin,'app',{action:'save',operationId:'cascade',definition:cascade});assert.equal(saved.status,200);const record=saved.body.record;api=createDesignerStore(file);
 const lookup=values=>api.handle(admin,'app',{action:'options',id:record.id,revision:1,fieldId:'state',values});
 assert.equal(lookup({}).body.lookup.state,'missing-parent');assert.deepEqual(lookup({country:'IN'}).body.lookup.options.map(o=>o.value),['01','02']);assert.deepEqual(lookup({country:'AE'}).body.lookup.options.map(o=>o.value),['03','04']);
 assert.equal(lookup({country:'unknown'}).body.lookup.state,'missing-parent');
 assert.equal(api.handle(admin,'app',{action:'options',id:record.id,revision:1,fieldId:'city',values:{country:'AE',state:'01'}}).body.lookup.state,'missing-parent');
 const validate=values=>api.handle(admin,'app',{action:'validate',id:record.id,revision:1,values});assert.equal(validate({country:'AE',state:'01'}).body.validation.state,'designer.optionError');assert.deepEqual(validate({country:'IN',state:'01',city:'001'}).body.validation,{});
 assert.equal(api.handle(admin,'app',{action:'options',id:record.id,revision:0,fieldId:'state',values:{}}).status,409);
 assert.equal(api.handle({...admin,tenantId:'b'},'app',{action:'options',id:record.id,revision:1,fieldId:'state',values:{}}).status,404);
 assert.equal(api.handle({...admin,role:'user'},'app',{action:'options',definition:cascade,fieldId:'state',values:{}}).status,403);
 assert.deepEqual(api.handle(admin,'app',{action:'load',id:record.id}).body.record.definition,cascade);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('dependency validation rejects cycles, dangling parents, invalid option mappings and excessive depth',()=>{
 assert.equal(isDesignerDefinition(cascade),true);
 for(const mutate of [f=>{f[0].dependsOn='city';},f=>{f[1].dependsOn='missing';},f=>{f[1].options[0].parentValue='NO';},f=>{delete f[1].options[0].parentValue;},f=>{f[1].dependsOn='state';}]){const def=structuredClone(cascade);mutate(def.sections[0].fields);assert.equal(isDesignerDefinition(def),false);}
 const deep={title:'Depth',sections:[{id:'s',title:'Depth',fields:Array.from({length:7},(_,i)=>({id:'f'+i,type:'select',label:'Level '+i,...(i?{dependsOn:'f'+(i-1)}:{}),options:[{value:'01',label:'One',...(i?{parentValue:'01'}:{})}]}))}]};assert.equal(isDesignerDefinition(deep),false);
 const dir=mkdtempSync(join(tmpdir(),'designer-reject-'));try{assert.equal(createDesignerStore(join(dir,'data.csv')).handle(admin,'app',{action:'save',operationId:'bad',definition:deep}).status,400);}finally{rmSync(dir,{recursive:true,force:true});}
});
const sharedForm={title:'Shared locations',sections:[{id:'shared',title:'Location',fields:[
{id:'country',label:'Country',type:'select',valueSet:{id:'countries',revision:1}},
{id:'state',label:'State',type:'select',dependsOn:'country',valueSet:{id:'states',revision:1},relationship:{id:'country_state',revision:1}}
]}]};
test('catalog is shared by tenant/application, append-only and pinned by independent forms',()=>{
 const dir=mkdtempSync(join(tmpdir(),'designer-catalog-'));try{const file=join(dir,'data.csv');let api=createDesignerStore(file);
 const first=api.handle(admin,'app',{action:'save',operationId:'form-a',definition:sharedForm});const second=api.handle(admin,'app',{action:'save',operationId:'form-b',definition:{...sharedForm,title:'Second form'}});assert.equal(first.status,200);assert.equal(second.status,200);assert.equal(first.body.record.definition.sections[0].fields[1].options,undefined);
 const before=first.body.catalog.sets.find(s=>s.id==='states'),change={action:'save-value-set',id:'states',revision:1,operationId:'states-v2',catalogSet:{name:'States updated',options:before.options.map(o=>({...o,label:o.value==='KL'?'Kerala updated':o.label}))}};
 const result=api.handle(admin,'app',change);assert.equal(result.status,200);assert.equal(isDesignerView(result.body),true);assert.equal(api.handle(admin,'app',change).body.catalog.sets.filter(s=>s.id==='states').length,2);
 assert.equal(api.handle(admin,'app',{...change,operationId:'stale'}).status,409);assert.equal(api.handle(admin,'app',{...change,catalogSet:{...change.catalogSet,name:'Different'}}).status,409);
 api=createDesignerStore(file);assert.equal(api.handle({...admin,id:'colleague'},'app',{action:'load'}).body.catalog.sets.some(s=>s.id==='states'&&s.revision===2),true);
 for(const [user,product]of [[{...admin,tenantId:'b'},'app'],[admin,'other']])assert.equal(api.handle(user,product,{action:'load'}).body.catalog.sets.some(s=>s.revision===2),false);
 const lookup=id=>api.handle(admin,'app',{action:'options',id,revision:1,fieldId:'state',values:{country:'IN'}});
 for(const record of [first.body.record,second.body.record])assert.equal(lookup(record.id).body.lookup.options[0].label,before.options[0].label);
 const oldRelation=result.body.catalog.relationships[0];const rel=api.handle(admin,'app',{action:'save-relationship',id:oldRelation.id,revision:1,operationId:'relation-v2',catalogRelationship:{name:'Updated mapping',parent:oldRelation.parent,child:{id:'states',revision:2},pairs:oldRelation.pairs}});assert.equal(rel.status,200);
 const upgraded=structuredClone(sharedForm);upgraded.sections[0].fields[1].valueSet.revision=2;upgraded.sections[0].fields[1].relationship.revision=2;
 assert.equal(api.handle(admin,'app',{action:'options',definition:upgraded,fieldId:'state',values:{country:'IN'}}).body.lookup.options[0].label,'Kerala updated');
 assert.equal(api.handle({...admin,role:'user'},'app',change).status,403);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('catalog validation rejects foreign/mismatched revisions, forged options and incomplete mappings',()=>{
 const dir=mkdtempSync(join(tmpdir(),'designer-catalog-invalid-'));try{const api=createDesignerStore(join(dir,'data.csv'));
 const broken=structuredClone(sharedForm);broken.sections[0].fields[1].valueSet.revision=99;
 assert.equal(api.handle(admin,'app',{action:'save',operationId:'missing',definition:broken}).status,400);
 const forged=structuredClone(sharedForm);forged.sections[0].fields[1].options=[{value:'bad',label:'Forged',parentValue:'IN'}];assert.equal(api.handle(admin,'app',{action:'save',operationId:'forged',definition:forged}).status,400);
 assert.equal(api.handle(admin,'app',{action:'save-relationship',operationId:'incomplete',catalogRelationship:{name:'Bad',parent:{id:'countries',revision:1},child:{id:'states',revision:1},pairs:[{parentValue:'IN',childValue:'KL'}]}}).status,400);
 assert.equal(api.handle(admin,'app',{action:'validate',definition:sharedForm,values:{country:'AE',state:'KL'}}).body.validation.state,'designer.optionError');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('review publication pins schemas, shares entity answers, validates server rules and rejects stale or foreign commands',()=>{
 const dir=mkdtempSync(join(tmpdir(),'designer-lifecycle-'));try{const file=join(dir,'state.csv'),api=createDesignerStore(file);
 const definition={...form,binding:{entityType:'patient',trigger:'extension'},sections:[{...form.sections[0],fields:[{...form.sections[0].fields[0],rules:{max:10,integer:true}},{id:'ref',label:'Reference',type:'text',rules:{normalize:'trim-uppercase',format:'ascii-letters',minLength:2}},{id:'double',label:'Double score',type:'number',rules:{calculation:{operation:'sum',left:'score',right:'score'}}}]}]};
 let record=api.handle(admin,'app',{action:'save',operationId:'l-save',definition}).body.record;
 const transition=(action,comment='')=>{const result=api.handle(admin,'app',{action,id:record.id,revision:record.revision,operationId:'l-'+action+record.revision,comment});if(result.body.record)record=result.body.record;return result;};
 assert.equal(transition('publish').status,409);assert.equal(transition('review').status,200);assert.equal(transition('reject').status,400);assert.equal(transition('reject','Needs review').status,200);assert.equal(transition('review').status,200);assert.equal(transition('approve').status,200);const published=transition('publish');assert.equal(published.status,200);assert.equal(isDesignerView(published.body),true);const release=published.body.runtime.releases[0];
 assert.equal(api.handle(admin,'app',{action:'save',id:record.id,revision:record.revision,operationId:'blocked-edit',definition}).status,409);
 const command={action:'answer-submit',releaseId:release.id,entityId:'DEMO-PATIENT-1',answerRevision:0,values:{score:11,ref:' ab ',double:999},operationId:'bad-answer'};
 assert.equal(api.handle(admin,'app',command).body.validation.score,'designer.numberError');
 const valid={...command,values:{score:10,ref:' ab ',double:999},operationId:'good-answer'};const submitted=api.handle(admin,'app',valid);assert.equal(submitted.body.runtime.answer.values.double,20);assert.equal(submitted.body.runtime.answer.values.ref,'AB');assert.equal(submitted.body.runtime.answer.status,'submitted');assert.deepEqual(api.handle(admin,'app',valid),submitted);
 const load={action:'runtime-load',entityId:valid.entityId,releaseId:release.id};assert.equal(api.handle({...admin,id:'other',role:'user'},'app',load).body.runtime.answer.values.score,10);
 assert.equal(api.handle({...admin,tenantId:'b'},'app',load).status,404);assert.equal(api.handle(admin,'other',load).status,404);assert.equal(api.handle(admin,'app',{...load,entityId:'DEMO-ITEM-1'}).status,404);
 assert.equal(api.handle(admin,'app',{...valid,answerRevision:1,operationId:'edit-submitted',action:'answer-save'}).status,409);
 assert.equal(transition('revise').status,200);assert.equal(record.status,'draft');assert.deepEqual(api.handle(admin,'app',{action:'load'}).body.runtime.releases[0].definition,definition);
 assert.equal(createDesignerStore(file).handle(admin,'app',load).body.runtime.answerHistory.length,1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('typed rules distinguish normalization and validation and reject cycles and forged metadata',()=>{
 const def=fields=>({...form,sections:[{...form.sections[0],fields}]});
 const score={id:'score',label:'Score',type:'number',min:0,rules:{max:10,integer:true}};
 for(const n of [0,10])assert.deepEqual(previewErrors(def([score]),{score:n}),{});
 for(const n of [-1,11,5.5,true])assert.equal(previewErrors(def([score]),{score:n}).score,'designer.numberError');
 const upper={id:'code',label:'Code',type:'text',rules:{format:'uppercase'}};assert.equal(previewErrors(def([upper]),{code:'abc'}).code,'designer.formatError');assert.deepEqual(previewErrors(def([{...upper,rules:{...upper.rules,normalize:'trim-uppercase'}}]),{code:' abc '}),{});
 assert.equal(isDesignerDefinition(def([{...score,rules:{max:-1}}])),false);assert.equal(isDesignerDefinition(def([{...score,rules:{calculation:{left:'score',right:'score',operation:'sum'}}}])),false);
 assert.equal(isDesignerDefinition(def([{...score,rules:{visibleWhen:{fieldId:'other',operator:'filled'}}},{id:'other',label:'Other',type:'text',rules:{visibleWhen:{fieldId:'score',operator:'filled'}}}])),false);
 assert.equal(isDesignerDefinition(def([{...score,rules:{script:'alert(1)'}}])),false);
});

test('multi-parent choices intersect parent selections and reject indirect cycles',()=>{
 const multi={title:'Multi',sections:[{id:'s',title:'Main',fields:[
 {id:'country',label:'Country',type:'select',options:[{value:'IN',label:'India'},{value:'AE',label:'UAE'}]},
 {id:'customerType',label:'Type',type:'select',options:[{value:'PERSON',label:'Person'},{value:'BUSINESS',label:'Business'}]},
 {id:'identifier',label:'Identifier',type:'select',dependsOn:'country',additionalParents:[{fieldId:'customerType'}],options:[{value:'PAN',label:'PAN',parentValue:'IN',parentValues:{customerType:'PERSON'}},{value:'GST',label:'GST',parentValue:'IN',parentValues:{customerType:'BUSINESS'}}]}
 ]}]};assert.equal(isDesignerDefinition(multi),true);
 const dir=mkdtempSync(join(tmpdir(),'dcp-multi-'));try{const api=createDesignerStore(join(dir,'state.csv'));
 const options=values=>api.handle(admin,'app',{action:'options',definition:multi,fieldId:'identifier',values});
 assert.equal(options({country:'IN'}).body.lookup.state,'missing-parent');assert.deepEqual(options({country:'IN',customerType:'BUSINESS'}).body.lookup.options.map(o=>o.value),['GST']);
 assert.equal(api.handle(admin,'app',{action:'validate',definition:multi,values:{country:'IN',customerType:'PERSON',identifier:'GST'}}).body.validation.identifier,'designer.optionError');
 const cycle=structuredClone(multi);cycle.sections[0].fields[1].dependsOn='identifier';assert.equal(isDesignerDefinition(cycle),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('v1 synthetic API retains null/false/row IDs, validates without writing and isolates CAS records',()=>{
 const dir=mkdtempSync(join(tmpdir(),'dcp-v1-'));try{const api=createDesignerStore(join(dir,'state.csv')),load=(user=admin,app='app')=>api.handle(user,app,{action:'backend-load'}).body;
 const base=load(),command={expectedVersion:base.version,checksum:base.view.checksum,mode:'PINNED',patch:{name:' Changed ',consent:false,notes:null,observations:[{_id:'row-1',note:'Update'},{note:'New'}]}};
 const preview=api.handle(admin,'app',{action:'backend-preview',command});assert.equal(preview.status,200);assert.equal(load().view.values.name,'Example');
 const save=api.handle(admin,'app',{action:'backend-save',command});assert.equal(save.status,200);assert.equal(save.body.view.values.name,'Changed');assert.equal(save.body.view.values.consent,false);assert.equal(save.body.view.values.notes,null);assert.equal(save.body.view.values.observations[0]._id,'row-1');assert.equal(save.body.view.values.observations.length,2);
 assert.equal(api.handle(admin,'app',{action:'backend-save',command}).status,409);assert.equal(load({...admin,tenantId:'other'}).version,'0');assert.equal(load(admin,'other').version,'0');
 const current=load();const invalid=api.handle(admin,'app',{action:'backend-save',command:{...command,expectedVersion:current.version,patch:{rating:11}}});assert.equal(invalid.status,422);assert.equal(load().view.values.rating,0);
 const remove=api.handle(admin,'app',{action:'backend-save',command:{...command,expectedVersion:current.version,patch:{observations:[{_id:'row-1',_delete:true}]}}});assert.equal(remove.status,200);assert.equal(remove.body.view.values.observations.length,1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('repeating authoring sections persist normalized rows and return occurrence validation before submission',()=>{
 const dir=mkdtempSync(join(tmpdir(),'designer-rows-'));try{
 const file=join(dir,'state.csv'),api=createDesignerStore(file),definition={title:'Repeated assessment',binding:{entityType:'patient',trigger:'extension'},sections:[{id:'observations',title:'Observations',repeatable:true,minItems:1,maxItems:2,fields:[{id:'note',label:'Note',type:'text',required:true,rules:{normalize:'trim-uppercase'}}]}]};
 let record=api.handle(admin,'app',{action:'save',definition,operationId:'rows-save'}).body.record,result;
 for(const action of ['review','approve','publish']){result=api.handle(admin,'app',{action,id:record.id,revision:record.revision,operationId:'rows-'+action});assert.equal(result.status,200);record=result.body.record;}
 const base={releaseId:result.body.runtime.releases[0].id,entityId:'DEMO-PATIENT-1',answerRevision:0};
 const bad=api.handle(admin,'app',{...base,action:'answer-submit',operationId:'rows-invalid',values:{observations:[{_id:'one',note:''}]}});
 assert.equal(bad.body.validation['observations[one].note'],'designer.requiredError');assert.equal(isDesignerView(bad.body),true);
 const saved=api.handle(admin,'app',{...base,action:'answer-save',operationId:'rows-good',values:{observations:[{_id:'one',note:' abc '},{_id:'two',note:' def '}]}});
 assert.equal(saved.status,200);assert.equal(isDesignerView(saved.body),true);assert.deepEqual(saved.body.runtime.answer.values.observations,[{_id:'one',note:'ABC'},{_id:'two',note:'DEF'}]);
 const reloaded=createDesignerStore(file).handle(admin,'app',{...base,action:'runtime-load'});assert.deepEqual(reloaded.body.runtime.answer.values,saved.body.runtime.answer.values);
 const forged=api.handle(admin,'app',{...base,answerRevision:1,action:'answer-save',operationId:'rows-forged',values:{observations:[{_id:'one',note:'ok',secret:'unexpected'}]}});assert.equal(forged.status,400);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
