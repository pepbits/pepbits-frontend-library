'use client';
import React, {useCallback, useMemo, useRef, useState, type ReactNode} from 'react';
import {ShellExtensionsProvider} from '@pepbits/shell';
import {ScreenHostProvider, useScreenHost} from '@pepbits/patterns/screen-host';
import {usePublishAiSources, type AiSources} from '../client';
import {AiProvider, useAiHost, type AiHost} from './provider';
import {AssistantPanel} from './assistant-panel';
import {InlineAiAction} from './inline-action';

export interface AiSourcePublication {id: string; sources: AiSources}
function Publication({id,sources}: AiSourcePublication) {usePublishAiSources(id,sources);return null;}
function AiScreenHost({children}: {children?: ReactNode}) {
  const host = useScreenHost();
  const {userEnabled=true} = useAiHost();
  const serial = useRef(0);
  const [publications,setPublications] = useState<Record<number,AiSourcePublication[]>>({});
  const publishSources = useCallback((sources: readonly unknown[]) => {
    const entries = sources.filter((entry): entry is AiSourcePublication => !!entry && typeof entry === 'object' &&
      'id' in entry && typeof entry.id === 'string' && 'sources' in entry && !!entry.sources && typeof entry.sources === 'object');
    const id = serial.current++;
    setPublications(previous => ({...previous,[id]:entries}));
    return () => setPublications(previous => {const next={...previous};delete next[id];return next;});
  },[]);
  const renderInlineAction = useCallback((props: Readonly<Record<string,unknown>>) => typeof props.useCaseId === 'string'
    ? <InlineAiAction useCaseId={props.useCaseId} label={typeof props.label === 'string' ? props.label : undefined}
        className={typeof props.className === 'string' ? props.className : undefined}/> : null,[]);
  const value=useMemo(()=>({...host,publishSources:userEnabled?publishSources:undefined,renderInlineAction:userEnabled?renderInlineAction:undefined}),[host,userEnabled,publishSources,renderInlineAction]);
  return <ScreenHostProvider value={value}>
    {userEnabled && Object.entries(publications).flatMap(([registration,entries])=>entries.map((entry,index)=><Publication key={`${registration}:${index}`} {...entry}/>))}
    {children}
  </ScreenHostProvider>;
}
const extensions = {ScreenHost:AiScreenHost,helpAssistant:<AssistantPanel/>};
/** Wrap ShellProvider; all root and document ScreenHosts inherit these optional slots. */
export function AiShellExtension({value,children}: {value:AiHost;children?:ReactNode}) {
  return <AiProvider value={value}><ShellExtensionsProvider value={extensions}>{children}</ShellExtensionsProvider></AiProvider>;
}
