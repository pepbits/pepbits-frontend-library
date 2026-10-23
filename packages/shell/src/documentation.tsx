"use client";
import {BookOpen} from '@pepbits/icons';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {useSession} from '@pepbits/platform';
import type {DocumentationGuide,DocumentationIndex,DocumentationChange} from './documentation-types';
export * from './documentation-types';
import { Button, Input, Select } from "@pepbits/ui";
import {Card} from "@pepbits/components";
import { LocalizedText } from "@pepbits/i18n/react";
import {useNavigation} from '@pepbits/platform';
import {useERP} from './shell-context';
import {useShell} from './shell-context';

const changed='pepbits-documentation-changed';
/** Session-scoped memory cache; no credentials or guide content enter browser storage. */
export function useDocumentationRequest(){
 const {user,status,expired}=useSession();
 const {product,documentation}=useShell();
 const {preferences}=useERP();
 const identity=JSON.stringify([user?.tenantId,user?.id,user?.role,user?.branch,product.id]);
 const transport=documentation?.request;
 const current=useRef({identity,transport,enabled:false});
 current.current={identity,transport,enabled:status==='authenticated'&&!expired&&preferences.documentationEnabled};
 const cache=useRef(new Map<string,unknown>());
 const previous=useRef({identity,transport,enabled:current.current.enabled});
 if(previous.current.identity!==identity||previous.current.transport!==transport||previous.current.enabled!==current.current.enabled){cache.current.clear();previous.current=current.current;}
 return useCallback(async(path:string,init?:RequestInit)=>{
  const valid=()=>current.current.identity===identity&&current.current.transport===transport&&current.current.enabled&&!init?.signal?.aborted;
  if(!transport||!valid())throw Error('Documentation unavailable');
  const headers=new Headers(init?.headers);headers.set('X-Product-Id',product.id);
  const read=!init?.method||init.method==='GET';
  let response:Response;
  try {response=await transport(path,{...init,headers});}
  catch(error){if(read&&valid()&&cache.current.has(path))return {...cache.current.get(path) as object,offline:true};throw error;}
  if(!response.ok||!valid())throw Error('Documentation request failed');
  const body=await response.json();if(!valid())throw Error('Session ended');
  if(read){if(cache.current.size>=50)cache.current.delete(cache.current.keys().next().value!);cache.current.set(path,body);}
  return body;
 },[transport,product.id,identity,status,expired,preferences.documentationEnabled]);
}
function useDocumentationIndex(releaseId?:string,query='',offset=0){
 const {documentation}=useShell(); releaseId??=documentation?.releaseId;
 const request=useDocumentationRequest();const {preferences}=useERP();
 const [data,setData]=useState<DocumentationIndex & {nextOffset:number|null;total:number}>();const [error,setError]=useState(false);const [attempt,retry]=useState(0);
 useEffect(()=>{const controller=new AbortController();setData(undefined);setError(false);if(!releaseId||!preferences.documentationEnabled)return;
  request(`/documentation?releaseId=${encodeURIComponent(releaseId)}&language=${preferences.language}&q=${encodeURIComponent(query)}&offset=${offset}`,{signal:controller.signal}).then(body=>{if(!controller.signal.aborted)setData(body);}).catch(()=>{if(!controller.signal.aborted)setError(true);});
  return()=>controller.abort();
 },[request,releaseId,preferences.language,preferences.documentationEnabled,query,offset,attempt]);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')retry(n=>n+1);};window.addEventListener(changed,refresh);window.addEventListener('focus',refresh);const timer=window.setInterval(refresh,60000);return()=>{window.removeEventListener(changed,refresh);window.removeEventListener('focus',refresh);clearInterval(timer);};},[]);
 return {data,error,retry:()=>retry(n=>n+1)};
}
function useChangeAction(){const request=useDocumentationRequest();return useCallback(async(change:DocumentationChange,action:string)=>{await request('/documentation/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({releaseId:change.releaseId,changeId:change.id,revision:change.revision,action})});window.dispatchEvent(new Event(changed));},[request]);}

export function DocumentationArticle({pageId,releaseId,sectionId,onTour}:{pageId:string;releaseId?:string;sectionId?:string;onTour?:()=>void}){
 const {documentation}=useShell();releaseId??=documentation?.releaseId;
 const request=useDocumentationRequest();const {preferences,t}=useERP();const [guide,setGuide]=useState<DocumentationGuide>();const [offline,setOffline]=useState(false);const [error,setError]=useState(false);const [attempt,retry]=useState(0);
 useEffect(()=>{const controller=new AbortController();setGuide(undefined);setError(false);if(!preferences.documentationEnabled||!releaseId)return;request(`/documentation?releaseId=${encodeURIComponent(releaseId)}&language=${preferences.language}&pageId=${encodeURIComponent(pageId)}`,{signal:controller.signal}).then(body=>{if(!controller.signal.aborted){setGuide(body.guide);setOffline(body.offline===true);}}).catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>controller.abort();},[request,pageId,releaseId,preferences.language,preferences.documentationEnabled,attempt]);
 useEffect(()=>{if(guide&&sectionId)document.getElementById(`doc-${pageId}-${sectionId}`)?.scrollIntoView({block:'start',behavior:preferences.reducedMotion?'auto':'smooth'});},[guide,sectionId,pageId,preferences.reducedMotion]);
 if(!preferences.documentationEnabled||!releaseId)return null;
 if(error)return <p role="alert"><LocalizedText message="Could not load documentation." /> <Button onClick={()=>retry(n=>n+1)}><LocalizedText message="Retry" /></Button></p>;
 if(!guide)return <p role="status"><LocalizedText message="Loading…" /></p>;
 return <article className="space-y-5" data-documentation-page={pageId}>
  <h2 className="text-lg font-bold">{guide.title}</h2>
  {offline?<p role="status"><LocalizedText message="Offline copy. Reconnect to check for updates." /></p>:null}
  {guide.status==='reference'?<p className="rounded-lg bg-[var(--surface-2)] p-3 text-sm"><LocalizedText message="Reference guide; detailed workflow review pending." /></p>:null}
  {guide.translationStatus==='outdated'?<p role="status"><LocalizedText message="documentation.translation.outdated" /></p>:null}
  {guide.requestedLanguage!=='en'&&guide.reviewStatus!=='reviewed'?<p className="text-sm text-[var(--text-muted)]"><LocalizedText message={guide.language==='mixed'?'Some content is shown in English.':'Translation review pending.'} /></p>:null}
  {onTour&&preferences.helperEnabled?<Button onClick={onTour}><LocalizedText message="Start tour" /></Button>:null}
  <nav className="flex flex-wrap gap-3">{guide.sections.map(section=><a key={section.id} className="text-[var(--primary)] underline" href={`#doc-${pageId}-${section.id}`}>{section.title}</a>)}</nav>
  {guide.sections.map(section=><section key={section.id} id={`doc-${pageId}-${section.id}`} className="scroll-mt-4 space-y-2"><h3 className="font-semibold">{section.title}</h3>{section.paragraphs.map((text,index)=><p key={index} className="text-sm leading-relaxed">{text}</p>)}</section>)}
  {guide.fields.length?<section className="space-y-3"><h3 className="font-semibold"><LocalizedText message="Fields" /></h3>{guide.fields.map(field=><div key={field.id} className="rounded-lg border border-[var(--border)] p-3"><p className="font-semibold">{field.label} · {t(field.required?'Required':'Optional')}</p>{field.help?<p className="text-sm">{field.help}</p>:null}{field.rules.map(rule=><p key={rule} className="text-sm">{rule}</p>)}</div>)}</section>:null}
 </article>;
}

export function DocumentationCenter(){
 const {product,documentation}=useShell();
 const currentRelease=documentation?.releaseId??"";
 const {t,format,setHelpOpen,preferences}=useERP(),navigation=useNavigation();const [view,setView]=useState('guides'),[query,setQuery]=useState(''),[offset,setOffset]=useState(0),[releaseId,setRelease]=useState(currentRelease),[selected,setSelected]=useState(''),[section,setSection]=useState(''),[actionError,setActionError]=useState(false);
 const {data,error,retry}=useDocumentationIndex(releaseId,query,offset);const action=useChangeAction();
 async function read(change:DocumentationChange){setActionError(false);setSelected(change.pageId);setSection(change.sectionId);setRelease(change.releaseId);setView('guides');try{await action(change,'read');}catch{setActionError(true);}}
 const release=data?.releases.find(r=>r.id===selected);
 if(!documentation||!preferences.documentationEnabled)return null;
 return <Card className="space-y-4 p-5" data-tour="documentation-center">
  <h1 className="text-xl font-bold"><LocalizedText message="Documentation Center" /></h1>
  <div className="flex flex-wrap gap-2">{([['guides','Page guides'],['releases','Releases'],['patches','Patches'],['changes',"What's new"]] as const).map(([id,title])=><Button key={id} variant={view===id?'primary':'secondary'} aria-pressed={view===id} onClick={()=>{setView(id);setSelected('');setSection('');}}>{t(title)}</Button>)}</div>
  <div className="flex flex-wrap gap-3"><Input aria-label="Search documentation" placeholder="Search…" value={query} onChange={e=>{setQuery(e.target.value);setOffset(0);}} /><Select aria-label="Version" value={releaseId} options={[...(data?.releases??[]),...(!data?.releases.some(r=>r.id===currentRelease)?[{id:currentRelease,version:currentRelease}]:[])].map(r=>({value:r.id,label:r.version}))} onChange={e=>{setRelease(e.target.value);setSelected('');setOffset(0);}} /></div>
  {error?<p role="alert"><LocalizedText message="Could not load documentation." /> <Button onClick={retry}><LocalizedText message="Retry" /></Button></p>:null}
  {actionError?<p role="alert"><LocalizedText message="Could not save reading status." /></p>:null}
  {!data&&!error?<p role="status"><LocalizedText message="Loading…" /></p>:null}
  {view==='changes'?<div className="space-y-3">{data?.changes.length===0?<p><LocalizedText message="No results" /></p>:null}{data?.changes.map(change=><section key={change.id} className="rounded-lg border border-[var(--border)] p-4"><h2 className="font-bold">{!change.readAt&&!change.dismissedAt?<span aria-hidden="true">● </span>:null}{change.title}</h2><p className="my-2 text-sm">{change.summary}</p><div className="flex gap-2"><Button onClick={()=>void read(change)}><LocalizedText message="Read explanation" /></Button>{change.requiresAcknowledgment?<Button disabled={!!change.acknowledgedAt} onClick={()=>void action(change,'acknowledge').catch(()=>setActionError(true))}><LocalizedText message={change.acknowledgedAt?'Acknowledged':'I understand'} /></Button>:null}<Button disabled={!!change.dismissedAt} onClick={()=>void action(change,'dismiss').catch(()=>setActionError(true))}><LocalizedText message="Dismiss" /></Button></div></section>)}</div>:<div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
   <nav className="space-y-2">{view==='guides'?<>{data?.pages.map(page=><Button className="w-full justify-start whitespace-normal text-start" key={page.pageId} aria-pressed={selected===page.pageId} onClick={()=>{setSelected(page.pageId);setSection('');}}>{page.title}</Button>)}<div className="flex gap-2"><Button disabled={offset===0} onClick={()=>setOffset(n=>Math.max(0,n-50))}><LocalizedText message="Previous" /></Button><Button disabled={data?.nextOffset==null} onClick={()=>setOffset(data!.nextOffset!)}><LocalizedText message="Next" /></Button></div></>:<>{data?.releases.filter(r=>view!=='patches'||r.type==='patch').filter(r=>!query||`${r.title} ${r.summary} ${r.version}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(r=><Button className="w-full justify-start whitespace-normal text-start" key={r.id} onClick={()=>setSelected(r.id)}>{r.version}</Button>)}{view==='patches'&&!data?.releases.some(r=>r.type==='patch')?<p className="text-sm"><LocalizedText message="No published patches for this version." /></p>:null}</>}</nav>
   <div className="min-w-0">{selected&&view==='guides'?<DocumentationArticle pageId={selected} releaseId={releaseId} sectionId={section} onTour={()=>{navigation.open({pageId:selected});setHelpOpen(true);}} />:release?<article className="space-y-4"><h2 className="text-lg font-bold">{release.title}</h2><p><bdi>{release.version} · {format.date(release.date)}</bdi></p><p>{release.summary}</p>{release.sections?.filter(s=>s.paragraphs.some(p=>p!==release.summary)).map(s=><section key={s.id}><h3 className="font-semibold">{s.title}</h3>{s.paragraphs.map((text,i)=><p key={i}>{text}</p>)}</section>)}{release.appliesTo?<p><bdi>{release.appliesTo}</bdi></p>:null}{release.parentId?<p><bdi>{release.parentId}</bdi></p>:null}{release.knownIssues.length?<><h3 className="font-semibold"><LocalizedText message="Known issues" /></h3>{release.knownIssues.map(issue=><p key={issue} className="text-sm">{issue}</p>)}</>:null}{(release.guidePageIds??release.pageIds).map(id=><Button key={id} onClick={()=>{setRelease(release.id);setView('guides');setSelected(id);}}>{t(product.pages[id]?.titleKey??product.pages[id]?.title??id)}</Button>)}</article>:<p><LocalizedText message="Select a guide or release to read." /></p>}</div>
  </div>}
 </Card>;
}

export function PageDocumentationNotice(){
 const navigation=useNavigation();
 // Keep release notices in the catalog, outside operational workspaces.
 const {documentation,preferences}=useERP();
 return preferences.documentationEnabled&&documentation?.noticePageIds?.includes(navigation.current.pageId)?<CatalogDocumentationNotice />:null;
}
function CatalogDocumentationNotice(){
 const navigation=useNavigation();const {preferences,setDocumentationOpen}=useERP();const {data}=useDocumentationIndex();const action=useChangeAction();const [error,setError]=useState(false);
 const change=data?.changes.find(c=>c.pageId===navigation.current.pageId&&!c.readAt&&!c.dismissedAt);
 if(!change||!preferences.documentationEnabled)return null;
 return <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm"><span>{change.title}</span><Button size="sm" onClick={()=>{setDocumentationOpen(true);window.dispatchEvent(new CustomEvent('pepbits-documentation-section',{detail:{pageId:change.pageId,sectionId:change.sectionId,releaseId:change.releaseId}}));void action(change,'read').catch(()=>setError(true));}}><LocalizedText message="Read explanation" /></Button><Button size="sm" onClick={()=>void action(change,'dismiss').catch(()=>setError(true))}><LocalizedText message="Dismiss" /></Button>{error?<span role="alert"><LocalizedText message="Could not save reading status." /></span>:null}</div>;
}
export function DocumentationLauncher(){
 const {documentation,preferences}=useERP();
 return documentation&&preferences.documentationEnabled?<ConfiguredDocumentationLauncher/>:null;
}
function ConfiguredDocumentationLauncher(){
 const navigation=useNavigation();const {t,format,documentation,setDocumentationOpen}=useERP();const {data}=useDocumentationIndex();
 return <Button size="sm" aria-label={t("Documentation Center")} title={t("Documentation Center")} onClick={()=>documentation?.centerPageId?navigation.open({pageId:documentation.centerPageId}):setDocumentationOpen(true)}><BookOpen className="size-4" />{data?.unread?<span>{format.number(data.unread)}</span>:null}</Button>;
}
