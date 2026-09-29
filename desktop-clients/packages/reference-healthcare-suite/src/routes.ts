import { NAV } from './components/shell/nav';
import { MASTERS } from './lib/masters';
export const HEALTHCARE_SUITE_NAV = NAV;
export const healthcareSuiteRoutes = NAV.flatMap(group=>group.links.map(link=>({path:link.href,title:link.label})));
export type HealthcareSuiteRoute = {kind:'dashboard'|'appointments'|'patients'|'patient-new'|'patient-record'|'encounters'|'encounter-new'|'encounter-record'|'approvals'|'hospital-billing'|'pharmacy-billing'|'invoices'|'contracts'|'master-list'|'master-new'|'master-record';entity?:string;id?:string};
export function resolveHealthcareSuiteRoute(path:string):HealthcareSuiteRoute|null {
 const pathname=path.split('?')[0].replace(/\/$/,'')||'/';
 const fixed:Record<string,HealthcareSuiteRoute['kind']>={'/':'dashboard','/appointments':'appointments','/patients':'patients','/patients/new':'patient-new','/encounters':'encounters','/encounters/new':'encounter-new','/approvals':'approvals','/billing/hospital':'hospital-billing','/billing/pharmacy':'pharmacy-billing','/billing/invoices':'invoices','/contracts':'contracts'};
 if(fixed[pathname])return {kind:fixed[pathname]};
 const segments=pathname.split('/').slice(1);
 try {
  if(segments[0]==='masters' && segments.length>=2 && segments.length<=3){const entity=decodeURIComponent(segments[1]);if(!Object.prototype.hasOwnProperty.call(MASTERS,entity))return null;const id=segments[2]?decodeURIComponent(segments[2]):undefined;return {kind:id==='new'?'master-new':id?'master-record':'master-list',entity,id};}
  if(segments.length===2 && ['patients','encounters'].includes(segments[0]))return {kind:segments[0]==='patients'?'patient-record':'encounter-record',id:decodeURIComponent(segments[1])};
 }catch{return null;}
 return null;
}
