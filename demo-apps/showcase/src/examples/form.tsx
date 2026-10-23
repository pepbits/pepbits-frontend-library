"use client";
import React,{useMemo} from 'react';
import {createMemoryRecordAdapter} from '@pepbits/data';
import {RecordAdapterProvider} from '@pepbits/page-engines/records';
import {DynamicRecordForm} from '@pepbits/page-engines/forms';
import type {PageDefinition,EntitySchema} from '@pepbits/page-engines/types';
const page:PageDefinition={id:'items',title:'Items',subtitle:'Fictional editable records',kind:'form',module:'gallery',entity:'item'};
const schema:EntitySchema={id:'item',plural:'Items',description:'Fictional items',singular:'Item',sections:[{id:'details',title:'Details',description:'Item fields',fields:[{id:'name',label:'Item name',type:'text',required:true,defaultValue:'Fictional item'},{id:'notes',label:'Notes',type:'textarea'}]}]};
export function FormDemo(){const adapter=useMemo(()=>createMemoryRecordAdapter(),[]);return <RecordAdapterProvider value={{adapter,identity:'fictional-gallery:showcase:demo-editor',applicationId:'showcase',sessionAvailable:true}}><DynamicRecordForm schema={schema} page={page} target={{pageId:'items',mode:'edit',recordId:'ITEM-001'}}/></RecordAdapterProvider>;}
