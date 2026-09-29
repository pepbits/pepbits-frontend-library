'use client';
import { ReferenceHostProvider, referenceScopeKey, useReferenceHost, type ReferenceModuleProps } from '@pepbits/reference-host';
import { LocalizedText } from '@pepbits/ops-ui';
import { useMemo } from 'react';
import {HealthcareSuiteRcmWorkspace} from './components/rcm/HealthcareSuiteRcmWorkspace';
import Dashboard from './app/page';
import Appointments from './app/appointments/page';
import Patients from './app/patients/page';
import NewPatient from './app/patients/new/page';
import PatientRecord from './app/patients/[id]/page';
import Encounters from './app/encounters/page';
import NewEncounter from './app/encounters/new/page';
import EncounterRecord from './app/encounters/[id]/page';
import Approvals from './app/approvals/page';
import HospitalBilling from './app/billing/hospital/page';
import PharmacyBilling from './app/billing/pharmacy/page';
import Invoices from './app/billing/invoices/page';
import Contracts from './app/contracts/page';
import Masters from './app/masters/[entity]/page';
import NewMaster from './app/masters/[entity]/new/page';
import MasterRecord from './app/masters/[entity]/[id]/page';
import { ApiProvider } from './lib/api';
import { SessionProvider, useSession } from './lib/session';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBanner, Spinner } from './components/ui/display';
import { Select } from './components/ui/controls';
import { resolveHealthcareSuiteRoute } from './routes';
function Pages({path}:{path:string}) {
 const canWrite=useSession().session?.canWrite===true;
 const r=resolveHealthcareSuiteRoute(path);
 if(!r)return <div role="status"><LocalizedText message="Healthcare Suite page not found" /></div>;
 if(!canWrite && ['patient-new','encounter-new','master-new'].includes(r.kind))return <ErrorBanner message="Healthcare Suite is read-only for your role."/>;
 switch(r.kind){
  case 'rcm':return <HealthcareSuiteRcmWorkspace section={r.section!}/>;
  case 'dashboard':return <Dashboard/>;case 'appointments':return <Appointments/>;case 'patients':return <Patients/>;case 'patient-new':return <NewPatient/>;case 'patient-record':return <PatientRecord params={{id:r.id!}}/>;
  case 'encounters':return <Encounters/>;case 'encounter-new':return <NewEncounter/>;case 'encounter-record':return <EncounterRecord params={{id:r.id!}}/>;case 'approvals':return <Approvals/>;
  case 'hospital-billing':return <HospitalBilling/>;case 'pharmacy-billing':return <PharmacyBilling/>;case 'invoices':return <Invoices/>;case 'contracts':return <Contracts/>;
  case 'master-list':return <Masters params={{entity:r.entity!}}/>;case 'master-new':return <NewMaster params={{entity:r.entity!}}/>;case 'master-record':return <MasterRecord params={{entity:r.entity!,id:r.id!}}/>;
 }
}
function Workspace({path}:{path:string}) {
 const {session,error,header,facilityId,setFacilityId}=useSession();
 if(error)return <ErrorBanner message={error}/>;
 if(!session)return <Spinner label="Loading Healthcare Suite"/>;
 return <div className="hc-suite flex min-h-0 flex-1 flex-col gap-3" data-reference-module="healthcare-suite">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-hc-lg font-semibold"><LocalizedText message={header.title||'Healthcare Suite'}/></h1>{header.subtitle&&<p className="text-hc-xs text-hc-ink-mute"><LocalizedText message={header.subtitle}/></p>}</div><div className="w-60"><Select aria-label="Healthcare Suite facility" value={facilityId} onChange={setFacilityId} options={session.facilities.filter(f=>f.status!=='Inactive').map(f=>({value:f.id,label:f.name}))}/></div></div>
  {!session.canWrite&&!path.startsWith('/rcm/')&&<p role="status" className="rounded border border-hc-info-100 bg-hc-info-50 px-3 py-2 text-hc-info-700"><LocalizedText message="Healthcare Suite is read-only for your role."/></p>}
  <Pages key={path.split('?')[0]+'|'+facilityId} path={path}/>
 </div>;
}
export function ReferenceHealthcareSuiteModule({path,host}:ReferenceModuleProps) {
 const current=useMemo(()=>({...host,path}),[host,path]);
 return <ReferenceHostProvider host={current}><div className="hc-suite flex min-h-0 flex-1 flex-col"><ApiProvider key={referenceScopeKey(host.scope)}><SessionProvider><ToastProvider><Workspace path={path}/></ToastProvider></SessionProvider></ApiProvider></div></ReferenceHostProvider>;
}
