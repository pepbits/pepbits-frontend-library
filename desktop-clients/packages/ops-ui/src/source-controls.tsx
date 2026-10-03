'use client';
import React from 'react';
import {useLocalization} from './localization';
/** Native-layout controls for imported design systems. Host CSS supplies appearance;
 * localization and ref/accessibility contracts stay shared. */
export function SourceInput({ref,...props}:React.ComponentPropsWithRef<'input'>){const {t}=useLocalization();return <input {...props} ref={ref} placeholder={props.placeholder?t(props.placeholder):undefined} aria-label={props['aria-label']?t(props['aria-label']):undefined}/>;}
export function SourceTextarea({ref,...props}:React.ComponentPropsWithRef<'textarea'>){const {t}=useLocalization();return <textarea {...props} ref={ref} placeholder={props.placeholder?t(props.placeholder):undefined} aria-label={props['aria-label']?t(props['aria-label']):undefined}/>;}
export function SourceSelect({ref,...props}:React.ComponentPropsWithRef<'select'>){const {t}=useLocalization();return <select {...props} ref={ref} aria-label={props['aria-label']?t(props['aria-label']):undefined}/>;}
export function SourceButton({children,ref,type='button',...props}:React.ComponentPropsWithRef<'button'>){const {t}=useLocalization();return <button {...props} ref={ref} type={type} aria-label={props['aria-label']?t(props['aria-label']):undefined}>{typeof children==='string'?t(children):children}</button>;}

/** A native date field for imported layouts; callers cannot change its temporal type. */
export function SourceDateInput(props:Omit<React.ComponentPropsWithRef<'input'>,'type'>){return <SourceInput {...props} type="date"/>;}
/** A native date/time field with the same host localization and ref contract. */
export function SourceDateTimeInput(props:Omit<React.ComponentPropsWithRef<'input'>,'type'>){return <SourceInput {...props} type="datetime-local"/>;}

/** A native time field for imported layouts with the shared ref and localization contract. */
export function SourceTimeInput(props:Omit<React.ComponentPropsWithRef<'input'>,'type'>){return <SourceInput {...props} type="time"/>;}
