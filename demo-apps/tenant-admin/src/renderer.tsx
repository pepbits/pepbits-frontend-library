'use client';
import React from 'react';
import {createPageRenderer} from '@pepbits/page-engines/renderer';
import {PreferencesPage} from '@pepbits/shell/preferences-page';
import {useShell} from '@pepbits/shell';
import {useSettingsServices} from './providers';
import {pageFor, type TenantAdminTarget} from './navigation';
import {TenantAdminPage} from './modules/tenant-admin/page';

function Settings() {return <PreferencesPage showTabPreferences={false} services={useSettingsServices()}/>;}
/** One renderer registry: every Tenant Admin route uses the module renderer; the shared preferences page keeps its own. */
export const TenantAdminRenderer = createPageRenderer({renderers: {'tenant-admin': TenantAdminPage, preferences: Settings}});
export function TenantAdminRoute({target}: {target: TenantAdminTarget}) {
  const {product} = useShell();
  return <TenantAdminRenderer page={pageFor(target, product)} target={target}/>;
}
