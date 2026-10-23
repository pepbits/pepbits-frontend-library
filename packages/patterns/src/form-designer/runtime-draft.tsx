'use client';
import React,{useEffect,useState,useRef} from 'react';
import {draftContext,type DraftScope} from '@pepbits/data';
import {dcpWritablePatch,isDcpValues,type DcpLoaded,type DcpRuntimeView,type DcpValue} from '../dcp-fields';
import {useSharedDraft,DraftRecovery} from '../drafts/use-shared-draft';
interface RuntimeDraft {patch:Record<string,DcpValue>;version:string;checksum:string}
/** Reuses the tenant-controlled server recovery service; does not create browser storage. */
export function DcpRuntimeDraft({scope,loaded,view,patch,saved,restore}:{scope:DraftScope;loaded:DcpLoaded;view:DcpRuntimeView;patch:Record<string,DcpValue>;saved:boolean;restore:(patch:Record<string,DcpValue>)=>void}){
 const discarded=useRef('');
 const [context,setContext]=useState('');useEffect(()=>{let active=true;setContext('');void draftContext([scope,loaded.version,loaded.mode,loaded.view.checksum]).then(hash=>{if(active)setContext(hash);});return()=>{active=false;};},[JSON.stringify(scope),loaded.version,loaded.mode,loaded.view.checksum]);
 const data:RuntimeDraft={patch:dcpWritablePatch({...view,values:loaded.view.values},patch),version:loaded.version,checksum:loaded.view.checksum};
 const draft=useSharedDraft(scope,!!context,Object.keys(patch).length&&context?{schemaVersion:1,context,data}:null);
 const old=draft.recovery?.values.data;
 const compatible=!!old&&old.version===loaded.version&&old.checksum===loaded.view.checksum&&isDcpValues(old.patch);
 useEffect(()=>{if(saved&&draft.bundle&&discarded.current!==loaded.version){discarded.current=loaded.version;void draft.discard();}},[saved,draft.bundle,loaded.version]);
 return <DraftRecovery draft={draft} context={context} canRestore={compatible} onRestore={v=>{if(v.version===loaded.version&&v.checksum===loaded.view.checksum&&isDcpValues(v.patch))restore(dcpWritablePatch({...view,values:loaded.view.values},v.patch));}}/>;
}
