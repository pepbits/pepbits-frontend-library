import React,{useMemo} from 'react';
import {createPageRenderer} from '@pepbits/page-engines/renderer';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {NotFoundState} from '@pepbits/components';
import {PreferencesPage} from '@pepbits/shell/preferences-page';
import {useSettingsServices} from './providers';
import {useSession} from '@pepbits/platform/auth';
import {useRequest} from './adapters/http';
import {createKeystoneRequest} from './adapters/keystone';
import {KeystoneProvider} from './modules/keystone/context';
import {KeystonePage} from './modules/keystone/page';
import {pages,type ErpTarget,type Variant} from './navigation';
function Settings(){return <PreferencesPage showTabPreferences={false} services={useSettingsServices()}/>;}
const Renderer=createPageRenderer({renderers:{keystone:KeystonePage,preferences:Settings}});
export function ErpPage({target}:{target:ErpTarget}){const page=pages.find(p=>p.id===target.pageId),{user}=useSession(),request=useRequest(),variant=(page?.module==='erp2'?'erp2':'erp1') as Variant;
 const scoped=useMemo(()=>createKeystoneRequest(request,variant,user!.branch),[request,variant,user?.branch]);const scopeKey=JSON.stringify([user?.tenantId,user?.id,user?.role,user?.branch,variant,user?.permissions]);
 return page?<KeystoneProvider variant={variant} scopeKey={scopeKey} actor={user??undefined} request={scoped}><Renderer page={page} target={target}/></KeystoneProvider>:<NotFoundState/>;
}
