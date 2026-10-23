import {test,expect} from 'vitest';
import {isDesignerDefinition,designerOptions,designerDescendants,changeDesignerValue,localizeDesignerDefinition,type DesignerDefinition} from './dcp-designer';
const form:DesignerDefinition={title:'Form',sections:[{id:'main',title:'Main',fields:[{id:'country',label:'Country',type:'select',options:[{value:'IN',label:'India'}]},{id:'kind',label:'Type',type:'select',options:[{value:'PERSON',label:'Person'},{value:'BUSINESS',label:'Business'}]},{id:'document',label:'Document',labels:{ar:'وثيقة',en:'Document'},type:'select',dependsOn:'country',additionalParents:[{fieldId:'kind'}],options:[{value:'GST',label:'GST',parentValue:'IN',parentValues:{kind:'BUSINESS'}}]}]}]};
test('second parent invalidates children and lookup signatures include every ancestor',()=>{
 expect(isDesignerDefinition(form)).toBe(true);expect(designerOptions(form,'document',{country:'IN',kind:'PERSON'}).options).toEqual([]);expect(designerOptions(form,'document',{country:'IN',kind:'BUSINESS'}).options[0]!.value).toBe('GST');expect(designerDescendants(form,'kind').has('document')).toBe(true);expect(changeDesignerValue(form,{country:'IN',kind:'BUSINESS',document:'GST'},'kind','PERSON')).toEqual({country:'IN',kind:'PERSON'});
});
test('tenant labels use selected locale then English then original without changing IDs or values',()=>{
 const arabic=localizeDesignerDefinition(form,'ar');expect(arabic.sections[0]!.fields[2]!.label).toBe('وثيقة');expect(arabic.sections[0]!.fields[2]!.id).toBe('document');expect(localizeDesignerDefinition(form,'ml').sections[0]!.fields[2]!.label).toBe('Document');
 const bad=structuredClone(form);(bad.sections[0]!.fields[2]!.labels as Record<string,string>).invalid='Unsupported';expect(isDesignerDefinition(bad)).toBe(false);
});
