import {useState} from 'react';
import {useLocalization} from '@pepbits/i18n/react';
import {useNavigation} from '@pepbits/platform/navigation';
import type {PageDefinition} from '@pepbits/page-engines/types';
import {useKeystone} from './context';
import {RequestBalances} from './transaction-request';
import {RecordEditor} from './record';
import {ErpWorklist} from './worklist';
import type {PageDef} from './types';
import type {ErpTarget} from '../../navigation';

export function TransactionRequestPage({def,page,target}:{def:PageDef;page:PageDefinition;target:ErpTarget}) {
  const {variant}=useKeystone(),{t}=useLocalization(),navigation=useNavigation(),[local,setLocal]=useState<ErpTarget>(),[revision,setRevision]=useState(0);
  const current=variant==='erp1'?local:target,open=(next:ErpTarget)=>variant==='erp1'?setLocal(next):navigation.open(next),close=()=>variant==='erp1'?setLocal(undefined):navigation.open({pageId:page.id});
  const opened=!!(current?.mode||current?.recordId);
  return <section data-erp-page={page.id} className="erp-request-page"><h1>{t(def.title)}</h1>{(variant==='erp1'||!opened)&&<><RequestBalances def={def}/><ErpWorklist def={def} page={page} onOpen={open} refreshKey={revision}/></>}{opened&&<RecordEditor def={def} target={current!} onClose={close} onOpen={open} onSaved={row=>{setRevision(value=>value+1);if(variant==='erp1')close();else open({pageId:page.id,recordId:row.id,mode:'view'});}}/>}</section>;
}
