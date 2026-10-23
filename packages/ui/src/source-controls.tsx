'use client';
import React from 'react';
import {useLocalization} from '@pepbits/i18n/react';
/** Native-layout controls for imported design systems. Host CSS supplies appearance;
 * localization and ref/accessibility contracts stay shared. */
export function SourceInput({ref,...props}:React.ComponentPropsWithRef<'input'>){const {t}=useLocalization();return <input {...props} ref={ref} placeholder={props.placeholder?t(props.placeholder):undefined} aria-label={props['aria-label']?t(props['aria-label']):undefined}/>;}
export function SourceTextarea({ref,...props}:React.ComponentPropsWithRef<'textarea'>){const {t}=useLocalization();return <textarea {...props} ref={ref} placeholder={props.placeholder?t(props.placeholder):undefined} aria-label={props['aria-label']?t(props['aria-label']):undefined}/>;}
export function SourceSelect({ref,...props}:React.ComponentPropsWithRef<'select'>){const {t}=useLocalization();return <select {...props} ref={ref} aria-label={props['aria-label']?t(props['aria-label']):undefined}/>;}
export function SourceButton({children,ref,type='button',...props}:React.ComponentPropsWithRef<'button'>){const {t}=useLocalization();return <button {...props} ref={ref} type={type} aria-label={props['aria-label']?t(props['aria-label']):undefined}>{typeof children==='string'?t(children):children}</button>;}

/** A native date field for imported layouts; callers cannot change its temporal type. */
export function SourceDateInput(props:Omit<React.ComponentPropsWithRef<'input'>,'type'>){return <SourceInput {...props} type="date"/>;}

/** Native facility clock fields. Machine values stay independent of display locale. */
export function SourceTimeInput(props:Omit<React.ComponentPropsWithRef<'input'>,'type'>){return <SourceInput {...props} type="time"/>;}
export function SourceDateTimeInput(props:Omit<React.ComponentPropsWithRef<'input'>,'type'>){return <SourceInput {...props} type="datetime-local"/>;}
