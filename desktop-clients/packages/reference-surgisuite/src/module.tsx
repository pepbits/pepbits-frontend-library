"use client";
import {useMemo} from 'react';
import {LocalizationAliasProvider,LocalizedText} from '@pepbits/ops-ui';
import copy from '../surgisuite-copy.json';
import {DEFAULT_PREFERENCES} from '@pepbits/erp-config';
import {ReferenceHostProvider,referenceScopeKey,type ReferenceModuleProps} from '@pepbits/reference-host';
import {SurgiSuiteDataProvider} from './lib/api';
import {Shell} from './components/Shell';
import {ToastProvider} from './components/ui';
import Board from './app/(app)/page';import Schedule from './app/(app)/schedule/page';import Cases from './app/(app)/cases/page';import Case from './app/(app)/cases/[id]/page';import Approvals from './app/(app)/approvals/page';import Patients from './app/(app)/patients/page';import Inventory from './app/(app)/inventory/page';import Analytics from './app/(app)/analytics/page';import Masters from './app/(app)/masters/page';
export function ReferenceSurgiSuiteModule({path,host}:ReferenceModuleProps){const current=useMemo(()=>({...host,path}),[host,path]);const p=path.split('?')[0];const Page=p==='/'?Board:p==='/schedule'?Schedule:p==='/cases'?Cases:/^\/cases\/\d+$/.test(p)?Case:p==='/approvals'?Approvals:p==='/patients'?Patients:p==='/inventory'?Inventory:p==='/analytics'?Analytics:p==='/masters'?Masters:null;
 return <ReferenceHostProvider host={current}><LocalizationAliasProvider aliases={copy}><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Condensed:wght@500;600;700&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;display=swap"/><div className="reference-surgisuite h-full min-h-0" data-reference-module="surgisuite" data-theme={host.preferences.theme} data-surgisuite-font={host.preferences.fontFamily===DEFAULT_PREFERENCES.fontFamily?'reference':'host'} data-surgisuite-palette={host.preferences.theme===DEFAULT_PREFERENCES.theme?'reference':'host'} data-surgisuite-table={host.preferences.density===DEFAULT_PREFERENCES.density&&host.preferences.wrapCellText===DEFAULT_PREFERENCES.wrapCellText?'reference':'host'}><SurgiSuiteDataProvider key={referenceScopeKey(host.scope)}><ToastProvider><Shell>{Page?<Page key={p}/>:<p role="status"><LocalizedText message="Page not found"/></p>}</Shell></ToastProvider></SurgiSuiteDataProvider></div></LocalizationAliasProvider></ReferenceHostProvider>;
}
