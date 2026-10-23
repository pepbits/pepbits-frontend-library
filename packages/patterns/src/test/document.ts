import type {ScreenDocument} from '../screen-host';

/** In-memory document owner for testing suspension, focus and close guards. No persistence. */
export function createTestDocument(id: string, focused = true) {
  const drafts: Record<string,unknown> = {}, listeners = new Set<() => void>();
  let dirty = false;
  const document: ScreenDocument = {id,focused,draftState:drafts,
    setDraftState:(key,value)=>{drafts[key]=value;},reportDirty:value=>{dirty=value;},
    subscribeClose:listener=>{listeners.add(listener);return ()=>{listeners.delete(listener);};}};
  return {document,metadata:()=>({id,dirty}),close:(discardChanges=false)=>{
    if(dirty&&!discardChanges)return false;
    for(const listener of [...listeners])listener();
    listeners.clear();for(const key of Object.keys(drafts))delete drafts[key];
    return true;
  }};
}
