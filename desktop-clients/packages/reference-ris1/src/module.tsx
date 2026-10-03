'use client';
import React,{useMemo} from 'react';
import {ReferenceHostProvider,referenceScopeKey,type ReferenceModuleProps} from '@pepbits/reference-host';
import {DiagnosticSession,DiagnosticParams,matchDiagnosticRoute,useDiagnosticUser} from '@pepbits/reference-diagnostics';
import {ToastProvider,SessionCtx} from './components/ui';
import Page0 from './app/(ris)/analytics/page';
import Page1 from './app/(ris)/audit/page';
import Page2 from './app/(ris)/billing/page';
import Page3 from './app/(ris)/critical/page';
import Page4 from './app/(ris)/integration/page';
import Page5 from './app/(ris)/masters/page';
import Page6 from './app/(ris)/orders/[id]/page';
import Page7 from './app/(ris)/orders/page';
import Page8 from './app/(ris)/pacs/page';
import Page9 from './app/(ris)/page';
import Page10 from './app/(ris)/patients/[id]/page';
import Page11 from './app/(ris)/patients/page';
import Page12 from './app/(ris)/reading/[orderId]/page';
import Page13 from './app/(ris)/reading/page';
import Page14 from './app/(ris)/reception/page';
import Page15 from './app/(ris)/schedule/page';
import Page16 from './app/(ris)/technologist/page';
import Page17 from './app/print/invoice/[id]/page';
import Page18 from './app/print/report/[orderId]/page';
import Page19 from './app/viewer/[id]/page';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';

const routes=[
{path:"/analytics",Component:Page0 as React.ComponentType<any>},
{path:"/audit",Component:Page1 as React.ComponentType<any>},
{path:"/billing",Component:Page2 as React.ComponentType<any>},
{path:"/critical",Component:Page3 as React.ComponentType<any>},
{path:"/integration",Component:Page4 as React.ComponentType<any>},
{path:"/masters",Component:Page5 as React.ComponentType<any>},
{path:"/orders/[id]",Component:Page6 as React.ComponentType<any>},
{path:"/orders",Component:Page7 as React.ComponentType<any>},
{path:"/pacs",Component:Page8 as React.ComponentType<any>},
{path:"/",Component:Page9 as React.ComponentType<any>},
{path:"/patients/[id]",Component:Page10 as React.ComponentType<any>},
{path:"/patients",Component:Page11 as React.ComponentType<any>},
{path:"/reading/[orderId]",Component:Page12 as React.ComponentType<any>},
{path:"/reading",Component:Page13 as React.ComponentType<any>},
{path:"/reception",Component:Page14 as React.ComponentType<any>},
{path:"/schedule",Component:Page15 as React.ComponentType<any>},
{path:"/technologist",Component:Page16 as React.ComponentType<any>},
{path:"/print/invoice/[id]",Component:Page17 as React.ComponentType<any>},
{path:"/print/report/[orderId]",Component:Page18 as React.ComponentType<any>},
{path:"/viewer/[id]",Component:Page19 as React.ComponentType<any>}];
function Identity({children}:{children:React.ReactNode}){const user=useDiagnosticUser();return <SessionCtx.Provider value={{user,users:user?[user]:[],switchUser:async()=>{throw new Error('Identity is managed by the host');}}}>{children}</SessionCtx.Provider>;}
function Workspace({path}:{path:string}){const match=matchDiagnosticRoute(routes,path);if(!match)return <p role="alert"><ReferenceText message="Page not found" /></p>;const Component=match.route.Component;return <DiagnosticParams value={match.params}><Component key={path.split('?')[0]} params={match.params}/></DiagnosticParams>;}
export function DiagnosticModule({path,host}:ReferenceModuleProps){const value=useMemo(()=>({...host,path}),[host,path]);return <ReferenceHostProvider host={value}><div className="diagnostic-ris1" data-reference-module="ris1"><DiagnosticSession key={referenceScopeKey(host.scope)}><ToastProvider><Identity><Workspace path={path}/></Identity></ToastProvider></DiagnosticSession></div></ReferenceHostProvider>;}
