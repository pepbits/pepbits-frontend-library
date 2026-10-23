"use client";
import React,{useMemo,useState} from 'react';
import {createMemoryRecordAdapter} from '@pepbits/data';
import {MasterTransferPanel,PricingExpressionInput,type MasterTransferPort} from '@pepbits/patterns/master-transfer';
export function TransferDemo(){const [expression,setExpression]=useState('quantity * unitPrice'),[count,setCount]=useState(0);
 const port=useMemo<MasterTransferPort>(()=>{const records=createMemoryRecordAdapter();return {preview:async rows=>({valid:rows.every(row=>!!row.code&&!!row.name),rows,issues:rows.flatMap((row,index)=>row.code&&row.name?[]:[{row:index+1,field:'name',message:'Code and name required'}])}),commit:async(rows,_reason,id)=>{for(const [index,row] of rows.entries())await records.save(JSON.stringify(['showcase',row.code]),row,0,0,`${id}-${index}`);setCount(rows.length);},exportPage:async()=>({columns:['code','name'],rows:(await records.list<Record<string,string>>(JSON.stringify(['showcase','']))).map(item=>item.record.values),nextAfter:null})};},[]);
 return <div className="space-y-4"><MasterTransferPanel port={port} columns={['code','name']} name="fictional-items"/><output>Imported: {count}</output><label htmlFor="pricing-expression">Pricing expression</label><PricingExpressionInput id="pricing-expression" value={expression} onChange={setExpression}/></div>;}
