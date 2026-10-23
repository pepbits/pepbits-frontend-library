import {test,expect} from 'vitest';
import {cloneDesignerSections,isDesignerDefinition,isDesignerValues,validDesignerPayload,previewErrors,changeDesignerValue,type DesignerDefinition} from './dcp-designer';
import {resolveDesignerValues} from './dcp-rules';
const definition:DesignerDefinition={title:'Line questionnaire',sections:[
 {id:'context',title:'Context',fields:[{id:'country',label:'Country',type:'select',options:[{value:'IN',label:'India'},{value:'AE',label:'UAE'}]},{id:'rate',label:'Rate',type:'number'}]},
 {id:'lines',title:'Lines',repeatable:true,minItems:1,maxItems:2,fields:[
  {id:'code',label:'Code',type:'text',required:true,rules:{normalize:'trim-uppercase'}},
  {id:'quantity',label:'Quantity',type:'number',required:true,min:0,rules:{integer:true}},
  {id:'total',label:'Total',type:'number',rules:{calculation:{operation:'product',left:'quantity',right:'rate'}}},
  {id:'state',label:'State',type:'select',dependsOn:'country',options:[{value:'KL',label:'Kerala',parentValue:'IN'},{value:'DU',label:'Dubai',parentValue:'AE'}]}
 ]}
]};
test('repeating groups normalize and calculate each occurrence without leaking fields to the root',()=>{
 expect(isDesignerDefinition(definition)).toBe(true);
 const values=resolveDesignerValues(definition,{country:'IN',rate:3,lines:[{_id:'one',code:' a ',quantity:2,state:'KL'},{_id:'two',code:' b ',quantity:4}]});
 expect(values).toEqual({country:'IN',rate:3,lines:[{_id:'one',code:'A',quantity:2,total:6,state:'KL'},{_id:'two',code:'B',quantity:4,total:12}]});
 expect(previewErrors(definition,values)).toEqual({});expect(validDesignerPayload(definition,values)).toBe(true);
});
test('row limits, occurrence errors and payload identity are enforced',()=>{
 expect(previewErrors(definition,{lines:[]})).toEqual({lines:'designer.rowLimit'});
 const errors=previewErrors(definition,{rate:3,country:'IN',lines:[{_id:'one',quantity:1,state:'DU'}]});
 expect(errors['lines[one].code']).toBe('designer.requiredError');expect(errors['lines[one].state']).toBe('designer.optionError');
 expect(isDesignerValues({lines:[{_id:'same'},{_id:'same'}]})).toBe(false);
 expect(validDesignerPayload(definition,{code:'root-forgery'})).toBe(false);
 expect(validDesignerPayload(definition,{lines:[{_id:'one',unknown:'forgery'}]})).toBe(false);
 expect(validDesignerPayload(definition,{lines:[{_id:'one',code:'A',quantity:1}]})).toBe(true);
});
test('global parent changes clear dependent values in every row; reverse cross-row dependencies fail',()=>{
 expect(changeDesignerValue(definition,{country:'IN',lines:[{_id:'one',state:'KL',code:'A'},{_id:'two',state:'KL'}]},'country','AE')).toEqual({country:'AE',lines:[{_id:'one',code:'A'},{_id:'two'}]});
 const bad=structuredClone(definition);bad.sections[0]!.fields[1]!.rules={calculation:{operation:'sum',left:'quantity',right:'total'}};expect(isDesignerDefinition(bad)).toBe(false);
});

test('copying an example rewrites calculation and dependency references to copied fields',()=>{
 let sequence=0;const copy={...definition,sections:cloneDesignerSections(definition,()=> 'copied_'+(++sequence))};
 expect(isDesignerDefinition(copy)).toBe(true);
 const total=copy.sections[1]!.fields.find(f=>f.label==='Total')!;
 expect(total.rules!.calculation!.left).toBe(copy.sections[1]!.fields.find(f=>f.label==='Quantity')!.id);
 expect(total.rules!.calculation!.right).toBe(copy.sections[0]!.fields.find(f=>f.label==='Rate')!.id);
 expect(copy.sections[1]!.fields.find(f=>f.label==='State')!.dependsOn).toBe(copy.sections[0]!.fields[0]!.id);
});
