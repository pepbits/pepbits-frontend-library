"use client";
import React,{useState} from 'react';
import {Button,SearchInput} from '@pepbits/ui';
import {Card,CardContent,EmptyState} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {areas,type AreaId} from './areas';
import {examples,type Example} from './catalog';
import snippets from './generated/snippets.json';
import {Playground} from './playground';
import {PreferenceControls} from './preference-controls';
export function GalleryPage({area}:{area:AreaId}){
 const {t}=useLocalization(),[query,setQuery]=useState('');const selected=areas.find(item=>item.id===area)!;
 const visible=examples.filter(item=>item.area===area&&`${item.title} ${item.exports.join(' ')}`.toLowerCase().includes(query.toLowerCase()));

 return <div className="gallery" id={`gallery-${area}`} tabIndex={-1}><div className="page-heading" data-tour={`gallery-${area}-heading`}><p className="eyebrow">@pepbits / {area}</p><h1>{t(selected.title)}</h1><p>{t(selected.description)}</p><p>{t('Fictional records and volatile adapters. Reload to reset.')}</p></div>
 <>
 {area==='ai'&&<p>{t('Simulation only. Real servers enforce permissions and limits (PREF-08).')}</p>}
 {area==='playground'?<Playground/>:<PreferenceControls compact/>}<div data-tour={`gallery-${area}-search`}><SearchInput aria-label="Search examples" placeholder="Search examples" value={query} onChange={setQuery}/></div><p role="status">{visible.length} / {examples.filter(item=>item.area===area).length}</p>
 {!visible.length&&<EmptyState/>}{visible.map(example=><ExampleCard key={example.id} example={example}/>)}</>
 </div>;
}
function ExampleCard({example}:{example:Example}){const {t}=useLocalization(),[revision,setRevision]=useState(0),[copy,setCopy]=useState('');const Demo=example.render,source=snippets[example.id as keyof typeof snippets];return <Card as="article" data-example={example.id}><CardContent className="space-y-4"><div className="example-heading"><div><h2>{example.title}</h2><p>{t(example.description)}</p></div><Button onClick={()=>setRevision(value=>value+1)}>{t('Reset example')}</Button></div><p className="export-list" dir="ltr">{example.exports.join(' · ')}</p><div className="example-preview" aria-label={`${t('Live example')}: ${example.title}`}><Demo key={revision}/></div><details><summary>{t('Source code')}</summary><p>Render inside the gallery’s SessionProvider → PreferenceHost → LocalizationProvider → ShellProvider / ScreenHostProvider composition. Settings and data are volatile; adapters in the source implement only the described demo scope.</p><Button onClick={async()=>{try{await navigator.clipboard.writeText(source);setCopy('Copied');}catch{setCopy('Copy failed — select the code manually');}}}>{t('Copy code')}</Button><p role="status">{t(copy)}</p><pre tabIndex={0} aria-label={`${t('Source code')}: ${example.title}`} dir="ltr"><code>{source}</code></pre></details></CardContent></Card>;}
