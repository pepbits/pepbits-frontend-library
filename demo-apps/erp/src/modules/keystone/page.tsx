import React,{useCallback,useState} from 'react';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {PresentationProvider,NotFoundState} from '@pepbits/components';
import {usePreferences} from '@pepbits/preferences/react';
import {useLocalization} from '@pepbits/i18n/react';
import {useNavigation} from '@pepbits/platform/navigation';
import {PAGES} from './catalog';
import {ReadyPage} from './ReadyPage';
import {useKeystone} from './context';
import {ErpWorklist} from './worklist';
import {RecordEditor} from './record';
import {SpecialPage} from './special';
import {pageId,type ErpTarget} from '../../navigation';
import type {PageDef} from './types';
export const TEMPLATES=Object.fromEntries([...new Set(PAGES.map(p=>p.template))].map(key=>[key,ConfiguredPage]));
export function KeystonePage({page,target}:PageRenderContext){const {variant}=useKeystone(),def=PAGES.find(d=>pageId(variant,d)===page.id),{preferences}=usePreferences();return def?<PresentationProvider value={preferences}><ReadyPage def={def}>{ready=><ConfiguredPage key={page.id} page={page} target={target} def={ready}/>}</ReadyPage></PresentationProvider>:<NotFoundState/>;}
function ConfiguredPage({page,target,def}:PageRenderContext&{def:PageDef}){const {t}=useLocalization();const {variant}=useKeystone(),navigation=useNavigation(),[local,setLocal]=useState<ErpTarget>(),[revision,setRevision]=useState(0);const open=useCallback((next:ErpTarget)=>{if(variant==='erp2')navigation.open(next);else setLocal(next);},[variant,navigation]);const current=variant==='erp2'?target:local;const close=()=>variant==='erp2'?navigation.open({pageId:page.id}):setLocal(undefined);
 if(['dashboard','matrix','ledger','report','settings'].includes(def.template))return <SpecialPage def={def} page={page}/>;
 return <section data-erp-page={page.id}><h1>{t(def.title)}</h1>{current?.mode||current?.recordId?<><RecordEditor def={def} target={current} onClose={close} onOpen={open} onSaved={row=>{setRevision(v=>v+1);open({pageId:page.id,recordId:row.id,mode:'view'});}}/></>:<ErpWorklist key={revision} def={def} page={page} onOpen={open}/>}</section>;
}
