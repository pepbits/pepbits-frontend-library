'use client';
import React,{useEffect,useRef,useState} from 'react';
import {parseCsv} from '@pepbits/data';
import {localizeImportError} from '@pepbits/i18n';
import {Button, Input, Select} from "@pepbits/ui";
import {TableContainer, Table, TableHeader, TableHead, TableBody, TableRow, TableCell} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {readOptionsWorkbook,type WorkbookOptionsSheet} from './workbook-options';
import {mapCsvOptions} from './csv-options';
/** Bounded staging only: the owner explicitly saves a complete revision through its adapter. */
export function CsvOptionsEditor({disabled,onApply,onStage,onCancel}:{disabled:boolean;onCancel:()=>void;onStage:()=>void;onApply:(options:string)=>void}){
 const {t}=useLocalization(),[csv,setCsv]=useState<ReturnType<typeof parseCsv>|null>(null),[value,setValue]=useState(''),[label,setLabel]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[sheets,setSheets]=useState<WorkbookOptionsSheet[]>([]),[sheetName,setSheetName]=useState(''),[page,setPage]=useState(0);
 const generation=useRef(0),controller=useRef<AbortController|null>(null);useEffect(()=>()=>{generation.current++;controller.current?.abort();},[]);
 async function read(file?:File){if(!file||disabled)return;onStage();const current=++generation.current;setBusy(true);setCsv(null);setSheets([]);setPage(0);setError('');
  try{if(file.size>2*1024*1024||!(/\.(csv|xlsx)$/i.test(file.name)))throw new Error('designer.datasetFile');
   controller.current?.abort();controller.current=new AbortController();const data=await file.arrayBuffer();const workbooks=/\.xlsx$/i.test(file.name)?await readOptionsWorkbook(data,controller.current.signal):[];const parsed=workbooks[0]??parseCsv(new TextDecoder('utf-8',{fatal:true}).decode(data),1000);if(parsed.rows.length>1000)throw new Error('designer.datasetLimit');
   if(current!==generation.current)return;setCsv(parsed);setSheets(workbooks);setSheetName(workbooks[0]?.name??'');setValue('');setLabel('');
  }catch(e){if(current===generation.current)setError(e instanceof TypeError?'designer.csvEncoding':(e as Error).message);}finally{if(current===generation.current)setBusy(false);}}
 let rows:ReturnType<typeof mapCsvOptions>=[],mappingError='';if(csv){try{rows=mapCsvOptions(csv.rows,value,label);}catch(e){mappingError=(e as Error).message;}}
 return <section className="space-y-3" aria-label={t('designer.datasetImport')}>
  <p>{t('designer.datasetHelp')}</p><Input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" label={t('designer.datasetImport')} disabled={disabled||busy} onChange={e=>{void read(e.target.files?.[0]);e.target.value='';}}/>
  {busy&&<p role="status">{t('Loading…')}</p>}{error&&<p role="alert">{error.startsWith('designer.')?t(error):localizeImportError(error,t)}</p>}
  {(csv||error)&&<Button disabled={disabled||busy} onClick={()=>{setCsv(null);setError('');onCancel();}}>{t('designer.csvCancel')}</Button>}
  {csv&&<>{sheets.length>1&&<Select label={t('designer.worksheet')} value={sheetName} disabled={disabled||busy} options={sheets.map(s=>({label:s.name,value:s.name}))} onChange={e=>{setSheetName(e.target.value);setCsv(sheets.find(s=>s.name===e.target.value)!);setValue('');setLabel('');setPage(0);}}/>}<div className="grid gap-3 md:grid-cols-2">{[['designer.csvValue',value,setValue],['designer.csvLabel',label,setLabel]].map(([title,current,set])=><Select key={title as string} aria-label={t(title as string)} label={t(title as string)} value={current as string} disabled={disabled} placeholder={t('designer.csvChoose')} options={csv.headers.map((h,i)=>({label:h,value:String(i)}))} onChange={e=>(set as (v:string)=>void)(e.target.value)}/>)}</div>
  {mappingError?<p role="status">{t(mappingError)}</p>:<TableContainer className="max-h-64 overflow-auto" tabIndex={0} role="region" aria-label={t('designer.csvReview')}><Table><TableHeader><TableRow>{['designer.csvRowNumber','designer.csvValue','designer.csvLabel','designer.csvReview'].map(k=><TableHead key={k}>{t(k)}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(page*50,(page+1)*50).map(r=><TableRow key={r.row}><TableCell>{r.row}</TableCell><TableCell>{r.value}</TableCell><TableCell>{r.label}</TableCell><TableCell>{r.error?t(r.error):t('Ready')}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
  {rows.length>50&&<div className="flex gap-2"><Button disabled={page===0} onClick={()=>setPage(p=>p-1)}>{t('Previous')}</Button><p>{t('designer.datasetPage',{page:page+1,total:Math.ceil(rows.length/50)})}</p><Button disabled={(page+1)*50>=rows.length} onClick={()=>setPage(p=>p+1)}>{t('Next')}</Button></div>}
  <Button disabled={disabled||busy||!!mappingError||rows.some(r=>!!r.error)||!rows.length} onClick={()=>{onApply(rows.map(r=>`${r.value}|${r.label}`).join('\n'));setCsv(null);}}>{t('designer.csvApply')}</Button></>}
 </section>;
}
