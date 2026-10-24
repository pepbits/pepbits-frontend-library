'use client';
import React, {useMemo} from 'react';
import {createPageRenderer} from '@pepbits/page-engines/renderer';
import {NotFoundState} from '@pepbits/components';
import {PreferencesPage} from '@pepbits/shell/preferences-page';
import {useSession} from '@pepbits/platform/auth';
import {useSettingsServices} from './providers';
import {createAllyVoraClient, createAllyVoraTransport, configuredAllyVoraBase, type AllyVoraClient} from './adapters/allyvora';
import {AllyVoraProvider} from './modules/registration/context';
import {FormLayoutPage, PatientsPage} from './modules/registration/page';
import {pages, PAGE, type AllyVoraTarget} from './navigation';

function Settings() {return <PreferencesPage showTabPreferences={false} services={useSettingsServices()}/>;}
export const Renderer = createPageRenderer({renderers: {'allyvora-patients': PatientsPage, 'allyvora-layout': FormLayoutPage, preferences: Settings}});

/** Route host: one registered renderer per page; module state is scoped to the signed-in identity. */
export function AllyVoraPage({target, replace, client: supplied}: {target: AllyVoraTarget; replace: (href: string) => void; client?: AllyVoraClient}) {
  const page = pages.find(item => item.id === target.pageId), {user} = useSession();
  const client = useMemo(() => supplied ?? createAllyVoraClient(createAllyVoraTransport(configuredAllyVoraBase())), [supplied]);
  const scopeKey = JSON.stringify([user?.tenantId, user?.id, user?.role, user?.branch]);
  if (!page) return <div className="p-6"><NotFoundState/></div>;
  if (page.id === PAGE.preferences) return <Renderer page={page} target={target}/>;
  return <AllyVoraProvider key={scopeKey} client={client} replace={replace}><Renderer page={page} target={target}/></AllyVoraProvider>;
}
