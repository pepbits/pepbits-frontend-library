import React from 'react';
import {createPageRenderer} from '@pepbits/page-engines/renderer';
import type {NavigationTarget} from '@pepbits/platform/navigation';
import {NotFoundState} from '@pepbits/components';
import {PreferencesPage} from '@pepbits/shell/preferences-page';
import {useSettingsServices} from './providers';
import {ReportsPage} from './modules/reports/page';
import {pages} from './navigation';
function SettingsPage() {return <PreferencesPage showTabPreferences={false} services={useSettingsServices()}/>;}
const Renderer = createPageRenderer({renderers: {reports: ReportsPage, preferences: SettingsPage}});
export function ReportsApplicationPage({target}: {target: NavigationTarget}) {
  const page = pages.find(item => item.id === target.pageId);
  return page ? <Renderer page={page} target={target}/> : <NotFoundState/>;
}
