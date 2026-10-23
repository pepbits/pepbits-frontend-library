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
export type HealthcareTarget = NavigationTarget & {query?:string};
export const pages: PageDefinition[] = [
  ...suitePages.map(item=>({id:item.id,title:item.title,subtitle:'',kind:'suite',module:'reference-healthcare-suite',entity:'entity' in item?item.entity:undefined})),
  ...clinicalPages.map(([id, title]) => ({id, title, subtitle: '', kind: 'clinical', module: 'library', ai: {enabled: false, useCases: []}})),
  {id: 'preferences', title: 'Preferences', subtitle: '', kind: 'preferences', module: 'shared'},
];
const navigation: ShellNavigation = {
  defaultModule: 'reference-healthcare-suite', pages: Object.fromEntries(pages.map(page => [page.id, page])),
  modules: {'reference-healthcare-suite':{id:'reference-healthcare-suite',label:'Healthcare Suite',shortLabel:'Suite',description:'Front office and care',icon:FileQuestion,accent:'var(--primary)',navigation:[{id:'suite-pages',label:'Healthcare Suite',items:suitePages.map(item=>({id:item.id,pageId:item.id,label:item.title}))}]},library: {id: 'library', label: 'Healthcare', shortLabel: 'Care', description: 'Fictional healthcare workflows',
    icon: FileQuestion, accent: 'var(--primary)', navigation: [
      {id: 'patients', label: 'Patients', items: clinicalPages.filter(row => row[2] === 'patients').map(([id, label]) => ({id, label, pageId: id}))},
      {id: 'clinical', label: 'Clinical', items: clinicalPages.filter(row => row[2] === 'clinical').map(([id, label]) => ({id, label, pageId: id}))},
      {id: 'settings', label: 'Settings', items: [{id: 'preferences', label: 'Preferences', pageId: 'preferences'}]},
    ]}},
};
export const product = defineProduct({id: API_PRODUCT, name: 'Healthcare', tagline: 'Fictional healthcare workflows', navigation,
  defaultModule: 'reference-healthcare-suite', enabledModules: ['reference-healthcare-suite','library'], access: {actions: {create: ['enterprise-admin', 'admin', 'operations-analyst', 'operations'], edit: ['enterprise-admin', 'admin', 'operations-analyst', 'operations'], archive: [], export: ['enterprise-admin', 'admin', 'operations-analyst', 'operations']}}});
export function targetFromPath(pathname: string, search = ''): HealthcareTarget {
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
  const suite=suitePages.find(item=>item.id===target.pageId);
  const params=new URLSearchParams(target.query);
  if(target.mode==='edit')params.set('mode','edit');else params.delete('mode');
  return (suite?'/suite'+(suite.path==='/'?'':suite.path):'/'+target.pageId)+(target.mode==='new'?'/new':target.recordId?'/'+encodeURIComponent(target.recordId):'')+(params.size?'?'+params:'');
}
