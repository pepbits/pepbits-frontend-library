"use client";
import {useCallback} from "react";
import {AsyncLookup,SourceButton} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
export interface ComboItem {value:string;label:string;hint?:string;group?:string;muted?:boolean}
/** RCM value/chip adapter. Shared AsyncLookup owns searching, cancellation and keyboard behavior. */
export function Combobox({items=[],value,onChange,multiple,disabled,invalid,placeholder="Choose…",id,max,loadOptions,selectedLabels,label}: {
 items?:ComboItem[];value:string[];onChange:(value:string[])=>void;multiple?:boolean;disabled?:boolean;invalid?:boolean;placeholder?:string;id?:string;max?:number;
 loadOptions?:(query:string,signal:AbortSignal)=>Promise<ComboItem[]>;selectedLabels?:Record<string,string>;label?:string;
}) {
 const {t}=useLocalization();
 const load=useCallback(async(query:string,signal:AbortSignal)=>loadOptions?loadOptions(query,signal):items.filter(item=>(item.label+' '+(item.hint??'')).toLowerCase().includes(query.toLowerCase())),[items,loadOptions]);
 return <div className="space-y-1">
  {value.map(v=><span key={v} className="inline-flex items-center gap-1 rounded bg-mist px-2 py-1"><span>{items.find(item=>item.value===v)?.label??selectedLabels?.[v]??'#'+v}</span><SourceButton disabled={disabled} aria-label={t("Remove {value0}",{value0:selectedLabels?.[v]??v})} onClick={()=>onChange(value.filter(item=>item!==v))}>×</SourceButton></span>)}
  <AsyncLookup id={id} label={label??placeholder} placeholder={placeholder} disabled={disabled||!!(multiple&&max&&value.length>=max)} invalid={invalid} minChars={0} loadOptions={load} getKey={item=>item.value} renderOption={item=><span>{item.label}{item.hint?<small> · {item.hint}</small>:null}</span>} onPick={item=>onChange(multiple?[...new Set([...value,item.value])]:[item.value])}/>
 </div>;
}
