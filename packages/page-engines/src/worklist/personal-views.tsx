"use client";
import {LocalizedText, useLocalization} from "@pepbits/i18n/react";
import type {WorklistRequest} from "./types";
import React, { useEffect, useRef, useState } from "react";
import {Button, Input} from "@pepbits/ui";
import {Modal, ConfirmDialog} from "@pepbits/components";
export interface PersonalViewLayout { filters: Record<string,string>; columns: string[]; sort: {key:string;direction:"asc"|"desc"}|null; pageSize: number }
interface PersonalView { id:string; label:string; version:number; isDefault:boolean; layout:PersonalViewLayout }
export function PersonalViews({productId,pageId,layout,onApply,allowDefault,onShare,request:authedFetch}: {
  request:WorklistRequest;productId:string;pageId:string;layout:PersonalViewLayout;onApply:(layout:PersonalViewLayout)=>void;allowDefault:()=>boolean;onShare:()=>void;
}) {
  const {t}=useLocalization();
  const [open,setOpen]=useState(false), [views,setViews]=useState<PersonalView[]>([]), [name,setName]=useState("");
  const [editing,setEditing]=useState<PersonalView|null>(null), [deleting,setDeleting]=useState<PersonalView|null>(null);
  const [busy,setBusy]=useState(false), [error,setError]=useState<string|null>(null), [loaded,setLoaded]=useState(false);
  const latest=useRef({layout,onApply,allowDefault});latest.current={layout,onApply,allowDefault};
  const initial=useRef(JSON.stringify(layout)), defaultAttempted=useRef(false), generation=useRef(0);
  const lock = useRef(false);
  const request = async (action:string, extra:Record<string,unknown>={}) => {
    if (lock.current) return false;
    lock.current = true;
    const current=++generation.current;setBusy(true);setError(null);
    try {
      const response=await authedFetch('/personal-views',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId,pageId,action,...extra})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error ?? 'Could not save your views. Retry when the service is available.');
      if(!Array.isArray(body.views))throw new Error('Invalid view response.');
      if(current!==generation.current)return false;
      setViews(body.views);setLoaded(true);
      setEditing(previous => previous ? body.views.find((view:PersonalView) => view.id === previous.id) ?? null : null);
      if(action==='list'&&!defaultAttempted.current) {
        defaultAttempted.current=true;
        const view=body.views.find((view:PersonalView)=>view.isDefault);
        if(view && latest.current.allowDefault() && initial.current===JSON.stringify(latest.current.layout))latest.current.onApply(view.layout);
      }
      return true;
    } catch(e) {if(current===generation.current)setError((e as Error).message);return false;}
    finally {if(current===generation.current){lock.current=false;setBusy(false);}}
  };
  useEffect(()=>{void request('list');return ()=>{generation.current++;lock.current=false;};},[productId,pageId]);
  return <>
    <Button variant="secondary" onClick={()=>setOpen(true)}><LocalizedText message="ui.saved.views.81184cb5" /></Button>
    <Modal open={open} onClose={()=>setOpen(false)} title="ui.personal.saved.views.cbcb5582" subtitle="ui.filters.columns.sort.and.page.size.are.stored.with.your.643172f0" size="lg">
      {error ? <div role="alert" className="mb-3 text-[var(--danger-ink)]">{error}<Button disabled={busy} onClick={()=>void request('list')}><LocalizedText message="ui.reload.views.99af1a0f" /></Button></div> : null}
      <div className="flex items-end gap-2"><Input label={editing ? "Rename view" : "View name"} value={name} maxLength={80} onChange={event=>setName(event.target.value)} />
        <Button disabled={!loaded||busy||!name.trim()} onClick={async()=>{
          if(await request(editing?'rename':'create',editing?{id:editing.id,version:editing.version,label:name}:{label:name,layout})) {setName('');setEditing(null);}
        }}>{editing?<LocalizedText message="ui.save.name.b7297226" />:<LocalizedText message="ui.save.current.view.add4362f" />}</Button>
        {editing?<Button disabled={busy} onClick={()=>{setEditing(null);setName('');}}><LocalizedText message="ui.cancel.rename.3fe54236" /></Button>:null}
      </div>
      <div className="mt-4 grid gap-2">
        {views.map(view=><div key={view.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] p-2">
          <span className="min-w-0 flex-1 break-words">{view.label}{view.isDefault?<LocalizedText message="ui.default.2a7e0b7b" />:''}</span>
          <Button disabled={busy} onClick={()=>{onApply(view.layout);setOpen(false);}}><LocalizedText message="ui.apply.31e392d1" />{" "}{view.label}</Button>
          <Button disabled={busy} onClick={()=>{setEditing(view);setName(view.label);}}><LocalizedText message="ui.rename.3064d79a" />{" "}{view.label}</Button>
          <Button disabled={busy} onClick={()=>void request('default',{id:view.id,version:view.version,isDefault:!view.isDefault})}>{view.isDefault?<LocalizedText message="ui.unset.default.5201a8a8" />:<LocalizedText message="ui.set.default.ae188faa" />} {view.label}</Button>
          <Button disabled={busy} onClick={()=>setDeleting(view)}><LocalizedText message="ui.delete.e2d0a549" />{" "}{view.label}</Button>
        </div>)}
        {!busy&&!views.length?<p><LocalizedText message="ui.no.personal.views.yet.save.the.current.layout.to.create.ac72cfbc" /></p>:null}
        {busy?<p role="status"><LocalizedText message="ui.updating.views.e489ff72" /></p>:null}
      </div>
      <Button className="mt-4" disabled={busy} onClick={onShare}><LocalizedText message="ui.create.a.shared.filter.link.ce50297a" /></Button>
    </Modal>
    <ConfirmDialog open={!!deleting} title="ui.delete.personal.view.95fb7d13" message={t("Delete {view}? Records will not be changed.",{view:deleting?.label ?? t("this view")})} confirmLabel="ui.delete.view.0767ef85"
      onCancel={()=>setDeleting(null)} onConfirm={async()=>{const view=deleting;if(view&&await request('delete',{id:view.id,version:view.version})){setDeleting(null);if(editing?.id===view.id){setEditing(null);setName('');}}}} />
  </>;
}
