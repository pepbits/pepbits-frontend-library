'use client';
import React,{createContext,useContext} from 'react';
import {SourceInput as Input,SourceSelect as Select,SourceTextarea as Textarea,SourceDateInput as DateInput} from '@pepbits/ui';
export {SourceButton} from '@pepbits/ui';
export {Card,Table,TableHeader,TableBody,TableRow,TableHead,TableCell,TableContainer} from '@pepbits/components';
/** Product field groups name the shared native controls without including option/hint text in the name. */
export const FieldName=createContext<string|undefined>(undefined);
function useName(props:{'aria-label'?:string;'aria-labelledby'?:string}){const id=useContext(FieldName);return !props['aria-label']&&!props['aria-labelledby']?id:props['aria-labelledby'];}
export function SourceInput(props:React.ComponentPropsWithRef<'input'>){return <Input {...props} aria-labelledby={useName(props)}/>;}
export function SourceSelect(props:React.ComponentPropsWithRef<'select'>){return <Select {...props} aria-labelledby={useName(props)}/>;}
export function SourceTextarea(props:React.ComponentPropsWithRef<'textarea'>){return <Textarea {...props} aria-labelledby={useName(props)}/>;}
export function SourceDateInput(props:Omit<React.ComponentPropsWithRef<'input'>,'type'>){return <DateInput {...props} aria-labelledby={useName(props)}/>;}
