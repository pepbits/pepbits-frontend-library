import {useState} from 'react';
import {Input, Select, Button} from '@pepbits/ui';
import {LoadingState, RecoveryNotice, failureFromError} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import type {WorklistFilterControls} from '@pepbits/page-engines/worklist';
import {useFetch,listUrl} from '../client';
import {decodeCondition,encodeCondition} from '../personal-views';
import type {PageDef,ListResponse} from '../types';

export function MasterParent({def,values,onChange}:{def:PageDef}&WorklistFilterControls) {
 const parent=def.parent!,{t}=useLocalization(),[search,setSearch]=useState('');
 const parents=useFetch<ListResponse>(listUrl(parent.entity,{size:500})),counts=useFetch<ListResponse>(listUrl(def.entity,{size:1,facet:parent.key}));
 const decoded=decodeCondition(values[parent.key]??''),selected=Array.isArray(decoded)?String(decoded[0]??''):String(decoded??''),choose=(value:string)=>onChange(parent.key,value?encodeCondition([value]):'');
 const names=(parents.data?.rows??[]).map(row=>({name:String(row.name),code:String(row.code??''),n:counts.data?.facets[String(row.name)]??0})).sort((a,b)=>b.n-a.n||a.name.localeCompare(b.name));
 return <aside className="erp-master-parent" aria-label={t('Parent records')}>
  {parents.error||counts.error?<RecoveryNotice failure={failureFromError(new Error(parents.error??counts.error??''))} onRetry={()=>{parents.reload();counts.reload();}}/>:!parents.data||!counts.data?<LoadingState/>:<>
   <div className="erp-master-parent-desktop"><header><div><h2>{t(parent.label)}</h2><span>{names.length}</span></div><Input label={'Find '+parent.label} value={search} onChange={event=>setSearch(event.target.value)}/></header>
    <ul><li><Button variant="ghost" aria-pressed={!selected} onClick={()=>choose('')}><span>{t('All')} {t(parent.label)}</span><span>{counts.data.total}</span></Button></li>{names.filter(row=>(row.name+' '+row.code).toLowerCase().includes(search.toLowerCase())).map(row=><li key={row.name}><Button variant="ghost" aria-pressed={selected===row.name} onClick={()=>choose(row.name)}><span className="erp-parent-code">{row.code}</span><span className="erp-parent-name">{row.name}</span><span>{row.n}</span></Button></li>)}</ul>
   </div>
   <div className="erp-master-parent-mobile"><Select label={parent.label} value={selected} placeholder="All" options={names.map(row=>({value:row.name,label:`${row.name} (${row.n})`}))} onChange={event=>choose(event.target.value)}/></div>
   {parents.data.total>parents.data.rows.length&&<p role="status">{t('Results are incomplete')}</p>}
  </>}
 </aside>;
}
