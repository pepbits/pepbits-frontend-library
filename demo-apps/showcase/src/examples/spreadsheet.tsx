'use client';
import React,{useState} from 'react';
import {SpreadsheetPage,type ExportAudit} from '@pepbits/patterns/spreadsheet';
import {ScreenHostProvider,useScreenHost} from '@pepbits/patterns/screen-host';
/** Fictional costing inputs; rows are local so gallery reset clears them. The audit sink is volatile and contains no cell values. */
export function SpreadsheetDemo(){const host=useScreenHost(),[audit,setAudit]=useState<ExportAudit>();return <ScreenHostProvider value={{...host,document:{...host.document,id:null},can:action=>action==='export'}}><SpreadsheetPage initialRows={[["ITEM-A","Fictional item",2,10,0,5,21,"Example supplier"]]} audit={async entry=>{setAudit(entry);}}/><output aria-live="polite">{audit?`${audit.rows} rows recorded in the in-memory export audit.`:'No export recorded.'}</output></ScreenHostProvider>;}
