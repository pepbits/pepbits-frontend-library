import {navigation as allyVoraNavigation, pages as allyVoraPages, PAGE as ALLYVORA_PAGE, targetFromPath as allyVoraTargetFromPath, hrefFor as allyVoraHrefFor, type AllyVoraTarget, REGISTRATION_ROLES} from './modules/registration/routes';
import {navigation as outpatientNavigation, pages as outpatientPages, MODULE_ID as OUTPATIENT_MODULE, targetFromPath as outpatientTargetFromPath, hrefFor as outpatientHrefFor} from './modules/outpatient/routes';
import {medslotRoutes,medslotNavigation,medslotRoles,medslotPageRoles,resolveMedslotRoute} from './modules/medslot/routes';
import {medbandRoles,medbandRoutes,medbandNavigation,resolveMedbandRoute} from "./modules/medband/routes";
import {surgisuiteRoutes,surgisuiteNavigation,resolveSurgiSuiteRoute,surgisuiteRoles} from './modules/surgisuite/routes';
import {qualityRoutes,qualityNavigation,resolveQualityRoute} from './modules/quality/routes';
import {teleconsultPages,teleconsultMenus} from './modules/teleconsult/navigation';
import {resolveProviderRoute} from './modules/teleconsult/provider/routes';
import {resolvePatientRoute} from './modules/teleconsult/patient/routes';
import rcmCategories from './modules/rcm/navigation.json';
import {resolveRcmRoute} from './modules/rcm/routes';
import {pharmacyNavigation,resolvePharmacyRoute} from './modules/pharmacy/routes';
import {DIAGNOSTIC_REFERENCES} from './modules/diagnostics/navigation';
import {matchDiagnosticRoute} from './modules/diagnostics/routes';
import lis1Routes from './modules/lis1/routes.json';
import lis2Routes from './modules/lis2/routes.json';
import ris1Routes from './modules/ris1/routes.json';
import {FileQuestion} from '@pepbits/icons';
import {defineProduct, type ShellNavigation} from '@pepbits/shell';
import type {PageDefinition} from '@pepbits/page-engines/types';
import type {NavigationTarget} from '@pepbits/platform/navigation';
import {MASTERS} from './modules/suite/lib/masters';
import {API_PRODUCT} from './adapters/http';

export const clinicalPages = [
  ['patient-query', 'Patient search', 'patients'],
  ['patient-record', 'Patient record', 'patients'],
  ['patient-360', 'Patient 360', 'patients'],
  ['clinical-triage', 'Clinical triage', 'clinical'],
  ['clinical-consultation', 'Clinical consultation', 'clinical'],
  ['op-consultation', 'OP consultation', 'clinical'],
  ['comprehensive-consultation', 'Comprehensive consultation', 'clinical'],
  ['op-registration', 'OP registration', 'clinical'],
  ['clinic-billing', 'Clinic billing', 'clinical'],
  ['emergency-registration', 'Emergency registration', 'clinical'],
  ['inpatient-admission', 'Inpatient admission', 'clinical'],
  ['consultation-entry-design', 'Consultation entry', 'clinical'],
  ['consultation-entry-v2', 'Consultation entry V2', 'clinical'],
] as const;
export const suitePages = [
  {id:'suite-dashboard',path:'/',title:'Dashboard'},
  {id:'suite-patients',path:'/patients',title:'Patients'},
  {id:'suite-appointments',path:'/appointments',title:'Appointments'},
  {id:'suite-encounters',path:'/encounters',title:'Encounters'},
  {id:'suite-approvals',path:'/approvals',title:'Approvals & eRx'},
  {id:'suite-hospital-billing',path:'/billing/hospital',title:'Hospital billing'},
  {id:'suite-pharmacy-billing',path:'/billing/pharmacy',title:'Pharmacy billing'},
  {id:'suite-invoices',path:'/billing/invoices',title:'Invoices'},
  {id:'suite-contracts',path:'/contracts',title:'Contract pricing'},
  ...Object.values(MASTERS).map(def=>({id:'suite-master-'+def.entity,path:'/masters/'+def.entity,title:def.title,entity:def.entity})),
];
export type HealthcareTarget = AllyVoraTarget & {query?:string; diagnosticPath?:string; teleconsultPath?:string; medbandPath?:string; medslotPath?:string; surgisuitePath?:string; qualityPath?:string};
export const diagnosticPages=DIAGNOSTIC_REFERENCES.flatMap(module=>module.pages.map(page=>({...page,module:module.id,variant:module.variant})));
export const pharmacyPages=pharmacyNavigation.map(item=>({...item,id:'pharmacy-'+resolvePharmacyRoute(item.path)!.kind}));
export const rcmPages=rcmCategories.flatMap(category=>category.pages.map(page=>({...page,group:category.label,id:"reference-rcm-"+(page.path==="/"?"home":page.path.split("/").at(-1))})));
export const medslotPages=medslotRoutes.map(p=>({...p,id:'medslot-'+p.kind}));
export const medbandPages=medbandRoutes.map(p=>({...p,id:'medband-'+p.kind}));
export const surgisuitePages=surgisuiteRoutes.map(p=>({...p,id:'surgisuite-'+p.kind}));
export const qualityPages=qualityRoutes.map(p=>({...p,id:'quality-'+p.kind}));
export const pages: PageDefinition[] = [
  ...allyVoraPages.filter(p=>p.id!==ALLYVORA_PAGE.preferences),
  ...outpatientPages,
  ...medslotPages.map(p=>({id:p.id,title:p.title,subtitle:"",kind:"medslot",module:"reference-medslot"})),
  ...medbandPages.map(p=>({id:p.id,title:p.title,subtitle:"",kind:"medband",module:"reference-medband"})),
  ...surgisuitePages.map(p=>({id:p.id,title:p.title,subtitle:"",kind:"surgisuite",module:"reference-surgisuite"})),
  ...qualityPages.map(p=>({id:p.id,title:p.title,subtitle:"",kind:"quality",module:"reference-quality"})),
  ...teleconsultPages.map(p=>({id:p.id,title:p.title,subtitle:"",kind:"teleconsult",module:p.module})),
  ...rcmPages.map(item=>({id:item.id,title:item.title,subtitle:"",kind:"rcm",module:"reference-rcm"})),
  ...pharmacyPages.map(item=>({id:item.id,title:item.title,subtitle:'',kind:'pharmacy',module:'reference-pharmacy'})),
  ...diagnosticPages.map(item=>({id:item.id,title:item.title,subtitle:'',kind:'diagnostic',module:item.module})),
  ...suitePages.map(item=>({id:item.id,title:item.title,subtitle:'',kind:'suite',module:'reference-healthcare-suite',entity:'entity' in item?item.entity:undefined})),
  ...clinicalPages.map(([id, title]) => ({id, title, subtitle: '', kind: 'clinical', module: 'library', ai: {enabled: false, useCases: []}})),
  {id: 'preferences', title: 'Preferences', subtitle: '', kind: 'preferences', module: 'shared'},
];
const navigation: ShellNavigation = {
  defaultModule: 'reference-healthcare-suite', pages: Object.fromEntries(pages.map(page => [page.id, page])),
  modules: {...allyVoraNavigation.modules,...outpatientNavigation.modules,"reference-medslot":{id:"reference-medslot",label:"MedSlot",shortLabel:"MedSlot",description:"Fictional scheduling workflows",icon:FileQuestion,accent:"var(--primary-fill)",navigation:[{id:"medslot-pages",label:"MedSlot",items:medslotNavigation.map(p=>({id:"medslot-"+p.kind,pageId:"medslot-"+p.kind,label:p.title}))}]},"reference-medband":{id:"reference-medband",label:"MedBand Patient Access",shortLabel:"MedBand",description:"Fictional patient access workflows",icon:FileQuestion,accent:"var(--primary)",navigation:[{id:"medband-pages",label:"MedBand",items:medbandNavigation.map(p=>({id:"medband-"+resolveMedbandRoute(p.path)!.kind,pageId:"medband-"+resolveMedbandRoute(p.path)!.kind,label:p.title}))}]},"reference-surgisuite":{id:"reference-surgisuite",label:"SurgiSuite",shortLabel:"SurgiSuite",description:"Fictional surgical workflows",icon:FileQuestion,accent:"var(--primary)",navigation:[{id:"surgisuite-pages",label:"SurgiSuite",items:surgisuiteNavigation.map(p=>({id:"surgisuite-"+p.kind,pageId:"surgisuite-"+p.kind,label:p.title}))}]},"reference-quality":{id:"reference-quality",label:"AllyVora Quality",shortLabel:"Quality",description:"Fictional quality workflows",icon:FileQuestion,accent:"var(--primary)",navigation:[...new Set(qualityNavigation.map(p=>p.group))].map(group=>({id:"quality-"+group,label:group,items:qualityNavigation.filter(p=>p.group===group).map(p=>({id:"quality-"+resolveQualityRoute(p.path)!.kind,pageId:"quality-"+resolveQualityRoute(p.path)!.kind,label:p.title}))}))},...Object.fromEntries(teleconsultMenus.map(m=>[m.id,{id:m.id,label:m.title,shortLabel:m.title,description:'Fictional teleconsultation workflows',icon:FileQuestion,accent:'var(--primary)',navigation:[{id:m.id+'-pages',label:m.title,items:teleconsultPages.filter(p=>p.module===m.id&&p.menu).map(p=>({id:p.id,pageId:p.id,label:p.title}))}]}])), 'reference-rcm':{id:'reference-rcm',label:'RCM Workspace',shortLabel:'RCM',description:'Fictional revenue-cycle workflows',icon:FileQuestion,accent:'var(--primary)',navigation:rcmCategories.map((category,index)=>({id:'rcm-category-'+index,label:category.label,items:rcmPages.filter(p=>p.group===category.label).map(p=>({id:p.id,pageId:p.id,label:p.title}))}))},'reference-pharmacy':{id:'reference-pharmacy',label:'Pharmacy-1',shortLabel:'Pharmacy',description:'Fictional pharmacy workflows',icon:FileQuestion,accent:'var(--primary)',navigation:[...new Set(pharmacyPages.map(p=>p.group))].map(group=>({id:'pharmacy-'+group,label:group,items:pharmacyPages.filter(p=>p.group===group).map(p=>({id:p.id,pageId:p.id,label:p.title}))}))},...Object.fromEntries(DIAGNOSTIC_REFERENCES.map(module=>[module.id,{id:module.id,label:module.title,shortLabel:module.shortLabel,description:'Fictional diagnostic workflows',icon:FileQuestion,accent:module.accent,navigation:[{id:module.id+'-pages',label:module.title,items:module.pages.map(page=>({id:page.id,pageId:page.id,label:page.title}))}]}])), 'reference-healthcare-suite':{id:'reference-healthcare-suite',label:'Healthcare Suite',shortLabel:'Suite',description:'Front office and care',icon:FileQuestion,accent:'var(--primary)',navigation:[{id:'suite-pages',label:'Healthcare Suite',items:suitePages.map(item=>({id:item.id,pageId:item.id,label:item.title}))}]},library: {id: 'library', label: 'Healthcare', shortLabel: 'Care', description: 'Fictional healthcare workflows',
    icon: FileQuestion, accent: 'var(--primary)', navigation: [
      {id: 'patients', label: 'Patients', items: clinicalPages.filter(row => row[2] === 'patients').map(([id, label]) => ({id, label, pageId: id}))},
      {id: 'clinical', label: 'Clinical', items: clinicalPages.filter(row => row[2] === 'clinical').map(([id, label]) => ({id, label, pageId: id}))},
      {id: 'settings', label: 'Settings', items: [{id: 'preferences', label: 'Preferences', pageId: 'preferences'}]},
    ]}},
};
export const product = defineProduct({id: API_PRODUCT, name: 'Healthcare', tagline: 'Fictional healthcare workflows', navigation,
  defaultModule: 'reference-healthcare-suite', enabledModules: ["reference-allyvora-patients",OUTPATIENT_MODULE,"reference-medslot","reference-medband","reference-surgisuite","reference-quality",...teleconsultMenus.map(m=>m.id),'reference-rcm','reference-pharmacy','reference-healthcare-suite','library',...DIAGNOSTIC_REFERENCES.map(module=>module.id)], access: {pages:{...Object.fromEntries(medslotPages.map(p=>[p.id,medslotPageRoles(p.kind)])),...Object.fromEntries(medbandPages.map(p=>[p.id,medbandRoles])),...Object.fromEntries(surgisuitePages.map(p=>[p.id,surgisuiteRoles])),...Object.fromEntries(qualityPages.map(p=>[p.id,p.kind==='designer'?['enterprise-admin','quality-manager']:p.kind==='users'?['enterprise-admin']:p.kind==='audit'?['enterprise-admin','quality-manager','quality-approver']:['enterprise-admin','quality-manager','quality-steward','quality-verifier','quality-approver','quality-viewer']])),...Object.fromEntries(teleconsultPages.map(p=>[p.id,p.variant==='provider'?['admin','enterprise-admin','teleconsult-doctor','teleconsult-nurse']:['admin','enterprise-admin','teleconsult-patient']]))},actions: {'allyvora-create':REGISTRATION_ROLES,'allyvora-edit':REGISTRATION_ROLES,'allyvora-archive':REGISTRATION_ROLES,create: ['enterprise-admin', 'admin', 'operations-analyst', 'operations'], edit: ['enterprise-admin', 'admin', 'operations-analyst', 'operations'], archive: [], export: ['enterprise-admin', 'admin', 'operations-analyst', 'operations']}}});
export function targetFromPath(pathname: string, search = ''): HealthcareTarget {
  if(pathname==='/allyvora-patients'||pathname.startsWith('/allyvora-patients/'))return allyVoraTargetFromPath(pathname,search);
  if(pathname==='/allyvora-outpatient'||pathname.startsWith('/allyvora-outpatient/'))return outpatientTargetFromPath(pathname);
  if(pathname==='/medslot'||pathname.startsWith('/medslot/')){const path=pathname.slice(8)||'/',match=resolveMedslotRoute(path);return match?{pageId:'medslot-'+match.kind,medslotPath:path,query:search}:{pageId:'not-found'};}
  if(pathname==='/medband'||pathname.startsWith('/medband/')){const path=pathname.slice(8)||'/',match=resolveMedbandRoute(path);return match?{pageId:'medband-'+match.kind,medbandPath:path,query:search}:{pageId:'not-found'};}
  if(pathname==='/surgisuite'||pathname.startsWith('/surgisuite/')){const path=pathname.slice(11)||'/',match=resolveSurgiSuiteRoute(path);return match?{pageId:'surgisuite-'+match.kind,surgisuitePath:path,query:search}:{pageId:'not-found'};}
  if(pathname==='/quality'||pathname.startsWith('/quality/')){const path=pathname.slice(8)||'/',match=resolveQualityRoute(path);return match?{pageId:'quality-'+match.kind,qualityPath:path,query:search}:{pageId:'not-found'};}
  const tc=pathname.match(/^\/teleconsult-(provider|patient)(\/.*)?$/);
  if(tc){const variant=tc[1],path=tc[2]||'/',route=(variant==='provider'?resolveProviderRoute:resolvePatientRoute)(path),page=teleconsultPages.find(p=>p.variant===variant&&p.kind===route?.kind);return page?{pageId:page.id,teleconsultPath:path,query:search}:{pageId:'not-found'};}
  if(pathname==='/rcm'||pathname.startsWith('/rcm/')){const path=pathname.slice(4)||'/',route=resolveRcmRoute(path),page=rcmPages.find(p=>p.path===path.replace(/\/$/,'')||p.path==='/'&&path==='/');return route&&page?{pageId:page.id,query:search}:{pageId:'not-found'};}
  if(pathname==='/pharmacy'||pathname.startsWith('/pharmacy/')){const route=resolvePharmacyRoute(pathname.slice('/pharmacy'.length)||'/');return route?{pageId:'pharmacy-'+route.kind,query:search}:{pageId:'not-found'};}
  const diagnostic=pathname.match(/^\/(lis1|lis2|ris1)(\/.*)?$/);
  if(diagnostic){const variant=diagnostic[1] as 'lis1'|'lis2'|'ris1',path=diagnostic[2]||'/';
    if(!matchDiagnosticRoute({lis1:lis1Routes,lis2:lis2Routes,ris1:ris1Routes}[variant],path))return {pageId:'not-found'};
    const candidates=diagnosticPages.filter(p=>p.variant===variant);
    const page=[...candidates].sort((a,b)=>b.path.length-a.path.length).find(p=>p.path===path||p.path!=='/'&&path.startsWith(p.path+'/'))??candidates.find(p=>p.path==='/')!;
    return {pageId:page.id,diagnosticPath:path,query:search};
  }
  const params=new URLSearchParams(search);
  try {if(pathname.split('/').some(part=>/[\\/?#]/.test(decodeURIComponent(part))))return {pageId:'not-found'};} catch {return {pageId:'not-found'};}
  if(pathname.split('/').filter(Boolean).length>5)return {pageId:'not-found'};
  if (pathname==='/' || pathname==='/suite' || pathname==='/suite/') return {pageId:'suite-dashboard',query:search};
  if (pathname.startsWith('/suite/')) {
    const path=pathname.slice('/suite'.length);
    const page=[...suitePages].sort((a,b)=>b.path.length-a.path.length).find(item=>item.path!=='/'&&(path===item.path||path.startsWith(item.path+'/')));
    if (!page) return {pageId:'not-found'};
    const record=path.slice(page.path.length+1);
    if(record.includes('/') || record && !page.path.startsWith('/masters/') && !['suite-patients','suite-encounters'].includes(page.id))return {pageId:'not-found'};
    return {pageId:page.id,query:search,...(record?record==='new'?{mode:'new' as const}:{recordId:decodeURIComponent(record),mode:params.get('mode')==='edit'?'edit' as const:'view' as const}:{})};
  }
  const segments=pathname.split('/').filter(Boolean);
  if(segments.length>2)return {pageId:'not-found'};
  const [id,record]=segments;
  return {pageId:id||'suite-dashboard',query:search,...(record?record==='new'?{mode:'new' as const}:{recordId:decodeURIComponent(record),mode:params.get('mode')==='edit'?'edit' as const:'view' as const}:{})};
}
export function hrefFor(target: HealthcareTarget) {
  if(allyVoraPages.some(p=>p.id===target.pageId&&p.id!==ALLYVORA_PAGE.preferences))return allyVoraHrefFor(target);
  if(outpatientPages.some(p=>p.id===target.pageId))return outpatientHrefFor(target);
  const medslot=medslotPages.find(p=>p.id===target.pageId);if(medslot){const path=target.medslotPath??medslot.path;return "/medslot"+(path==="/"?"":path)+(target.query?"?"+target.query:"");}
  const medband=medbandPages.find(p=>p.id===target.pageId);if(medband){const path=target.medbandPath??medband.path;return "/medband"+(path==="/"?"":path)+(target.query?"?"+target.query:"");}
  const surgisuite=surgisuitePages.find(p=>p.id===target.pageId);if(surgisuite){const path=target.surgisuitePath??surgisuite.path;return '/surgisuite'+(path==='/'?'':path)+(target.query?'?'+target.query:'');}
  const quality=qualityPages.find(p=>p.id===target.pageId);if(quality){const path=target.qualityPath??quality.path;return "/quality"+(path==="/"?"":path)+(target.query?"?"+target.query:"");}
  const tc=teleconsultPages.find(p=>p.id===target.pageId);if(tc){const path=target.teleconsultPath??tc.path;return "/teleconsult-"+tc.variant+(path==="/"?"":path)+(target.query?"?"+target.query:"");}
  const rcm=rcmPages.find(p=>p.id===target.pageId);if(rcm)return '/rcm'+(rcm.path==='/'?'':rcm.path)+(target.query?'?'+target.query:'');
  const pharmacy=pharmacyPages.find(p=>p.id===target.pageId);
  if(pharmacy)return '/pharmacy'+(pharmacy.path==='/'?'':pharmacy.path)+(target.query?'?'+target.query:'');
  const diagnostic=diagnosticPages.find(p=>p.id===target.pageId);
  if(diagnostic)return '/'+diagnostic.variant+((target.diagnosticPath??diagnostic.path)==='/'?'':target.diagnosticPath??diagnostic.path)+(target.query?'?'+target.query:'');
  const suite=suitePages.find(item=>item.id===target.pageId);
  const params=new URLSearchParams(target.query);
  if(target.mode==='edit')params.set('mode','edit');else params.delete('mode');
  return (suite?'/suite'+(suite.path==='/'?'':suite.path):'/'+target.pageId)+(target.mode==='new'?'/new':target.recordId?'/'+encodeURIComponent(target.recordId):'')+(params.size?'?'+params:'');
}

/** Header visibility follows authenticated role grants; API sessions additionally validate mode/beneficiary. */
export function healthcareProductForRole(role:string){
 const allowed=(id:string)=>id==='reference-medslot'?medslotRoles.includes(role):id==='reference-medband'?medbandRoles.includes(role):id==='reference-surgisuite'?surgisuiteRoles.includes(role):id==='reference-quality'?['enterprise-admin','quality-manager','quality-steward','quality-verifier','quality-approver','quality-viewer'].includes(role):!id.startsWith('reference-teleconsult-')||['admin','enterprise-admin'].includes(role)||(id.endsWith('provider')?['teleconsult-doctor','teleconsult-nurse'].includes(role):role==='teleconsult-patient');
 return {...product,modules:Object.fromEntries(Object.entries(product.modules).filter(([id])=>allowed(id)))};
}
