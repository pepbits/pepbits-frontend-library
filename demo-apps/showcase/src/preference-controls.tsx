"use client";
import React from 'react';
import {Select, Toggle, RangeInput} from '@pepbits/ui';
import {THEME_OPTIONS, PREFERENCE_OPTIONS, type PreferenceKey} from '@pepbits/preferences';
import {usePreference} from '@pepbits/preferences/react';
import {useLocalization} from '@pepbits/i18n/react';

export function PreferenceChoice({name,label,options}:{name:PreferenceKey;label:string;options:{value:string;label:string}[]}) {
 const preference=usePreference(name);
 return <Select label={label} value={String(preference.value)} disabled={preference.locked} placeholder="" options={options.filter(option=>!preference.allowedValues||preference.allowedValues.some(value=>String(value)===option.value))} onChange={event=>preference.update({[name]:typeof preference.value==='number'?Number(event.target.value):event.target.value})}/>;
}
export function PreferenceToggle({name,label}:{name:'reducedMotion'|'keyboardShortcuts'|'zebraStripes'|'stickyTableHeader'|'wrapCellText';label:string}) {
 const preference=usePreference(name);
 return <Toggle label={label} checked={preference.value} disabled={preference.locked} onChange={value=>preference.update({[name]:value})}/>;
}
export function PreferenceRange({name,label,min,max}:{name:'cornerRadius'|'fontSizeBase'|'fontSizeForm'|'fontSizeResult';label:string;min:number;max:number}) {
 const preference=usePreference(name);
 return <RangeInput label={label} value={preference.value} disabled={preference.locked} min={min} max={max} onChange={value=>preference.update({[name]:value})}/>;
}
export function PreferenceControls({compact=false}:{compact?:boolean}) {
 const {t}=useLocalization();
 const options=(key:keyof typeof PREFERENCE_OPTIONS)=>(PREFERENCE_OPTIONS[key]??[]).map(value=>({value:String(value),label:String(value)}));
 return <div className="settings"><h2>{t('Effective preferences')}</h2>
 <PreferenceChoice name="theme" label="Theme" options={THEME_OPTIONS.map(item=>({value:item.id,label:item.name}))}/>
 <PreferenceChoice name="language" label="Language" options={[{value:'en',label:'English'},{value:'ar',label:'العربية'},{value:'hi',label:'हिन्दी'},{value:'ml',label:'മലയാളം'}]}/>
 <PreferenceChoice name="density" label="Density" options={options('density')}/>
 {!compact&&<><PreferenceChoice name="fontFamily" label="Font family" options={options('fontFamily')}/>
 <PreferenceRange name="fontSizeBase" label="Shell font size" min={11} max={17}/><PreferenceRange name="fontSizeForm" label="Form font size" min={11} max={17}/><PreferenceRange name="fontSizeResult" label="Result font size" min={11} max={17}/><PreferenceRange name="cornerRadius" label="Corner radius" min={0} max={20}/>
 {(['pageSize','formNavigation','resultView','previewMode','dateFormat','timeFormat','numberLocale','currencyCode','exportFormat'] as const).map(key=><PreferenceChoice key={key} name={key} label={key} options={options(key)}/>)}
 <PreferenceToggle name="zebraStripes" label="Striped rows"/><PreferenceToggle name="stickyTableHeader" label="Sticky headers"/><PreferenceToggle name="wrapCellText" label="Wrap cell text"/></>}
 <PreferenceToggle name="reducedMotion" label="Reduced motion"/><PreferenceToggle name="keyboardShortcuts" label="Keyboard shortcuts"/>
 </div>;
}
