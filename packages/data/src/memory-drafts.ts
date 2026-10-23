import {createMemoryRecordAdapter, type MemoryRecordOptions} from './memory-records';
import {DEFAULT_DRAFT_POLICY} from './draft-policy';
import type {DraftAdapter, DraftPayload, SharedDraft} from './drafts';

/** Volatile shared drafts for one host identity. Reuses record revision, replay,
 * filtering and retention checks. Never persists to browser or server storage. */
export function createMemoryDraftAdapter(options: MemoryRecordOptions = {}): DraftAdapter {
 const records=createMemoryRecordAdapter(options);
 const key=(scope:Parameters<DraftAdapter['load']>[0])=>JSON.stringify([scope.productId,scope.pageId,scope.recordId,scope.kind]);
 return {
  async load<T>(scope:Parameters<DraftAdapter['load']>[0]) {
   const bundle=await records.load<DraftPayload<T>>(key(scope));
   return {draft:bundle.draft ? {values:bundle.draft.values,version:bundle.draft.version,savedAt:bundle.draft.savedAt,excludedFields:bundle.draft.excludedFields}:null,draftVersion:bundle.draftVersion,draftPolicy:bundle.draftPolicy??DEFAULT_DRAFT_POLICY};
  },
  async save<T>(scope:Parameters<DraftAdapter['save']>[0],values:DraftPayload<T>,version:number,operationId:string):Promise<SharedDraft<T>> {
   const saved=await records.draft(key(scope),values,0,version,operationId);
   return {values:saved.values,version:saved.version,savedAt:saved.savedAt,excludedFields:saved.excludedFields,disabled:saved.disabled};
  },
  discard:(scope,version,operationId)=>records.discard(key(scope),version,operationId),
 };
}
