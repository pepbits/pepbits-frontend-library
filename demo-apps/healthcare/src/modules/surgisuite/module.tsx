"use client";
import {useMemo} from 'react';
import {LocalizationAliasProvider,LocalizedText} from "@pepbits/i18n/react";
import copy from './surgisuite-copy.json';
import {ReferenceHostProvider,referenceScopeKey,type ReferenceModuleProps} from './host';
import {SurgiSuiteDataProvider} from './lib/api';
import {Shell} from './components/Shell';
import {ToastProvider} from './components/ui';
import Board from './app/(app)/page';import Schedule from './app/(app)/schedule/page';import Cases from './app/(app)/cases/page';import Case from './app/(app)/cases/[id]/page';import Approvals from './app/(app)/approvals/page';import Patients from './app/(app)/patients/page';import Inventory from './app/(app)/inventory/page';import Analytics from './app/(app)/analytics/page';import Masters from './app/(app)/masters/page';
export function ReferenceSurgiSuiteModule({path,host}:ReferenceModuleProps){const current=useMemo(()=>({...host,path}),[host,path]);const p=path.split('?')[0]!;const Page=p==='/'?Board:p==='/schedule'?Schedule:p==='/cases'?Cases:/^\/cases\/\d+$/.test(p)?Case:p==='/approvals'?Approvals:p==='/patients'?Patients:p==='/inventory'?Inventory:p==='/analytics'?Analytics:p==='/masters'?Masters:null;
 return <ReferenceHostProvider host={current}><LocalizationAliasProvider aliases={copy}><div className="reference-surgisuite h-full min-h-0" data-reference-module="surgisuite" data-theme={host.preferences.theme} data-surgisuite-font="host" data-surgisuite-palette="host" data-surgisuite-table="host"><SurgiSuiteDataProvider key={referenceScopeKey(host.scope)}><ToastProvider><Shell>{Page?<Page key={p}/>:<p role="status"><LocalizedText message="Page not found"/></p>}</Shell></ToastProvider></SurgiSuiteDataProvider></div></LocalizationAliasProvider></ReferenceHostProvider>;
}
