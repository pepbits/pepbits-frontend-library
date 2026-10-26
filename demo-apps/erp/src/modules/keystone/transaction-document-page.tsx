import {useRef,useState} from 'react';
import {useLocalization} from '@pepbits/i18n/react';
import type {PageDefinition} from '@pepbits/page-engines/types';
import {ErpWorklist} from './worklist';
import {RecordEditor} from './record';
import type {PageDef} from './types';
import type {ErpTarget} from '../../navigation';

/** ERP1 keeps the original worklist mounted beneath its in-page document editor. */
export function TransactionDocumentPage({def,page}:{def:PageDef;page:PageDefinition}) {
 const {t}=useLocalization(),[target,setTarget]=useState<ErpTarget>(),[revision,setRevision]=useState(0),trigger=useRef<HTMLElement|null>(null);
 const open=(next:ErpTarget)=>{if(!target)trigger.current=document.activeElement as HTMLElement;setTarget(next);};
 return <section data-erp-page={page.id}><h1>{t(def.title)}</h1><div hidden={!!target}><ErpWorklist def={def} page={page} onOpen={open} refreshKey={revision}/></div>{target&&<RecordEditor def={def} target={target} onOpen={setTarget} onClose={()=>{setTarget(undefined);requestAnimationFrame(()=>trigger.current?.focus());}} onSaved={row=>{setRevision(value=>value+1);setTarget({pageId:page.id,recordId:row.id,mode:'view'});}}/>}</section>;
}
