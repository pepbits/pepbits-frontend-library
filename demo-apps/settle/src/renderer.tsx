import React from 'react';
import {createPageRenderer} from '@pepbits/page-engines/renderer';
import {NotFoundState} from '@pepbits/components';
import {PreferencesPage} from '@pepbits/shell/preferences-page';
import {useSettingsServices} from './providers';
import {SettlePage} from './modules/settle/page';
import {pages, type SettleTarget} from './navigation';
function Settings() {return <PreferencesPage showTabPreferences={false} services={useSettingsServices()}/>;}
/** One route per page through the public page-engine renderer registry. */
const Renderer = createPageRenderer({renderers: {settle: SettlePage, preferences: Settings}});
export function SettleAppPage({target}: {target: SettleTarget}) {
  const page = pages.find(p => p.id === target.pageId);
  return page ? <Renderer page={page} target={target}/> : <NotFoundState/>;
}
