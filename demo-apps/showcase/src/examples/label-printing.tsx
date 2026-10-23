'use client';
import React,{useMemo} from 'react';
import {LabelPrintingWorkspace,type LabelCommand,type LabelAdapter,type LabelLibrary,type LabelJob} from '@pepbits/patterns/label-printing';
/** Artwork and records are synthetic. No print service is contacted. */
export function createDemoLabels():LabelAdapter{
 const library:LabelLibrary={templates:[{id:'item-label',title:'Fictional item label',category:'items',symbology:'text',widthMm:80,heightMm:40,version:1,fields:[]}],profiles:[{id:'sheet',title:'Example sheet',widthMm:210,heightMm:297,columns:2,marginMm:10,gapMm:4}],records:[{id:'item-a',category:'items',name:'Fictional item',identifier:'ITEM-A',detail:'Illustrative label'}],jobs:[],policy:{version:1,maxCopies:10,reprintAllowed:true,lockedProfile:''},defaultProfile:'sheet',canManage:false};
 const operations=new Map<string,unknown>();
 return {library:async()=>structuredClone(library),async command<T=LabelJob>(input:LabelCommand):Promise<T>{
  if(input.operationId&&operations.has(input.operationId))return structuredClone(operations.get(input.operationId)) as T;
  let result:unknown;
  if(input.action==='create'){
   const job:LabelJob={id:'job-'+(library.jobs.length+1),templateId:'item-label',templateVersion:1,profile:library.profiles[0]!,copies:input.copies??1,createdAt:new Date().toISOString(),attempts:[],labels:(input.recordIds??[]).map(recordId=>({recordId,title:'Fictional item',lines:['Illustrative label'],code:'ITEM-A',image:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI0MCI+PHRleHQgeD0iMiIgeT0iMjQiPklURU0tQTwvdGV4dD48L3N2Zz4=',widthMm:80,heightMm:40}))};library.jobs.push(job);result=job;
  }else if(input.action==='preference'){library.defaultProfile=input.profileId??library.defaultProfile;result=library;}
  else {const job=library.jobs.find(j=>j.id===input.jobId);if(!job)throw new Error('Unknown fictional job');if(input.action==='print')job.attempts.push({id:input.operationId!,at:new Date().toISOString(),reason:input.reason??'',status:'requested'});result=job;}
  if(input.operationId)operations.set(input.operationId,structuredClone(result));return structuredClone(result) as T;
 }};
}
export function LabelPrintingDemo(){const adapter=useMemo(createDemoLabels,[]);return <div><p>Generate fictional artwork and inspect paper compatibility. Printing uses the browser dialog.</p><LabelPrintingWorkspace adapter={adapter} scopeKey="showcase:labels" category="items"/></div>;}
