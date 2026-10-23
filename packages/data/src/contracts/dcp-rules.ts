import type {DesignerDefinition,DesignerField,DesignerValues,DesignerRow} from './dcp-designer';
export interface DesignerCondition {fieldId:string;operator:'eq'|'ne'|'filled';value?:string|number|boolean}
export interface DesignerRules {max?:number;integer?:boolean;minLength?:number;maxLength?:number;format?:'ascii-letters'|'unicode-letters'|'uppercase'|'alphanumeric';normalize?:'trim'|'trim-uppercase';visibleWhen?:DesignerCondition;requiredWhen?:DesignerCondition;readOnlyWhen?:DesignerCondition;calculation?:{operation:'sum'|'difference'|'product'|'ratio';left:string;right:string}}
const object=(v:unknown):boolean=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validDesignerRules(def:DesignerDefinition):boolean{
 const fields=def.sections.flatMap(s=>s.fields),byId=new Map(fields.map(f=>[f.id,f])),scope=new Map(def.sections.flatMap(s=>s.fields.map(f=>[f.id,s.repeatable?s.id:''])));
 for(const f of fields){const r=f.rules;if(r===undefined)continue;if(!object(r)||Object.keys(r).some(k=>!['max','integer','minLength','maxLength','format','normalize','visibleWhen','requiredWhen','readOnlyWhen','calculation'].includes(k)))return false;
  if(r.max!==undefined&&(f.type!=='number'||typeof r.max!=='number'||!Number.isFinite(r.max)||(f.min!==undefined&&r.max<f.min)))return false;
  if(r.integer!==undefined&&(f.type!=='number'||typeof r.integer!=='boolean'))return false;
  for(const k of ['minLength','maxLength'] as const)if(r[k]!==undefined&&(!['text','textarea','email'].includes(f.type)||!Number.isInteger(r[k])||r[k]!<0||r[k]!>10000))return false;
  if(r.minLength!==undefined&&r.maxLength!==undefined&&r.minLength>r.maxLength)return false;
  if(r.format!==undefined&&(!['text','textarea','email'].includes(f.type)||!['ascii-letters','unicode-letters','uppercase','alphanumeric'].includes(r.format)))return false;
  if(r.normalize!==undefined&&(!['text','textarea','email'].includes(f.type)||!['trim','trim-uppercase'].includes(r.normalize)))return false;
  for(const k of ['visibleWhen','requiredWhen','readOnlyWhen'] as const){const c=r[k];if(c!==undefined&&(!object(c)||typeof c.fieldId!=='string'||c.fieldId===f.id||!byId.has(c.fieldId)||!['eq','ne','filled'].includes(c.operator)|| (c.operator!=='filled'&&!['string','number','boolean'].includes(typeof c.value))))return false;}
  const c=r.calculation;if(c!==undefined&&(!object(c)||f.type!=='number'||!['sum','difference','product','ratio'].includes(c.operation)||typeof c.left!=='string'||typeof c.right!=='string'||byId.get(c.left)?.type!=='number'||byId.get(c.right)?.type!=='number'))return false;
 }
 const visiting=new Set<string>(),done=new Set<string>();function visit(id:string):boolean{if(visiting.has(id))return false;if(done.has(id))return true;visiting.add(id);const f=byId.get(id)!,r=f.rules;const refs=[f.dependsOn,...(f.additionalParents??[]).map(p=>p.fieldId),r?.visibleWhen?.fieldId,r?.requiredWhen?.fieldId,r?.readOnlyWhen?.fieldId,r?.calculation?.left,r?.calculation?.right].filter((x):x is string=>!!x);if(refs.some(ref=>!byId.has(ref)||(!!scope.get(ref)&&scope.get(ref)!==scope.get(id))||!visit(ref)))return false;visiting.delete(id);done.add(id);return true;}return fields.every(f=>visit(f.id));
}
export function matchesDesignerCondition(c:DesignerCondition|undefined,values:DesignerValues){if(!c)return true;const v=values[c.fieldId];if(c.operator==='filled')return v!==undefined&&v!==''&&v!==false;return c.operator==='eq'?v===c.value:v!==c.value;}
/** Retain hidden values; visibility is not authorization. Normalize before validation. */
export function resolveDesignerValues(def:DesignerDefinition,input:DesignerValues):DesignerValues{
 const values={...input},fields=def.sections.filter(s=>!s.repeatable).flatMap(s=>s.fields),done=new Set<string>(),active=new Set<string>();
 for(const f of fields){if(typeof values[f.id]==='string'&&f.rules?.normalize){const text=(values[f.id] as string).trim();values[f.id]=f.rules.normalize==='trim-uppercase'?text.toUpperCase():text;}}
 function calc(f:DesignerField){if(done.has(f.id)||active.has(f.id))return;active.add(f.id);const c=f.rules?.calculation;if(c){for(const id of [c.left,c.right]){const parent=fields.find(f=>f.id===id);if(parent)calc(parent);}const a=values[c.left],b=values[c.right];if(a===undefined||a===''||b===undefined||b===''||typeof a!=='number'||typeof b!=='number')delete values[f.id];else{const n=c.operation==='sum'?a+b:c.operation==='difference'?a-b:c.operation==='product'?a*b:b===0?NaN:a/b;if(Number.isFinite(n))values[f.id]=n;else delete values[f.id];}}active.delete(f.id);done.add(f.id);}for(const f of fields)calc(f);for(const section of def.sections)if(section.repeatable&&Array.isArray(input[section.id]))values[section.id]=(input[section.id] as DesignerRow[]).map(row=>{const resolved=resolveDesignerValues({...def,sections:[{...section,repeatable:false}]},{...values,...row});return Object.fromEntries([['_id',row._id],...section.fields.filter(f=>resolved[f.id]!==undefined).map(f=>[f.id,resolved[f.id]])]) as DesignerRow;});return values;
}
export function designerRuleError(field:DesignerField,value:unknown):string|undefined{
 const r=field.rules;if(!r)return;
 if(r.calculation&&(value===undefined||value===''))return 'designer.calculationError';
 if(value===undefined||value==='')return;
 if(field.type==='number'&&((r.max!==undefined&&Number(value)>r.max)||(r.integer&&!Number.isInteger(Number(value)))))return 'designer.numberError';
 if(typeof value==='string'){const length=Array.from(value).length;if((r.minLength!==undefined&&length<r.minLength)||(r.maxLength!==undefined&&length>r.maxLength))return 'designer.lengthError';
  if(r.format==='ascii-letters'&&!/^[A-Za-z]+$/.test(value)||r.format==='unicode-letters'&&!/^\p{L}+$/u.test(value)||r.format==='uppercase'&&value!==value.toUpperCase()||r.format==='alphanumeric'&&!/^[A-Za-z0-9]+$/.test(value))return 'designer.formatError';}
}
