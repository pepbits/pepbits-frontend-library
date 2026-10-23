import React, {useMemo} from 'react';
import {useSession as useAuth} from '@pepbits/platform/auth';
import {useNavigation} from '@pepbits/platform/navigation';
import {usePreferences} from '@pepbits/preferences/react';
import {LocalizedText} from '@pepbits/i18n/react';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {API_PRODUCT, useRequest} from '../../adapters/http';
import {hrefFor, targetFromPath, suitePages, type HealthcareTarget} from '../../navigation';
import {SuiteHostProvider, createSuiteTransport, type SuiteHost} from './host';
import {ApiProvider} from './lib/api';
import {SessionProvider, useSession} from './lib/session';
import {Select} from './components/ui/controls';
import {Spinner, ErrorBanner} from './components/ui/display';
import Dashboard from './app/page';
import Patients from './app/patients/page';
import NewPatient from './app/patients/new/page';
import PatientRecord from './app/patients/[id]/page';
import Appointments from './app/appointments/page';
import Encounters from './app/encounters/page';
import NewEncounter from './app/encounters/new/page';
import EncounterRecord from './app/encounters/[id]/page';
import Approvals from './app/approvals/page';
import HospitalBilling from './app/billing/hospital/page';
import PharmacyBilling from './app/billing/pharmacy/page';
import Invoices from './app/billing/invoices/page';
import Contracts from './app/contracts/page';
import {SuiteMasterPage} from './master-page';

export function SuitePage({page, target}: PageRenderContext) {
  const request = useRequest(), auth = useAuth(), settings = usePreferences(), navigation = useNavigation();
  const path = suitePages.find(item => item.id === page.id)!.path + (target.mode === 'new' ? '/new' : target.recordId ? '/' + encodeURIComponent(target.recordId) : '') + ((target as HealthcareTarget).query ? '?' + (target as HealthcareTarget).query : '');
  const host = useMemo<SuiteHost>(() => {
    const user = auth.user!;
    return {scope: {tenantId: user.tenantId, applicationId: API_PRODUCT, branchId: user.branch, userId: user.id, roles: [user.role]},
      preferences: settings.preferences, preferenceHost: {...settings, onPreferenceChange: (key, value) => {void settings.update({[key]: value});}}, path,
      ...createSuiteTransport({fetch: request, applicationId: API_PRODUCT, branchId: user.branch}),
      navigate: destination => navigation.open(targetFromPath('/suite' + destination.split('?')[0], destination.split('?')[1])),
      hrefFor: destination => hrefFor(targetFromPath('/suite' + destination.split('?')[0], destination.split('?')[1]))};
  }, [request, auth.user, settings, navigation, path]);
  return <SuiteHostProvider host={host}><ApiProvider><SessionProvider><SuiteContent page={page} target={target}/></SessionProvider></ApiProvider></SuiteHostProvider>;
}
export function SuiteContent({page, target}: PageRenderContext) {
  const {session, error, facilityId, setFacilityId, header} = useSession();
  if (error) return <ErrorBanner message={error}/>;
  if (!session) return <Spinner label="Loading Healthcare Suite"/>;
  let body: React.ReactNode;
  if (!session.canWrite && target.mode === 'new') body = <ErrorBanner message="Healthcare Suite is read-only for your role."/>;
  else if (page.entity) body = <SuiteMasterPage page={page} target={target}/>;
  else switch (page.id) {
    case 'suite-dashboard': body = <Dashboard/>; break;
    case 'suite-patients': body = target.mode === 'new' ? <NewPatient/> : target.recordId ? <PatientRecord params={{id: target.recordId}}/> : <Patients/>; break;
    case 'suite-encounters': body = target.mode === 'new' ? <NewEncounter/> : target.recordId ? <EncounterRecord params={{id: target.recordId}}/> : <Encounters/>; break;
    case 'suite-appointments': body = <Appointments/>; break;
    case 'suite-approvals': body = <Approvals/>; break;
    case 'suite-hospital-billing': body = <HospitalBilling/>; break;
    case 'suite-pharmacy-billing': body = <PharmacyBilling/>; break;
    case 'suite-invoices': body = <Invoices/>; break;
    case 'suite-contracts': body = <Contracts/>; break;
  }
  return <div className="hc-suite flex min-h-0 flex-1 flex-col gap-3" data-suite-page={page.id}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-hc-xl font-semibold"><LocalizedText message={header.title || page.title}/></h1>
      {header.subtitle && <p className="text-hc-sm text-hc-ink-mute">{header.subtitle}</p>}</div>
      <Select aria-label="Healthcare Suite facility" value={facilityId} onChange={setFacilityId} options={session.facilities.filter(row => row.status !== 'Inactive').map(row => ({value: row.id, label: row.name}))}/></div>
    {!session.canWrite && <p role="status"><LocalizedText message="Healthcare Suite is read-only for your role."/></p>}
    <div key={JSON.stringify([page.id, target.recordId, target.mode, facilityId])} className="flex min-h-0 flex-1 flex-col">{body}</div>
  </div>;
}
