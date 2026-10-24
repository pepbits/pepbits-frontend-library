import React from 'react';
import {TestHostProvider,type TestHostValue} from './host';
import {KeystonePage} from '../modules/keystone/page';
import {buildRouteManifest} from '../modules/keystone/routes';
import {PAGES} from '../modules/keystone/catalog';
import {pages,targetFromPath,type Variant} from '../navigation';
import {SessionProvider} from '@pepbits/platform/auth';
import {LoginScreen} from '@pepbits/shell/login';
/** Source module tests supply the same controlled public providers used by the app. */
export function Module({path,host,variant}:{path:string;host:TestHostValue;variant:Variant}){const target=targetFromPath('/'+variant+(path==='/'?'':path.split('?')[0]),path.split('?')[1]),page=pages.find(p=>p.id===target.pageId)!;return <TestHostProvider key={JSON.stringify([host.scope,variant])} host={{...host,scope:{...host.scope,moduleId:'reference-'+variant}}}>{path==='/login'?<SessionProvider value={{status:'anonymous',user:null,login:async()=>null,logout:async()=>{}}}><LoginScreen brand={{name:'ERP',tagline:'Fictional workflows'}}/></SessionProvider>:<KeystonePage page={page} target={target}/>}</TestHostProvider>;}
export const ReferenceErp1Module=(props:{path:string;host:TestHostValue})=><Module {...props} variant="erp1"/>;
export const ReferenceErp2Module=(props:{path:string;host:TestHostValue})=><Module {...props} variant="erp2"/>;
export const referenceErp1Routes=buildRouteManifest(PAGES),referenceErp2Routes=referenceErp1Routes;
