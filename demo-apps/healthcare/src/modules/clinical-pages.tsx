import React, {useMemo} from 'react';
import {useSession} from '@pepbits/platform/auth';
import {useNavigation} from '@pepbits/platform/navigation';
import {usePreferences} from '@pepbits/preferences/react';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {API_PRODUCT, useRequest} from '../adapters/http';
import {createClinicalTemplateAdapter} from '../adapters/clinical-templates';
import {createClinicalTriageAdapter} from '../adapters/clinical-triage';
import {createClinicalConsultationAdapter} from '../adapters/clinical-consultation';
import {createComprehensiveConsultationAdapter} from '../adapters/comprehensive-consultation';
import {createClinicBillingAdapter} from '../adapters/clinic-billing';
import {createRegistrationAdapter} from '../adapters/op-registration';
import {createCareAdapter} from '../adapters/care-pages';
import {CARE_PAGES, type CarePageId} from '../domain/care-pages';
import {ClinicalPatientWorkspace} from './clinical-templates/workspace';
import {ClinicalTriageWorkspace} from './clinical-triage/workspace';
import {ClinicalConsultationWorkspace} from './clinical-consultation/workspace';
import {OPConsultationWorkspace} from './op-consultation/workspace';
import {ComprehensiveConsultationWorkspace} from './comprehensive-consultation/workspace';
import {BillingClinicWorkspace} from './clinic-billing/workspace';
import {RegistrationWorkspace} from './op-registration/workspace';
import {CareWorkspace} from './care-pages/workspace';
import type {PatientDestination} from './clinical-templates/shared';
import type {PreferenceHost} from './preference-choice';
export function ClinicalPage({page, target}: PageRenderContext) {
  const request = useRequest(), settings = usePreferences(), navigation = useNavigation(), {user} = useSession();
  const adapters = useMemo(() => ({patients: createClinicalTemplateAdapter(request, API_PRODUCT), triage: createClinicalTriageAdapter(request, API_PRODUCT),
    consultation: createClinicalConsultationAdapter(request, API_PRODUCT), comprehensive: createComprehensiveConsultationAdapter(request, API_PRODUCT),
    billing: createClinicBillingAdapter(request, API_PRODUCT), registration: createRegistrationAdapter(request, API_PRODUCT), care: createCareAdapter(request, API_PRODUCT)}), [request]);
  const host: PreferenceHost = {preferences: settings.preferences, preferencePolicy: settings.preferencePolicy,
    preferencesAvailable: settings.preferencesAvailable, onPreferenceChange: (key, value) => {void settings.update({[key]: value});}};
  const scopeKey = JSON.stringify([user?.tenantId, user?.id, user?.role, user?.branch, page.id, target.recordId, target.mode]);
  const common = {...host, scopeKey, patients: adapters.patients, patientId: target.recordId};
  const patientViews: Record<string, PatientDestination['view']> = {'patient-query': 'query', 'patient-record': 'record', 'patient-360': 'overview'};
  if (patientViews[page.id]) return <ClinicalPatientWorkspace {...host} scopeKey={scopeKey} adapter={adapters.patients}
    initialPage={{view: patientViews[page.id]!, patientId: target.recordId, mode: target.mode}}
    onOpen={destination => navigation.open({pageId: {'query': 'patient-query', 'record': 'patient-record', 'overview': 'patient-360'}[destination.view], recordId: destination.patientId, mode: destination.mode})}/>;
  if (page.id === 'clinical-triage') return <ClinicalTriageWorkspace {...common} adapter={adapters.triage}/>;
  if (page.id === 'clinical-consultation') return <ClinicalConsultationWorkspace {...common} adapter={adapters.consultation}/>;
  if (page.id === 'op-consultation') return <OPConsultationWorkspace {...common} adapter={adapters.consultation} triage={adapters.triage}/>;
  if (page.id === 'comprehensive-consultation') return <ComprehensiveConsultationWorkspace {...common} adapter={adapters.comprehensive} triage={adapters.triage}/>;
  if (page.id === 'clinic-billing') return <BillingClinicWorkspace {...common} adapter={adapters.billing}/>;
  if (page.id === 'op-registration') return <RegistrationWorkspace {...common} adapter={adapters.registration}/>;
  if (CARE_PAGES.includes(page.id as CarePageId)) return <CareWorkspace {...host} scopeKey={scopeKey} pageId={page.id as CarePageId} adapter={adapters.care}/>;
  return null;
}
