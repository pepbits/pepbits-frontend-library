import { expect, test } from 'vitest';
import type { EntitySchema } from './page';
import { fieldOptions, isFieldVisible, updateFormValue, validateForm } from './form-rules';
const fields = [
 {id:'group',label:'Group',type:'select'},
 {id:'category',label:'Category',type:'select',optionsByField:{field:'group',values:{'GROUP-A':[{value:'Category A',label:'Category A'}],'GROUP-B':[{value:'Category B',label:'Category B'}]}}},
 {id:'notes',label:'Notes',type:'textarea',visibleWhen:{field:'hold',equals:true},requiredWhen:{field:'hold',equals:true}},
 {id:'limit',label:'Limit',type:'number',min:0},
 {id:'email',label:'Email',type:'email'},
 {id:'from',label:'Start',type:'date'},
 {id:'to',label:'End',type:'date',notBefore:'from'},
] as EntitySchema['sections'][number]['fields'];
const schema={sections:[{id:'details',title:'Details',fields}]} as EntitySchema;
test('dependent options clear when their parent changes',()=>{
 expect(fieldOptions(fields[1]!,{group:'GROUP-A'}).map(v=>v.value)).toEqual(['Category A']);
 expect(updateFormValue(schema,{group:'GROUP-A',category:'Category A'},'group','GROUP-B')).toEqual({group:'GROUP-B',category:''});
 expect(validateForm(schema,{group:'GROUP-B',category:'Category A'})).toHaveProperty('category');
});
test('conditional requirements ignore hidden fields and enforce visible fields',()=>{
 expect(isFieldVisible(fields[2]!,{hold:false})).toBe(false);
 expect(validateForm(schema,{hold:false,notes:''})).toEqual({});
 expect(validateForm(schema,{hold:true,notes:' '})).toHaveProperty('notes');
});
test('cross-field dates, email and numeric bounds identify the field to correct',()=>{
 expect(Object.keys(validateForm(schema,{from:'2026-09-07',to:'2026-09-06',email:'bad',limit:-1})).sort()).toEqual(['email','limit','to']);
 expect(validateForm(schema,{from:'2026-09-07',to:'2026-09-07',email:'a@example.test',limit:0})).toEqual({});
});
