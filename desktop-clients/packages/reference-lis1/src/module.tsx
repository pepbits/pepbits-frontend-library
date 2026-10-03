'use client';
import React,{useMemo} from 'react';
import {ReferenceHostProvider,referenceScopeKey,type ReferenceModuleProps} from '@pepbits/reference-host';
import {DiagnosticSession,DiagnosticParams,matchDiagnosticRoute,useDiagnosticUser} from '@pepbits/reference-diagnostics';
import {ToastProvider} from './components/ui';
import Page0 from './app/(app)/accession/page';
import Page1 from './app/(app)/automation/page';
import Page2 from './app/(app)/automation/routing/page';
import Page3 from './app/(app)/billing/[id]/page';
import Page4 from './app/(app)/billing/page';
import Page5 from './app/(app)/collection/page';
import Page6 from './app/(app)/criticals/page';
import Page7 from './app/(app)/integration/docs/page';
import Page8 from './app/(app)/integration/page';
import Page9 from './app/(app)/masters/[slug]/page';
import Page10 from './app/(app)/masters/page';
import Page11 from './app/(app)/orders/[id]/page';
import Page12 from './app/(app)/orders/new/page';
import Page13 from './app/(app)/orders/page';
import Page14 from './app/(app)/outsource/page';
import Page15 from './app/(app)/page';
import Page16 from './app/(app)/patients/page';
import Page17 from './app/(app)/reports/[orderId]/page';
import Page18 from './app/(app)/reports/page';
import Page19 from './app/(app)/results/page';
import Page20 from './app/(app)/samples/page';
import Page21 from './app/(app)/users/page';
import Page22 from './app/(app)/validation/page';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';

const routes=[
{path:"/accession",Component:Page0 as React.ComponentType<any>},
{path:"/automation",Component:Page1 as React.ComponentType<any>},
{path:"/automation/routing",Component:Page2 as React.ComponentType<any>},
{path:"/billing/[id]",Component:Page3 as React.ComponentType<any>},
{path:"/billing",Component:Page4 as React.ComponentType<any>},
{path:"/collection",Component:Page5 as React.ComponentType<any>},
{path:"/criticals",Component:Page6 as React.ComponentType<any>},
{path:"/integration/docs",Component:Page7 as React.ComponentType<any>},
{path:"/integration",Component:Page8 as React.ComponentType<any>},
{path:"/masters/[slug]",Component:Page9 as React.ComponentType<any>},
{path:"/masters",Component:Page10 as React.ComponentType<any>},
{path:"/orders/[id]",Component:Page11 as React.ComponentType<any>},
{path:"/orders/new",Component:Page12 as React.ComponentType<any>},
{path:"/orders",Component:Page13 as React.ComponentType<any>},
{path:"/outsource",Component:Page14 as React.ComponentType<any>},
{path:"/",Component:Page15 as React.ComponentType<any>},
{path:"/patients",Component:Page16 as React.ComponentType<any>},
{path:"/reports/[orderId]",Component:Page17 as React.ComponentType<any>},
{path:"/reports",Component:Page18 as React.ComponentType<any>},
{path:"/results",Component:Page19 as React.ComponentType<any>},
{path:"/samples",Component:Page20 as React.ComponentType<any>},
{path:"/users",Component:Page21 as React.ComponentType<any>},
{path:"/validation",Component:Page22 as React.ComponentType<any>}];
function Workspace({path}:{path:string}){const match=matchDiagnosticRoute(routes,path);if(!match)return <p role="alert"><ReferenceText message="Page not found" /></p>;const Component=match.route.Component;return <DiagnosticParams value={match.params}><Component key={path.split('?')[0]} params={match.params}/></DiagnosticParams>;}
export function DiagnosticModule({path,host}:ReferenceModuleProps){const value=useMemo(()=>({...host,path}),[host,path]);return <ReferenceHostProvider host={value}><div className="diagnostic-lis1" data-reference-module="lis1"><DiagnosticSession key={referenceScopeKey(host.scope)}><ToastProvider><Workspace path={path}/></ToastProvider></DiagnosticSession></div></ReferenceHostProvider>;}
