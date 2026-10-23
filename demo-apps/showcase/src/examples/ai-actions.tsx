import React,{useEffect,useMemo,useState} from 'react';
import {Input} from '@pepbits/ui';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {useAiHost} from '@pepbits/ai/ui';
export function AiActionsDemo(){const {userEnabled}=useAiHost();return userEnabled?<PublishedActions/>:<p>AI is off. Enable the AI simulation in the policy playground.</p>;}
function PublishedActions(){
 const host=useScreenHost(),[itemName,setItemName]=useState('Fictional sample kit');
 const publications=useMemo(()=>[{id:'showcase-item',sources:{'page-record':{itemName,classifiedOwner:'Fictional Owner'}}}],[itemName]);
 useEffect(()=>host.publishSources?.(publications),[host.publishSources,publications]);
 return <div className="space-y-3"><p>Simulation only: the echo transport runs in this browser. Real servers enforce authorization, egress and limits (PREF-08). Open the assistant button to compare panel and terminal modes. Both share the same policy as these inline actions.</p><Input label="Fictional item" value={itemName} onChange={event=>setItemName(event.target.value)}/><p>Classified owner (fictional, PII): Fictional Owner. Assembly masks this field before review or dispatch.</p><div data-testid="allowed-ai-action">{host.renderInlineAction?.({useCaseId:'showcase.summarize'})}</div><p>Blocked export action: denied by the simulated use-case policy; no action is rendered.</p><div data-testid="blocked-ai-action">{host.renderInlineAction?.({useCaseId:'showcase.blocked'})}</div></div>;
}
