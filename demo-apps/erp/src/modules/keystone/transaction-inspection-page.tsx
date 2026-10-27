import {useCallback,useEffect,useState} from 'react';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {Drawer,Modal} from '@pepbits/components';
import type {PageDefinition} from '@pepbits/page-engines/types';
import {ErpWorklist} from './worklist';
import {RecordEditor} from './record';
import type {PageDef,ListResponse} from './types';
import type {ErpTarget} from '../../navigation';
export function TransactionInspectionPage({def,page}:{def:PageDef;page:PageDefinition}) {
 const {t}=useLocalization(),{preferences}=usePreferences(),[wide,setWide]=useState(false),[target,setTarget]=useState<ErpTarget>(),[revision,setRevision]=useState(0);
 useEffect(()=>{const query=window.matchMedia('(min-width:1024px)'),update=()=>setWide(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 const loaded=useCallback((result:ListResponse)=>{if(wide)setTarget(current=>current??(result.rows[0]?{pageId:page.id,recordId:result.rows[0].id,mode:'view'}:undefined));},[wide,page.id]);
 const sheet=target?<RecordEditor def={def} target={target} onOpen={setTarget} onClose={()=>setTarget(undefined)} onSaved={row=>{setRevision(value=>value+1);setTarget({pageId:page.id,recordId:row.id,mode:'view'});}}/>:<p>{t('Pick an inspection')}</p>;
 return <section data-erp-page={page.id}><h1>{t(def.title)}</h1><div className="erp-inspection-split"><ErpWorklist def={def} page={page} onOpen={setTarget} onLoaded={loaded} refreshKey={revision}/>{wide?sheet:target?preferences.previewMode==='center-card'||preferences.previewMode==='center-modal'?<Modal open title="Inspection sheet" size="lg" onClose={()=>setTarget(undefined)}>{sheet}</Modal>:<Drawer open title="Inspection sheet" width="lg" side={preferences.previewMode==='left-drawer'?'left':'right'} onClose={()=>setTarget(undefined)}>{sheet}</Drawer>:null}</div></section>;
}
