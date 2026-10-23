"use client";
import React,{useMemo,useState} from 'react';
import {createMemoryDraftAdapter} from '@pepbits/data';
import {DraftHost,DraftRecovery,useSharedDraft} from '@pepbits/patterns/drafts';
import {Button,Input} from '@pepbits/ui';
export function DraftsDemo(){const adapter=useMemo(()=>createMemoryDraftAdapter(),[]),[revision,setRevision]=useState(0);return <DraftHost adapter={adapter} identity="fictional-gallery:showcase:demo-editor" available><p>Session memory only. Type, wait for acknowledgement, then reopen to explicitly restore or discard.</p><Button onClick={()=>setRevision(value=>value+1)}>Reopen draft</Button><Editor key={revision}/></DraftHost>;}
function Editor(){const [name,setName]=useState(''),draft=useSharedDraft({productId:'showcase',pageId:'items',recordId:'demo',kind:'dcp'},true,name?{schemaVersion:1,context:'fictional-item-v1',data:{name}}:null);return <div className="space-y-3"><DraftRecovery draft={draft} context="fictional-item-v1" onRestore={value=>setName(value.name)}/><Input label="Draft note" disabled={draft.busy||!!draft.recovery} value={name} onChange={event=>setName(event.target.value)}/></div>;}
