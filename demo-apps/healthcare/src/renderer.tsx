import {RegistrationHost} from './modules/registration/host';
import {PatientsPage} from './modules/registration/page';
import type {AllyVoraClient} from './adapters/allyvora';
import {FRONT_DESK_KIND, MODULE_ID} from './modules/registration/routes';
import {FrontDeskPage} from './modules/registration/front-desk/page';
import {OutpatientPage} from './modules/outpatient/page';
import {KIND as OUTPATIENT_KIND} from './modules/outpatient/routes';
import {EmergencyPage} from './modules/emergency/page';
import {KIND as EMERGENCY_KIND} from './modules/emergency/routes';
import {MedslotPage} from './modules/medslot/page';
import {MedbandPage} from "./modules/medband/page";
import {SurgiSuitePage} from './modules/surgisuite/page';
import {QualityPage} from './modules/quality/page';
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
export const Renderer = createPageRenderer({renderers: {'allyvora-patients':PatientsPage,[FRONT_DESK_KIND]:FrontDeskPage,[OUTPATIENT_KIND]:OutpatientPage,[EMERGENCY_KIND]:EmergencyPage,medslot:MedslotPage,medband:MedbandPage,surgisuite:SurgiSuitePage,quality:QualityPage,teleconsult:TeleconsultPage,rcm:RcmPage,pharmacy: PharmacyPage, diagnostic: DiagnosticPage, suite: SuitePage, clinical: ClinicalPage, preferences: SettingsPage}});
export function HealthcarePage({target, replace, client}: {target: NavigationTarget; replace?: (href: string) => void; client?: AllyVoraClient}) {
  const page = pages.find(item => item.id === target.pageId);
  if(page?.module===MODULE_ID&&page.kind!==FRONT_DESK_KIND)return <RegistrationHost replace={replace} client={client}><Renderer page={page} target={target}/></RegistrationHost>;
  return page ? <Renderer page={page} target={target}/> : <NotFoundState/>;
}
