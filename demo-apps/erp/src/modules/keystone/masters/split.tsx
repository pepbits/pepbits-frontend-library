import {useCallback,useEffect,useRef,useState} from 'react';
import {Card,Drawer,Modal,RecoveryNotice,failureFromError} from '@pepbits/components';
import {Segmented} from '@pepbits/ui';
import {usePreferences} from '@pepbits/preferences/react';
import {useStoredState} from '../client';
import {ErpWorklist} from '../worklist';
import {RecordEditor} from '../record';
import {StructureRecord} from './structure';
import {nounOf} from '../registry';
import type {PageDef,Row,ListResponse} from '../types';
import type {PageDefinition} from '@pepbits/page-engines/types';
import type {ErpTarget} from '../../../navigation';

/** The source's list remains mounted under the full-table/narrow-screen record overlay. */
export function MasterSplit({def,page}:{def:PageDef;page:PageDefinition}) {
 const {preferences}=usePreferences(),profile=def.template==='profile';
 const [mode,setMode,state]=useStoredState<'split'|'table'>('keystone.mode.'+def.slug,'split',{persist:profile&&preferences.rememberFilters});
 const [wide,setWide]=useState(()=>typeof window==='undefined'||window.innerWidth>=1024);
 useEffect(()=>{const resize=()=>setWide(window.innerWidth>=1024);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 const split=wide&&(!profile||mode==='split'),first=useRef<Row|undefined>(undefined),[target,setTarget]=useState<ErpTarget>(),[revision,setRevision]=useState(0);
 const loaded=useCallback((result:ListResponse)=>{first.current=result.rows[0];if(split&&result.rows[0])setTarget(current=>current??{pageId:page.id,recordId:result.rows[0]!.id,mode:'view'});},[split,page.id]);
 const saved=(row:Row)=>{setRevision(value=>value+1);setTarget({pageId:page.id,recordId:row.id,mode:'view'});};
 const close=()=>{setTarget(undefined);setRevision(value=>value+1);};
 const Editor=profile?RecordEditor:StructureRecord;
 const record=target&&<Editor def={def} target={target} onOpen={setTarget} onClose={close} onSaved={saved}/>;
 const toggle=profile&&wide?<Segmented label="Profile layout" value={mode} onChange={value=>{setMode(value as 'split'|'table');if(value==='split'&&first.current)setTarget(current=>current??{pageId:page.id,recordId:first.current!.id,mode:'view'});}} options={[{value:'split',label:'List and details side by side'},{value:'table',label:'Full table'}]}/>:undefined;
 return <div data-erp-profile={profile?'':undefined} data-master-split data-family={def.template} data-split={split} className={split?'erp-master-split':'erp-master-full'}>
 {state.error&&<RecoveryNotice failure={failureFromError(new Error(state.error))} onRetry={state.retry}/>}
 <Card className="erp-master-list"><ErpWorklist def={def} page={page} onOpen={setTarget} onLoaded={loaded} refreshKey={revision} toolbarExtra={toggle} newLabel={`New ${nounOf(def)}`}/></Card>
 {split?<Card className="erp-master-detail">{record??<p>{profile?'Pick a record':'Pick a structure'}</p>}</Card>:record&&(preferences.previewMode==='center-card'||preferences.previewMode==='center-modal'?<Modal open onClose={close} size="xl" title={def.title}>{record}</Modal>:<Drawer open onClose={close} title={def.title} width="lg" side={preferences.previewMode==='left-drawer'?'left':'right'}>{record}</Drawer>)}
 </div>;
}
