import type {PageTemplateDefinition,TemplateDocument,TemplateEngine,TemplateView} from '../types';
const engines:TemplateEngine[]=['master','list','order','booking','case','result','finance','reconcile','report','dashboard','entity','admin'];
const views:TemplateView[]=['table','cards','board','timeline','matrix','document'];
function definition(id:string,engine:TemplateEngine='master',view:TemplateView='table',registry=false):PageTemplateDefinition {
 return {id,engine,view,group:'records',title:'Item workspace',description:'Fictional configurable record',layout:'rail',stages:['requested','inProgress','review','completed'],tags:[],editable:!['report','dashboard','entity'].includes(engine),...(registry?{designFamily:'registry' as const}:{}),
 sections:[{id:'identity',title:'Details',fields:[{id:'code',label:'Code',type:'text',required:true},{id:'name',label:'Name',type:'text',required:true},{id:'reference',label:'Reference',type:'text',required:true}]},{id:'details',title:'Notes',fields:[{id:'notes',label:'Notes',type:'textarea'}]}],
 columns:[{key:'code',label:'Code'},{key:'name',label:'Name'},{key:'date',label:'Date',type:'date'},{key:'amount',label:'Amount',type:'money'},{key:'status',label:'Status',type:'status'}],
 configuration:{resources:[{value:'Resource A',label:'Resource A'},{value:'Resource B',label:'Resource B'}],slots:[{start:'09:00',end:'09:30'},{start:'10:00',end:'10:30'},{start:'11:00',end:'11:30',available:false}],scheduleDays:[{value:'day-a',label:'Day A'},{value:'day-b',label:'Day B'}],roles:['reviewer','owner'],capacity:{'Resource A':2},unavailable:{'Resource B':['*','11:00']}}};
}
export const REGISTRY_TEMPLATES=[definition('registry-list','list','table',true),definition('registry-master','master','table',true),definition('registry-order-a','order','table',true),definition('registry-reference','order','table',true),definition('registry-case','case','table',true)];
export const PAGE_TEMPLATES=[...engines.flatMap(engine=>views.map(view=>definition(`template-${engine}-${view}`,engine,view))),...REGISTRY_TEMPLATES,...[
 ['template-hierarchical-master','master'],['template-split-list-detail','list'],['template-import-wizard','admin'],['template-document-workspace','entity'],['template-communication-workspace','entity'],['template-permissions-matrix','admin'],['template-policy-editor','admin']
].map(([id,engine])=>definition(id!,engine as TemplateEngine))];
export const TEMPLATE_BY_ID:Record<string,PageTemplateDefinition>=Object.fromEntries(PAGE_TEMPLATES.map(item=>[item.id,item]));
export function createTemplateSample(definition:PageTemplateDefinition):TemplateDocument {
 return {id:'RECORD-001',version:1,values:{code:'RECORD-001',name:'Record A',reference:'REF-A',notes:'',effectiveDate:'2026-09-09',dueDate:'2026-09-20',startTime:'09:00',endTime:'09:30',resource:'Resource A'},
 lines:[{id:'a',description:'Line A',quantity:2,price:120,debit:240,credit:0,result:'12',reference:'10–20',checked:false},{id:'b',description:'Line B',quantity:1,price:80,debit:0,credit:240,result:'18',reference:'10–20',checked:true}],
 rows:Array.from({length:8},(_,i)=>({code:`RECORD-${i+1}`,name:`Record ${i+1}`,date:`2026-09-${10+i}`,amount:(i+1)*120,status:definition.stages[i%definition.stages.length]!,resource:'Resource A'}))};
}
