import {useState} from 'react';
import {useLocalization} from '@pepbits/i18n/react';
import {useNavigation} from '@pepbits/platform/navigation';
import {StatCard} from '@pepbits/components';
import {useFormatters} from '@pepbits/patterns/screen-host';
import type {PageDefinition} from '@pepbits/page-engines/types';
import {useKeystone} from './context';
import {TransactionProcess} from './transaction-process';
import {RecordEditor} from './record';
import {ErpWorklist} from './worklist';
import type {ListResponse,PageDef} from './types';
import type {ErpTarget} from '../../navigation';

export function TransactionProcessPage({def,page,target}:{def:PageDef;page:PageDefinition;target:ErpTarget}) {
  const {variant}=useKeystone(),{t}=useLocalization(),format=useFormatters(),navigation=useNavigation(),[local,setLocal]=useState<ErpTarget>(),[revision,setRevision]=useState(0),[result,setResult]=useState<ListResponse>();
  const current=variant==='erp1'?local:target,open=(next:ErpTarget)=>variant==='erp1'?setLocal(next):navigation.open(next),close=()=>variant==='erp1'?setLocal(undefined):navigation.open({pageId:page.id}),last=result?.rows[0];
  const opened=!!(current?.recordId||current?.mode),list=<ErpWorklist def={def} page={page} onOpen={open} onLoaded={setResult} refreshKey={revision}/>;
  return <section data-erp-page={page.id}><h1>{t(def.title)}</h1>{opened?<RecordEditor def={def} target={current!} onClose={close} onOpen={open} onSaved={row=>{setRevision(value=>value+1);open({pageId:page.id,recordId:row.id,mode:'view'});}}/>:variant==='erp1'?<div className="erp-process-split"><TransactionProcess def={def} target={{pageId:page.id,mode:'new'}} initial={{id:''}} onClose={close} onOpen={open} onSaved={()=>setRevision(value=>value+1)}/><div>{list}</div></div>:<><div className="erp-process-stats"><StatCard label="Last run" value={last?String(last.period):'—'}/><StatCard label="Processed in last run" value={last?format.money(Number(last.gross)):'—'}/><StatCard label="Runs on record" value={result?format.number(result.total):'—'}/><StatCard label="Failed runs" value={result?format.number(Number(result.facets?.Failed??0)):'—'}/></div>{list}</>}</section>;
}
