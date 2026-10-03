'use client';
import React,{useMemo} from 'react';
import {ReferenceHostProvider,referenceScopeKey,type ReferenceModuleProps} from '@pepbits/reference-host';
import {DiagnosticSession,DiagnosticParams,matchDiagnosticRoute,useDiagnosticUser} from '@pepbits/reference-diagnostics';
import {ToastProvider} from './components/ui';
import Page0 from './app/(app)/accession/page';
import Page1 from './app/(app)/billing/page';
import Page2 from './app/(app)/collection/page';
import Page3 from './app/(app)/critical/page';
import Page4 from './app/(app)/integration/console/page';
import Page5 from './app/(app)/integration/instrument-orders/page';
import Page6 from './app/(app)/integration/messages/page';
import Page7 from './app/(app)/integration/outbox/page';
import Page8 from './app/(app)/inventory/page';
import Page9 from './app/(app)/masters/[key]/page';
import Page10 from './app/(app)/masters/page';
import Page11 from './app/(app)/orders/[id]/page';
import Page12 from './app/(app)/orders/new/page';
import Page13 from './app/(app)/orders/page';
import Page14 from './app/(app)/outsource/page';
import Page15 from './app/(app)/page';
import Page16 from './app/(app)/patients/[id]/page';
import Page17 from './app/(app)/patients/page';
import Page18 from './app/(app)/report-designer/page';
import Page19 from './app/(app)/reports/page';
import Page20 from './app/(app)/results/sample/[id]/page';
import Page21 from './app/(app)/samples/page';
import Page22 from './app/(app)/settings/page';
import Page23 from './app/(app)/signing/page';
import Page24 from './app/(app)/tat/page';
import Page25 from './app/(app)/worklist/page';
import Page26 from './app/print/labels/page';
import Page27 from './app/print/order/[id]/page';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';

const routes=[
{path:"/accession",Component:Page0 as React.ComponentType<any>},
{path:"/billing",Component:Page1 as React.ComponentType<any>},
{path:"/collection",Component:Page2 as React.ComponentType<any>},
{path:"/critical",Component:Page3 as React.ComponentType<any>},
{path:"/integration/console",Component:Page4 as React.ComponentType<any>},
{path:"/integration/instrument-orders",Component:Page5 as React.ComponentType<any>},
{path:"/integration/messages",Component:Page6 as React.ComponentType<any>},
{path:"/integration/outbox",Component:Page7 as React.ComponentType<any>},
{path:"/inventory",Component:Page8 as React.ComponentType<any>},
{path:"/masters/[key]",Component:Page9 as React.ComponentType<any>},
{path:"/masters",Component:Page10 as React.ComponentType<any>},
{path:"/orders/[id]",Component:Page11 as React.ComponentType<any>},
{path:"/orders/new",Component:Page12 as React.ComponentType<any>},
{path:"/orders",Component:Page13 as React.ComponentType<any>},
{path:"/outsource",Component:Page14 as React.ComponentType<any>},
{path:"/",Component:Page15 as React.ComponentType<any>},
{path:"/patients/[id]",Component:Page16 as React.ComponentType<any>},
{path:"/patients",Component:Page17 as React.ComponentType<any>},
{path:"/report-designer",Component:Page18 as React.ComponentType<any>},
{path:"/reports",Component:Page19 as React.ComponentType<any>},
{path:"/results/sample/[id]",Component:Page20 as React.ComponentType<any>},
{path:"/samples",Component:Page21 as React.ComponentType<any>},
{path:"/settings",Component:Page22 as React.ComponentType<any>},
{path:"/signing",Component:Page23 as React.ComponentType<any>},
{path:"/tat",Component:Page24 as React.ComponentType<any>},
{path:"/worklist",Component:Page25 as React.ComponentType<any>},
{path:"/print/labels",Component:Page26 as React.ComponentType<any>},
{path:"/print/order/[id]",Component:Page27 as React.ComponentType<any>}];
function Workspace({path}:{path:string}){const match=matchDiagnosticRoute(routes,path);if(!match)return <p role="alert"><ReferenceText message="Page not found" /></p>;const Component=match.route.Component;return <DiagnosticParams value={match.params}><Component key={path.split('?')[0]} params={match.params}/></DiagnosticParams>;}
export function DiagnosticModule({path,host}:ReferenceModuleProps){const value=useMemo(()=>({...host,path}),[host,path]);return <ReferenceHostProvider host={value}><div className="diagnostic-lis2" data-reference-module="lis2"><DiagnosticSession key={referenceScopeKey(host.scope)}><ToastProvider><Workspace path={path}/></ToastProvider></DiagnosticSession></div></ReferenceHostProvider>;}
