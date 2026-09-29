'use client';
import clsx from 'clsx';
import { Button as OpsButton, Input as OpsInput, DateInput as OpsDateInput, TimeInput as OpsTimeInput, Textarea as OpsTextarea, Select as OpsSelect, Checkbox as OpsCheckbox, Segmented as OpsSegmented, SearchInput as OpsSearchInput, useLocalization } from '@pepbits/ops-ui';
import { Children, cloneElement, createContext, forwardRef, isValidElement, useContext, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import {useWriteAccess} from '../../lib/session';
import type { Option } from '../../lib/types';
export const inputBase = 'hc-control';
type Variant = 'primary'|'secondary'|'ghost'|'danger'|'subtle'|'selfpay';
type Size = 'xs'|'sm'|'md'|'lg';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {variant?:Variant;size?:Size;icon?:ReactNode;loading?:boolean;mutation?:boolean}
export const Button = forwardRef<HTMLButtonElement,ButtonProps>(function Button({variant='secondary',size='md',icon,loading,className,children,mutation,...rest},ref) {
  const {t}=useLocalization();
  const canWrite=useWriteAccess();
  return <OpsButton ref={ref} variant={variant==='subtle'?'secondary':variant==='selfpay'?'primary':variant} size={size==='lg'?'md':size} leftIcon={icon} loading={loading} className={clsx('hc-button',`hc-button-${variant}`,`hc-button-${size}`,className)} {...rest} disabled={rest.disabled || (mutation && !canWrite)}>{typeof children==='string'?t(children):children}</OpsButton>;
});
const FieldContext=createContext<string|undefined>(undefined);
function useNamed(props:{'aria-label'?:string;'aria-labelledby'?:string}) {const id=useContext(FieldContext);return !props['aria-label']&&!props['aria-labelledby']&&id?{'aria-labelledby':id}:{};}
export const Input=forwardRef<HTMLInputElement,InputHTMLAttributes<HTMLInputElement>&{invalid?:boolean}>(function Input({invalid,className,type,...props},ref) {
  const named=useNamed(props);const Component=type==='date'?OpsDateInput:type==='time'?OpsTimeInput:OpsInput;
  return <Component className={clsx('hc-control',className)} aria-invalid={invalid||undefined} {...named} {...{...props,ref} as Omit<typeof props,'prefix'>} {...(Component===OpsInput?{type}:{})} />;
});
export function Textarea({invalid,className,...props}:TextareaHTMLAttributes<HTMLTextAreaElement>&{invalid?:boolean}) {const named=useNamed(props);return <OpsTextarea className={clsx('hc-control',className)} aria-invalid={invalid||undefined} {...named} {...props}/>;}
interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>,'onChange'> {options:(Option|string)[];placeholder?:string;invalid?:boolean;onChange?:(value:string,option?:Option)=>void}
export function Select({options,placeholder,invalid,className,onChange,value,...props}:SelectProps) {
  const named=useNamed(props);const opts=options.map(o=>typeof o==='string'?{value:o,label:o}:o);
  return <OpsSelect className={clsx('hc-control',className)} options={opts} placeholder={placeholder??'Select'} value={value??''} aria-invalid={invalid||undefined} {...named} {...props} onChange={e=>onChange?.(e.target.value,opts.find(o=>o.value===e.target.value))}/>;
}
export function Field({label,required,error,hint,className,children,htmlFor}:{label?:string;required?:boolean;error?:string;hint?:string;className?:string;children:ReactNode;htmlFor?:string}) {
  const id=useId();const {t}=useLocalization();
  const all=Children.toArray(children);
  if(all.length===1 && isValidElement(all[0]) && [Input,Textarea,Select].includes(all[0].type as typeof Input)) {
    const child=all[0] as ReactElement<{label?:string;required?:boolean;error?:string;hint?:string;className?:string}>;
    // Shared fields own the label and description. The source Field keeps its surrounding grid cell.
    return <div className={className}>{cloneElement(child,{label,required,error,hint} as any)}</div>;
  }
  return <div className={clsx('min-w-0',className)} role="group" aria-labelledby={label?id:undefined}><label id={id} htmlFor={htmlFor} className="hc-label">{label&&t(label)}{required&&<span aria-hidden className="text-hc-danger-600"> *</span>}</label><FieldContext.Provider value={id}>{children}</FieldContext.Provider>{error?<p role="alert" className="text-hc-danger-600 text-hc-2xs">{t(error)}</p>:hint?<p className="text-hc-ink-mute text-hc-2xs">{t(hint)}</p>:null}</div>;
}
export function Checkbox({checked,onChange,label,disabled,className}:{checked:boolean;onChange:(v:boolean)=>void;label?:ReactNode;disabled?:boolean;className?:string}) {return <OpsCheckbox checked={checked} onChange={event=>onChange(event.target.checked)} label={label} disabled={disabled} className={className}/>;}
export function Segmented<T extends string>({value,onChange,options,size='md',className}:{value:T;onChange:(v:T)=>void;options:{value:T;label:ReactNode;icon?:ReactNode;count?:number}[];size?:'sm'|'md';className?:string;tone?:(v:T)=>string}) {
  return <OpsSegmented label="View or filter" value={value} onChange={v=>onChange(v as T)} size={size} className={clsx('hc-segmented',className)} options={options.map(o=>({value:o.value,label:String(o.label)+(o.count!==undefined?` (${o.count})`:""),icon:o.icon}))}/>;
}
export function SearchInput({value,onChange,placeholder,className,onKeyDown,inputRef,autoFocus}:{value:string;onChange:(v:string)=>void;placeholder?:string;autoFocus?:boolean;className?:string;onKeyDown?:React.KeyboardEventHandler<HTMLInputElement>;inputRef?:React.Ref<HTMLInputElement>}) {
  return <OpsSearchInput value={value} onChange={onChange} placeholder={placeholder} aria-label={placeholder??'Search'} className={clsx('hc-search',className)} onKeyDown={onKeyDown} inputRef={inputRef as React.RefObject<HTMLInputElement|null>}/>;
}
export function FilterChips<T extends string>({value,onChange,options}:{value:T;onChange:(v:T)=>void;options:{value:T;label:string;count?:number}[]}) {return <div className="flex flex-wrap gap-1">{options.map(o=><Button key={o.value} size="sm" variant={o.value===value?'primary':'secondary'} aria-pressed={o.value===value} onClick={()=>onChange(o.value)}>{o.label}{o.count!==undefined&&<span className="hc-num"> {o.count}</span>}</Button>)}</div>;}

export const DateInput = forwardRef<HTMLInputElement,Omit<InputHTMLAttributes<HTMLInputElement>,'type'>&{invalid?:boolean}>(function DateInput({invalid,className,...props},ref){const named=useNamed(props);return <OpsDateInput className={clsx('hc-control',className)} aria-invalid={invalid||undefined} {...named} {...{...props,ref} as Omit<typeof props,'prefix'>}/>;});
export const TimeInput = forwardRef<HTMLInputElement,Omit<InputHTMLAttributes<HTMLInputElement>,'type'>&{invalid?:boolean}>(function TimeInput({invalid,className,...props},ref){const named=useNamed(props);return <OpsTimeInput className={clsx('hc-control',className)} aria-invalid={invalid||undefined} {...named} {...{...props,ref} as Omit<typeof props,'prefix'>}/>;});
