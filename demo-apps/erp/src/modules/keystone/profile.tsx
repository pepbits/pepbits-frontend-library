import {useCallback,useState,useRef} from 'react';
import {Card,RecoveryNotice,failureFromError} from '@pepbits/components';
import {Segmented} from '@pepbits/ui';
import {usePreferences} from '@pepbits/preferences/react';
import {useStoredState} from './client';
import {ErpWorklist} from './worklist';
import {RecordEditor} from './record';
import type {PageDef,Row,ListResponse} from './types';
import type {PageDefinition} from '@pepbits/page-engines/types';
import type {ErpTarget} from '../../navigation';

/** ERP1 profile composition over the same worklist/record engines as ERP2. */
export function ProfilePage({def,page}:{def:PageDef;page:PageDefinition}) {
 const {preferences}=usePreferences(),[mode,setMode,state]=useStoredState<'split'|'table'>('keystone.mode.'+def.slug,'split',{persist:preferences.rememberFilters});
 const first=useRef<Row|undefined>(undefined);
 const [target,setTarget]=useState<ErpTarget>(),[revision,setRevision]=useState(0);
 const loaded=useCallback((result:ListResponse)=>{first.current=result.rows[0];if(mode==='split'&&result.rows[0])setTarget(current=>current??{pageId:page.id,recordId:result.rows[0]!.id,mode:'view'});},[mode,page.id]);
 const saved=(row:Row)=>{setRevision(value=>value+1);setTarget({pageId:page.id,recordId:row.id,mode:'view'});};
 const record=target&&<RecordEditor def={def} target={target} onOpen={setTarget} onClose={()=>setTarget(undefined)} onSaved={saved}/>;
 return <div data-erp-profile className="space-y-3"><Segmented label="Profile layout" value={mode} onChange={value=>{setMode(value as 'split'|'table');if(value==='split'&&first.current)setTarget(current=>current??{pageId:page.id,recordId:first.current!.id,mode:'view'});}} options={[{value:'split',label:'List and details side by side'},{value:'table',label:'Full table'}]}/>
  {state.error&&<RecoveryNotice failure={failureFromError(new Error(state.error))} onRetry={state.retry}/>}
  <div className={mode==='split'?'erp-profile-columns':''}>
   {(mode==='split'||!target)&&<Card className="min-w-0"><ErpWorklist key={revision} def={def} page={page} onOpen={setTarget} onLoaded={loaded}/></Card>}
   {record&&<Card className="min-w-0 p-3">{record}</Card>}
  </div>
 </div>;
}
