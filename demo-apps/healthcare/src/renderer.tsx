import {TeleconsultPage} from './modules/teleconsult/page';
import {RcmPage} from './modules/rcm/page';
import React from 'react';
import {createPageRenderer} from '@pepbits/page-engines/renderer';
import type {NavigationTarget} from '@pepbits/platform/navigation';
import {NotFoundState} from '@pepbits/components';
import {PreferencesPage} from '@pepbits/shell/preferences-page';
import {useSettingsServices} from './providers';
import {SuitePage} from './modules/suite/page';
import {ClinicalPage} from './modules/clinical-pages';
import {DiagnosticPage} from './modules/diagnostics/page';
import {PharmacyPage} from './modules/pharmacy/page';
import {pages} from './navigation';
function SettingsPage() {return <PreferencesPage showTabPreferences={false} services={useSettingsServices()}/>;}
const Renderer = createPageRenderer({renderers: {teleconsult:TeleconsultPage,rcm:RcmPage,pharmacy: PharmacyPage, diagnostic: DiagnosticPage, suite: SuitePage, clinical: ClinicalPage, preferences: SettingsPage}});
export function HealthcarePage({target}: {target: NavigationTarget}) {
  const page = pages.find(item => item.id === target.pageId);
  return page ? <Renderer page={page} target={target}/> : <NotFoundState/>;
}
