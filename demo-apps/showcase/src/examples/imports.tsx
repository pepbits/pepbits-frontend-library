"use client";
import React,{useMemo,useState} from 'react';
import {createMemoryRecordAdapter,createMemoryDraftAdapter,type ImportAdapter,type ImportJob} from '@pepbits/data';
import {CsvImportDialog,CsvOptionsEditor} from '@pepbits/patterns/imports';
import {DraftHost} from '@pepbits/patterns/drafts';
import {Button} from '@pepbits/ui';
export function createDemoImports():ImportAdapter {
 const records=createMemoryRecordAdapter();let current:string|null=null;
 return {latest:async()=>current?(await records.load<ImportJob>(current)).record?.values??null:null,
 preview:async(productId,pageId,rows,id)=>{current=JSON.stringify([productId,id]);const job:ImportJob={id,productId,pageId,confirmed:false,createdAt:new Date().toISOString(),rows:rows.map((values,index)=>({row:index+1,values,errors:values.code&&values.name?{} as Record<string,string>:{name:'Code and name are required'},status:values.code&&values.name?'pending':'invalid'}))};return (await records.save(current,job,0,0,id)).record!.values;},
 run:async(id)=>{if(!current)throw new Error('Validate a file first');const bundle=await records.load<ImportJob>(current),saved=bundle.record!;if(saved.values.confirmed)return saved.values;const job={...saved.values,confirmed:true,rows:saved.values.rows.map(row=>row.status==='pending'?{...row,status:'success' as const,recordId:`ITEM-${row.row}`}:row)};return (await records.save(current,job,saved.version,bundle.draftVersion,id+'-run')).record!.values;}};
}
export function ImportsDemo(){const adapter=useMemo(createDemoImports,[]),drafts=useMemo(()=>createMemoryDraftAdapter(),[]),[open,setOpen]=useState(false),[count,setCount]=useState(0);return <DraftHost adapter={drafts} identity="fictional-gallery:showcase:demo-editor" available><p>Upload a fictional CSV with code,name headers. Validation and confirmed jobs live in memory.</p><Button onClick={()=>setOpen(true)}>Import items</Button><output>Completed imports: {count}</output><CsvImportDialog open={open} onClose={()=>setOpen(false)} page={{id:'items',title:'Items'}} productId="showcase" adapter={adapter} definition={{id:'item',label:'Items',uniqueField:'code',schema:{sections:[{fields:[{id:'code',label:'Code',required:true},{id:'name',label:'Name',required:true}]}]}}} onImported={()=>setCount(value=>value+1)}/></DraftHost>;}
