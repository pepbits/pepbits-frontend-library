'use client';
import React,{useState} from 'react';
import {Button,Select} from '@pepbits/ui';
import {Modal,TableContainer,Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import type {DesignerDefinition,DesignerRelease} from '@pepbits/data/dcp-designer';
export function compareDesignerDefinitions(before:DesignerDefinition,after:DesignerDefinition){
 const flatten=(d:DesignerDefinition)=>new Map([['definition',{title:d.title,labels:d.labels,layout:d.layout,columns:d.columns,binding:d.binding}],...d.sections.flatMap(s=>[['section:'+s.id,{title:s.title,labels:s.labels,order:d.sections.indexOf(s)}] as [string,unknown],...s.fields.map((f,i)=>['field:'+f.id,{...f,section:s.id,order:i}] as [string,unknown])])] as [string,unknown][]);
 const left=flatten(before),right=flatten(after);return [...new Set([...left.keys(),...right.keys()])].filter(id=>JSON.stringify(left.get(id))!==JSON.stringify(right.get(id))).map(id=>({id,kind:!left.has(id)?'added':!right.has(id)?'removed':'changed',before:left.get(id),after:right.get(id)}));
}
export function ReleaseComparison({definition,releases}:{definition:DesignerDefinition;releases:DesignerRelease[]}){
 const {t}=useLocalization(),[open,setOpen]=useState(false),[selected,setSelected]=useState(''),release=releases.find(r=>r.id===selected),changes=release?compareDesignerDefinitions(release.definition,definition):[];
 return <><Button disabled={!releases.length} onClick={()=>{setSelected(releases.at(-1)?.id??'');setOpen(true);}}>{t('designer.compareRelease')}</Button><Modal open={open} onClose={()=>setOpen(false)} title={t('designer.compareRelease')} size="xl"><div className="space-y-3 p-4"><Select label={t('designer.release')} value={selected} options={releases.map(r=>({value:r.id,label:r.definition.title+' · '+r.version}))} onChange={e=>setSelected(e.target.value)}/><p>{t('designer.compareHelp')}</p>{release&&!changes.length?<p>{t('designer.noChanges')}</p>:<TableContainer><Table><TableHeader><TableRow>{['id','changeKind','before','after'].map(k=><TableHead key={k}>{t('designer.'+k)}</TableHead>)}</TableRow></TableHeader><TableBody>{changes.map(c=><TableRow key={c.id}><TableCell>{c.id}</TableCell><TableCell>{t('designer.'+c.kind)}</TableCell><TableCell><pre className="max-w-md whitespace-pre-wrap break-words">{JSON.stringify(c.before,null,2)}</pre></TableCell><TableCell><pre className="max-w-md whitespace-pre-wrap break-words">{JSON.stringify(c.after,null,2)}</pre></TableCell></TableRow>)}</TableBody></Table></TableContainer>}</div></Modal></>;
}
