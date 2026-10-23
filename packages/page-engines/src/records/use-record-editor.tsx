"use client";
import {RecoveryNotice, failureFromError} from "@pepbits/components";
import {Card} from "@pepbits/components";
import {TableContainer} from "@pepbits/components";
import {Table, TableHeader, TableBody, TableRow, TableHead, TableCell} from "@pepbits/components";
import {LocalizedText, useLocalization} from "@pepbits/i18n/react";
import {useScreenHost} from "@pepbits/patterns/screen-host";
import React, { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { RecordEditor, type RecordAdapter } from "@pepbits/data";


import {Button} from "@pepbits/ui";

const attached=new WeakSet<object>();
const cleanupTimers = new WeakMap<object, ReturnType<typeof setTimeout>>();
export interface RecordHostValue {adapter:RecordAdapter;identity:string;applicationId:string;sessionAvailable:boolean}
const AdapterContext = createContext<RecordHostValue|null>(null);
/** One authenticated identity and transport for a document's lifetime. */
export const RecordAdapterProvider = AdapterContext.Provider;
export function useRecordHost() {
 const host=useContext(AdapterContext);
 if(!host)throw new Error('Record editing requires a RecordAdapterProvider.');
 return host;
}
export function useSavedRecords(prefix: string) {
  const {adapter,applicationId}=useRecordHost();
  const focused=useScreenHost().document.focused;
  const [records, setRecords] = useState<Array<{ key: string; record: { values: Record<string, unknown> } }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    if (!focused) return;
    const load = () => { void adapter.list<Record<string, unknown>>(JSON.stringify([applicationId, prefix]))
      .then(values => { if (active) { setRecords(values); setError(null); } })
      .catch(() => { if (active) setError("Saved records could not be loaded. Showing the available preview rows."); }); };
    load(); window.addEventListener("focus", load);
    return () => { active = false; window.removeEventListener("focus", load); };
  }, [adapter, applicationId, prefix, focused, refresh]);
  return { records, error, retry: () => setRefresh(value => value + 1) };
}

export function useRecordEditor<T>(recordKey: string, initial: T, createPrefix?: string) {
  const {adapter,applicationId,identity}=useRecordHost(),host=useScreenHost();
  const {document}=host,{t}=useLocalization();
  const key = JSON.stringify([applicationId, recordKey]);
  const cacheKey = `record-editor:${identity}:${key}`;
  const editor = useMemo(() => (document.id?document.draftState[cacheKey] as RecordEditor<T>|undefined:undefined) ?? new RecordEditor(adapter, key, initial, createPrefix ? () => JSON.stringify([applicationId, `${createPrefix}${crypto.randomUUID()}`]) : undefined), [document.id, cacheKey, adapter, createPrefix, applicationId]);
  const state = useSyncExternalStore(editor.subscribe, editor.snapshot, editor.snapshot);
  useEffect(() => {
    clearTimeout(cleanupTimers.get(editor));
    if (document.id) document.setDraftState(cacheKey, editor);
    editor.start();
    if (!document.id || !document.subscribeClose) return () => {
      cleanupTimers.set(editor, setTimeout(() => { void editor.saveDraft().finally(editor.stop); }, 0));
    };
    // The subscription survives suspension. Closure releases it and the editor's API draft.
    if(attached.has(editor))return;
    attached.add(editor);
    const unsubscribe=document.subscribeClose(()=>{
      unsubscribe();
      void editor.close().catch(()=>host.notify(t('Recovery draft could not be removed'),{tone:'warning'}));
    });
    return () => { /* The document owns the close subscription across suspension. */ };
  }, [editor]);
  useEffect(()=>document.reportDirty(editor.dirty || !!state.recovery),[document.reportDirty,editor.dirty,state.recovery]);
  return { editor, ...state, dirty: editor.dirty };
}

export function useRecordField<T, K extends keyof T>(editor: RecordEditor<T>, key: K): [T[K], React.Dispatch<React.SetStateAction<T[K]>>] {
  const state = useSyncExternalStore(editor.subscribe, editor.snapshot, editor.snapshot);
  return [state.values[key], (next) => editor.update(previous => ({ ...previous,
    [key]: typeof next === "function" ? (next as (value: T[K]) => T[K])(previous[key]) : next,
  }))];
}

function RecordComparison({ local, remote }: { local: unknown; remote: unknown }) {
  const flatten = (value: unknown, path = "", output: Record<string, string> = {}): Record<string, string> => {
    if (value !== null && typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) flatten(entry, path ? `${path} / ${key}` : key, output);
    } else output[path] = value === null || value === undefined ? "—" : typeof value === "boolean" ? value ? "Yes" : "No" : String(value);
    return output;
  };
  const mine = flatten(local), theirs = flatten(remote);
  const changes = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])].filter(key => mine[key] !== theirs[key]);
  if (!changes.length) return <p><LocalizedText message="ui.your.values.match.this.version.deecc49a" /></p>;
  return <TableContainer className="max-h-72"><Table className="w-full text-left text-sm"><TableHeader><TableRow><TableHead className="p-2"><LocalizedText message="ui.field.f45fc1df" /></TableHead><TableHead className="p-2"><LocalizedText message="ui.your.edits.1eaa375b" /></TableHead><TableHead className="p-2"><LocalizedText message="ui.latest.version.ef7105b6" /></TableHead></TableRow></TableHeader><TableBody>
    {changes.map(key => <TableRow key={key} className="border-t border-[var(--border)]"><TableHead className="p-2 font-medium">{key.replace(/([a-z])([A-Z])/g, "$1 $2")}</TableHead><TableCell className="max-w-80 break-words p-2">{mine[key] ?? "—"}</TableCell><TableCell className="max-w-80 break-words p-2">{theirs[key] ?? "—"}</TableCell></TableRow>)}
  </TableBody></Table></TableContainer>;
}

export function RecordSaveStatus<T>({ editor }: { editor: RecordEditor<T> }) {
  const {t,dateTime} = useLocalization();
  const {sessionAvailable}=useRecordHost();
  const state = useSyncExternalStore(editor.subscribe, editor.snapshot, editor.snapshot);
  return <Card shadow="none" tone="muted" className="flex flex-wrap items-center gap-2 p-3 text-sm" aria-live="polite">
    {state.loading ? <span><LocalizedText message="ui.loading.saved.record.and.recovery.draft.90568331" /></span> : state.recovery ? <>
      <span><LocalizedText message="ui.a.recovery.draft.is.available.from.567e101f" />{" "}{dateTime(state.recovery.savedAt)}.</span>
      <Button disabled={state.busy||state.incompatibleDraft} onClick={editor.restore}><LocalizedText message="ui.restore.draft.a86e1a9f" /></Button>
      <Button disabled={state.busy} onClick={() => void editor.discard()}><LocalizedText message="ui.discard.recovery.draft.0d6faf2c" /></Button>
    </> : <span>{state.busy ? <LocalizedText message="ui.saving.23e39291" /> : state.error ? <LocalizedText message="ui.changes.need.attention.fbaeabd5" /> : editor.dirty ? state.draftSaved ? <LocalizedText message="ui.recovery.draft.saved.record.has.unsaved.changes.a3d2d0f5" /> : <LocalizedText message="ui.unsaved.changes.recovery.pending.f83c324c" /> : state.lastSaved ? t("Saved {date}", {date:dateTime(state.lastSaved)}) : <LocalizedText message="ui.no.changes.saved.0a823d05" />}</span>}
    {state.incompatibleDraft?<p>{t('draft.incompatible')}</p>:null}
    {state.draftPolicy?.enabled===false?<p>{t('draft.disabled')}</p>:null}
    {state.excludedFields?.length?<p>{t('draft.excluded')}</p>:null}
    {state.draftSavedAt&&state.draftSaved?<p>{t('draft.saved',{date:dateTime(state.draftSavedAt)})}</p>:null}
    {state.error && !state.conflict ? <RecoveryNotice sessionRestored={sessionAvailable} failure={failureFromError(state.failure)} preservesValues={editor.dirty} onReload={()=>window.location.reload()} busy={state.busy} onRetry={()=>void editor.retry()} /> : null}
    {state.conflict ? <>
      <Button disabled={state.busy} onClick={async () => { await editor.review(); }}><LocalizedText message="ui.review.latest.version.c57df6b5" /></Button>
      {state.reviewed ? <div className="w-full">
        <RecordComparison local={state.values} remote={state.baseline} />
        {state.remoteDraft ? <div><b><LocalizedText message="ui.latest.recovery.draft.from.another.editor.21da5598" /></b><RecordComparison local={state.values} remote={state.remoteDraft.values} /></div> : null}
        <Button disabled={state.busy} onClick={() => { editor.keepEdits(); }}><LocalizedText message="ui.keep.my.edits.for.the.next.save.b1e81546" /></Button>
        <Button disabled={state.busy} onClick={() => { void editor.discard(); }}><LocalizedText message="ui.use.saved.version.a5955780" /></Button>
      </div> : null}
    </> : null}
  </Card>;
}
