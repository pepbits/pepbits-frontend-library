import {useEffect,useState} from 'react';
import {designerOptions,designerParentValues,designerLabel,type DesignerDefinition,type DesignerValues,type DesignerLookup} from '@pepbits/data/dcp-designer';
import type {DesignerAdapter} from '@pepbits/data';
import type {TemplateFieldState} from './template-fields';
export function useDesignerLookups(adapter:DesignerAdapter,definition:DesignerDefinition,values:DesignerValues,t:(key:string)=>string,resolved=definition,language='en'){
 const [responses,setResponses]=useState<Record<string,{key:string;lookup?:DesignerLookup;error?:unknown}>>({}),[attempt,setAttempt]=useState(0);
 const serialized=JSON.stringify(definition),fields=definition.sections.filter(s=>!s.repeatable).flatMap(s=>s.fields).filter(f=>f.type==='select');
 const requests=fields.map(f=>({id:f.id,parents:designerParentValues(definition,f.id,values),missing:designerOptions(resolved,f.id,values).state==='missing-parent'}));
 const signature=JSON.stringify(requests);
 useEffect(()=>{let active=true;for(const request of requests){
  if(request.missing)continue;
  const key=serialized+JSON.stringify(request.parents);
  void adapter.command({action:'options',definition,fieldId:request.id,values:request.parents}).then(view=>{
   if(!view.lookup||view.lookup.fieldId!==request.id)throw new Error('designer.invalidResponse');
   if(active)setResponses(current=>({...current,[request.id]:{key,lookup:view.lookup}}));
  }).catch(error=>{if(active)setResponses(current=>({...current,[request.id]:{key,error}}));});
 }return()=>{active=false;};},[adapter,serialized,signature,attempt]);
 const states:Record<string,TemplateFieldState>={};let failure:unknown=null;
 for(const request of requests){const key=serialized+JSON.stringify(request.parents),response=responses[request.id],current=response?.key===key?response:undefined;
  const hint=request.missing?'designer.chooseParent':current?.error?'designer.lookupError':!current?.lookup?'designer.loading':current.lookup.options.length===0?'designer.noOptions':undefined;
  states[request.id]={disabled:request.missing||!current?.lookup||!!current.error,options:request.missing?[]:current?.lookup?.options.map(o=>({...o,label:designerLabel(o.label,o.labels,language)}))??[],hint:hint?t(hint):undefined};
  if(!request.missing&&current?.error)failure=current.error;
 }
 return {states,failure,retry:()=>{setResponses({});setAttempt(a=>a+1);}};
}
