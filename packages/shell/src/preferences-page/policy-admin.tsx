"use client";
import {DraftPolicyAdmin} from "./draft-policy-admin";
import React,{useEffect,useState} from 'react';
import {DEFAULT_PREFERENCES, PREFERENCE_OPTIONS, PREFERENCE_RANGES, EMPTY_PREFERENCE_POLICY, parsePreferencePolicy, type PreferenceKey, type PreferencePolicy} from '@pepbits/preferences';
import {usePreferencePage} from "./services";
import {useShell} from "../shell-context";
import { Button, Input, Select, Toggle } from "@pepbits/ui";
import { Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pepbits/components";
import { LocalizedText } from "@pepbits/i18n/react";
import {usePreferenceRequest} from "./services";

const POLICY_GROUPS = ["preference.ownSettings","Behaviour", "Shell", "Page", "Notification", "Language & help", "General"] as const;
const POLICY_GROUP_BY_KEY = {
  defaultModule:"preference.ownSettings",
  formNavigation: "Behaviour",
  resultView: "Behaviour",
  previewMode: "Behaviour",
  pageSize: "Behaviour",
  openRecordsInTabs: "Behaviour",
  landingPage: "Behaviour",
  floatingWindows: "Behaviour",
  openRecordsIn: "Behaviour",
  columnLayoutScope: "Behaviour",
  rememberFilters: "Behaviour",
  globalSearchMode: "Behaviour",
  confirmBulkActions: "Behaviour",
  exportFormat: "Behaviour",
  stickyTableHeader: "Behaviour",
  zebraStripes: "Behaviour",
  wrapCellText: "Behaviour",
  billingLayout: "Behaviour",
  sidebarPlacement: "Shell",
  sidebarExpandOn: "Shell",
  sidebarFocusExpand: "Shell",
  sidebarPinned: "Shell",
  sidebarTone: "Shell",
  sidebarTheme: "Shell",
  headerTone: "Shell",
  headerTheme: "Shell",
  keyboardShortcuts: "Shell",
  loadingSkeletons: "Shell",
  theme: "Page",
  fontFamily: "Page",
  fontSizeBase: "Page",
  fontSizeForm: "Page",
  fontSizeResult: "Page",
  density: "Page",
  cornerRadius: "Page",
  toastPosition: "Notification",
  toastDuration: "Notification",
  maxVisibleToasts: "Notification",
  toastStyle: "Notification",
  language: "Language & help",
  helperEnabled: "Language & help",
  documentationEnabled: "Language & help",
  docsPosition: "Language & help",
  reducedMotion: "Language & help",
  showKeyboardHints: "Language & help",
  currencyCode: "General",
  currencyDisplay: "General",
  numberLocale: "General",
  dateFormat: "General",
  decimalPlaces: "General",
  timeFormat: "General",
  negativeStyle: "General",
  clockSeconds: "General",
  clockZone: "General",
} satisfies Record<PreferenceKey, typeof POLICY_GROUPS[number]>;

export function PreferencePolicyAdmin() {
 const request=usePreferenceRequest();const {product}=useShell();const {t,refreshPreferences,canManagePreferencePolicy}=usePreferencePage();
 const [policy,setPolicy]=useState<PreferencePolicy>(EMPTY_PREFERENCE_POLICY);const [ready,setReady]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [saved,setSaved]=useState(false);const [search,setSearch]=useState('');
 const [history,setHistory]=useState<Array<{revision:number;actor:string;at:string}>>([]);
 async function load(){if(!canManagePreferencePolicy)return;setReady(false);setError('');try{
  const response=await request('/preference-policy',{headers:{'X-Product-Id':product.id}});if(!response.ok)throw new Error('Could not load preference policy.');
  const body=await response.json();setPolicy(parsePreferencePolicy(body.policy));setHistory(body.history??[]);setReady(true);
 }catch{setError('Could not load preference policy.');}}
 useEffect(()=>{void load();},[product.id,canManagePreferencePolicy]);
 const change=(key:PreferenceKey,value:unknown,locked:boolean)=>{setSaved(false);setPolicy(current=>({...current,rules:{...current.rules,[key]:{...current.rules[key],value:value as never,locked}}}));};
 async function save(){if(!canManagePreferencePolicy)return;setBusy(true);setError('');setSaved(false);try {
  const response=await request('/preference-policy',{method:'PUT',headers:{'Content-Type':'application/json','X-Product-Id':product.id},body:JSON.stringify(policy)});
  if(response.status===409){setError('Preference policy changed. Reload before saving.');setReady(false);return;}
  if(!response.ok)throw new Error('Could not save preference policy.');
  await load();setSaved(true);await refreshPreferences();window.dispatchEvent(new Event('pepbits-preference-policy-changed'));
 }catch{setError('Could not save preference policy.');}finally{setBusy(false);}}
 const label=(key:string)=>t(`preference.label.${key}`);
 const query=search.trim().toLocaleLowerCase();
 const groups=POLICY_GROUPS.map((title,index)=>({title,id:`preference-policy-group-${index}`,keys:(Object.keys(POLICY_GROUP_BY_KEY) as PreferenceKey[]).filter(key=>POLICY_GROUP_BY_KEY[key]===title && (!query || label(key).toLocaleLowerCase().includes(query) || t(title).toLocaleLowerCase().includes(query)))})).filter(group=>group.keys.length>0);
 return <><DraftPolicyAdmin/><Card className="flex min-w-0 flex-col gap-3 p-4">
  <p className="font-bold"><LocalizedText message="Preference policies" /> — {product.name}</p>
  <p className="text-sm"><LocalizedText message="Set defaults and lock settings for everyone in this tenant and application. Unlocking restores personal choices." /></p>
  {error?<p role="alert"><LocalizedText message={error} /></p>:null}
  {saved?<p role="status"><LocalizedText message="Preference policy saved." /></p>:null}
  <div className="flex gap-2"><Input aria-label="Search settings" placeholder="Search settings…" value={search} onChange={event=>setSearch(event.target.value)} /><Button disabled={busy} onClick={()=>void load()}><LocalizedText message="Reload" /></Button><Button variant="primary" disabled={!ready||busy} onClick={()=>void save()}><LocalizedText message="Save policy" /></Button></div>
  {groups.length===0?<p role="status"><LocalizedText message="No results" /></p>:null}
  {groups.map(group=><section key={group.id} aria-labelledby={group.id} className="min-w-0 overflow-hidden rounded-lg border border-[var(--border)]" data-policy-group={group.title}>
  <h2 id={group.id} className="flex items-center justify-between bg-[var(--surface-2)] px-4 py-3 font-semibold"><LocalizedText message={group.title} /><span className="text-sm text-[var(--text-muted)]">{group.keys.length}</span></h2>
  <Table aria-labelledby={group.id} className="w-full table-fixed"><colgroup><col className="w-[30%]" /><col className="w-[35%]" /><col className="w-[12%]" /><col className="w-[23%]" /></colgroup><TableHeader><TableRow><TableHead><LocalizedText message="Preference" /></TableHead><TableHead><LocalizedText message="Default or locked value" /></TableHead><TableHead><LocalizedText message="Locked" /></TableHead><TableHead><LocalizedText message="Actions" /></TableHead></TableRow></TableHeader><TableBody>
   {group.keys.map(key=>{
    const rule=policy.rules[key],value=rule?.value??DEFAULT_PREFERENCES[key],locked=rule?.locked??false;
    const options=PREFERENCE_OPTIONS[key],range=PREFERENCE_RANGES[key];
    return <TableRow key={key} data-policy-key={key}><TableCell>{label(key)}</TableCell><TableCell>
     <fieldset disabled={!ready||busy} className="m-0 border-0 p-0">
      {key==='defaultModule'?<Select aria-label={label(key)} placeholder="" value={String(value)} options={[{value:"",label:"Use application default"},...Object.values(product.modules).filter(module=>!!module).map(module=>({value:module!.id,label:module!.labelKey??module!.label}))]} onChange={event=>change(key,event.target.value,locked)}/>:typeof value==='boolean'?<Toggle label={label(key)} checked={value} onChange={value=>change(key,value,locked)} />:options?<Select aria-label={label(key)} value={String(value)} options={options.map(value=>({value:String(value),label:t(`preference.option.${key}.${value}`)}))} onChange={event=>change(key,typeof DEFAULT_PREFERENCES[key]==='number'?Number(event.target.value):event.target.value,locked)} />:<Input aria-label={label(key)} type="number" value={Number.isFinite(Number(value))?Number(value):""} min={range?.[0]} max={range?.[1]} step={key==='cornerRadius'?1:0.5} onChange={event=>change(key,event.target.value===''?NaN:Number(event.target.value),locked)} />}
     </fieldset>
    </TableCell><TableCell><Toggle label="Locked" checked={locked} disabled={!ready||busy} onChange={locked=>change(key,value,locked)} /></TableCell><TableCell><Button disabled={!ready||busy||!rule} onClick={()=>{setSaved(false);setPolicy(current=>{const rules={...current.rules};delete rules[key];return {...current,rules};});}}><LocalizedText message="Use application default" /></Button></TableCell></TableRow>;
   })}
  </TableBody></Table>
  </section>)}
  <p className="font-bold"><LocalizedText message="Policy history" /></p>
  {history.map(item=><p key={item.revision} className="text-sm">{item.revision} · {item.actor} · {item.at}</p>)}
 </Card></>;
}
