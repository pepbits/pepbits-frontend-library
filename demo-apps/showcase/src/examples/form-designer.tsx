'use client';
import React,{useMemo} from 'react';
import {DcpDesignerWorkspace,designerOptions,previewErrors,type DesignerAdapter,type DesignerView,type DesignerDefinition} from '@pepbits/patterns/form-designer';
import {WorkflowRequestFailure} from '@pepbits/data';
/** Local authoring only. Published versions and independent governance belong to the host. */
export function createDemoDesigner():DesignerAdapter{
 const definition:DesignerDefinition={title:'Fictional item form',sections:[{id:'details',title:'Details',fields:[{id:'name',label:'Item name',type:'text',required:true},{id:'quantity',label:'Quantity',type:'number',min:0}]}]};
 let view:DesignerView={initial:definition,canDesign:true,types:['text','number','select','checkbox','date'],records:[],record:null,catalog:{sets:[],relationships:[]}};
 const operations=new Map<string,DesignerView>();
 return {async command(command){
  if(command.operationId&&operations.has(command.operationId))return structuredClone(operations.get(command.operationId)!);
  if(command.action==='load')return structuredClone({...view,initial:view.record?.definition??definition});
  if(command.action==='options')return {...structuredClone(view),lookup:designerOptions(command.definition??definition,command.fieldId??'',command.values??{})};
  if(command.action==='validate')return {...structuredClone(view),validation:previewErrors(command.definition??definition,command.values??{})};
  if(command.action!=='save')throw new WorkflowRequestFailure(403,{form:'This local example supports draft save and preview only.'});
  if((command.revision??0)!==(view.record?.revision??0))throw new WorkflowRequestFailure(409,{form:'designer.conflict'});
  const record={id:'example-form',revision:(view.record?.revision??0)+1,definition:structuredClone(command.definition!),updatedAt:new Date().toISOString()};
  view={...view,initial:record.definition,record,records:[record]};
  if(command.operationId)operations.set(command.operationId,structuredClone(view));return structuredClone(view);
 }};
}
export function FormDesignerDemo(){const adapter=useMemo(createDemoDesigner,[]);return <div><p>Save a fictional form draft, edit sections and try live preview. Catalog writes and governance require a real host.</p><DcpDesignerWorkspace adapter={adapter} scopeKey="showcase:form-designer"/></div>;}
