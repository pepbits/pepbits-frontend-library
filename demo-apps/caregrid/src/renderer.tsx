import React from 'react';
import {createPageRenderer} from '@pepbits/page-engines/renderer';
import {NotFoundState} from '@pepbits/components';
import {PreferencesPage} from '@pepbits/shell/preferences-page';
import {useSettingsServices} from './providers';
import {pages, type CaregridTarget} from './navigation';
import {CaregridScreen} from './modules/caregrid/page';
function Settings() {return <PreferencesPage showTabPreferences={false} services={useSettingsServices()}/>;}
const Renderer = createPageRenderer({renderers: {caregrid: CaregridScreen, preferences: Settings}});
export function CaregridPage({target}: {target: CaregridTarget}) {
  const page = pages.find(item => item.id === target.pageId);
  return page ? <Renderer page={page} target={target}/> : <NotFoundState/>;
}
