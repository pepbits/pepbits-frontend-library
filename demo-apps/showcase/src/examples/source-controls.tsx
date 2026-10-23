'use client';
import React,{useId,useState} from 'react';
import {AsyncLookup,SourceButton,SourceInput,SourceSelect,SourceTextarea,SourceDateInput,inputClass} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
const records=[{id:'sample-1',name:'Fictional sample kit'},{id:'sample-2',name:'Fictional sample box'}];
async function loadOptions(query:string,signal:AbortSignal){return signal.aborted?[]:records.filter(record=>record.name.toLowerCase().includes(query.toLowerCase()));}
/** Volatile example fields; the loader performs no HTTP or persistence. */
export function SourceControlsDemo(){
 const {t}=useLocalization(),id=useId(),[name,setName]=useState('Fictional sample kit'),[status,setStatus]=useState('active'),[date,setDate]=useState('2026-10-23'),[notes,setNotes]=useState(''),[selected,setSelected]=useState('');
 return <form className="space-y-3" onSubmit={event=>{event.preventDefault();setSelected(name);}}>
  <label htmlFor={id+'-name'}>{t('Name')}</label><SourceInput id={id+'-name'} className={inputClass} value={name} onChange={event=>setName(event.target.value)}/>
  <label htmlFor={id+'-status'}>{t('Status')}</label><SourceSelect id={id+'-status'} className={inputClass} value={status} onChange={event=>setStatus(event.target.value)}><option value="active">{t('Active')}</option><option value="pending">{t('Pending')}</option></SourceSelect>
  <label htmlFor={id+'-date'}>{t('Date')}</label><SourceDateInput id={id+'-date'} className={inputClass} value={date} onChange={event=>setDate(event.target.value)}/>
  <label htmlFor={id+'-notes'}>{t('Notes')}</label><SourceTextarea id={id+'-notes'} className={inputClass} value={notes} onChange={event=>setNotes(event.target.value)}/>
  <AsyncLookup label="Search" loadOptions={loadOptions} getKey={record=>record.id} renderOption={record=>record.name} onPick={record=>setSelected(record.name)}/>
  <SourceButton type="submit" className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-2">Save</SourceButton>
  <p role="status">{selected}</p>
 </form>;
}
