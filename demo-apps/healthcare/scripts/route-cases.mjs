import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const masterSource=readFileSync(new URL('src/modules/suite/lib/masters.ts',root),'utf8');
const masters=[...masterSource.matchAll(/^  (?:([\w-]+)|'([^']+)'):\s*\{/gm)].map(match=>match[1]??match[2]);
const clinical=[...readFileSync(new URL('src/navigation.ts',root),'utf8').matchAll(/^  \['([^']+)', '[^']+', '(?:patients|clinical)'\]/gm)].map(match=>'/'+match[1]);
export const routes=['/suite','/suite/patients','/suite/appointments','/suite/encounters','/suite/approvals','/suite/billing/hospital','/suite/billing/pharmacy','/suite/billing/invoices','/suite/contracts',...masters.map(entity=>'/suite/masters/'+entity),...clinical,'/preferences'];
export const examples=['/ris1/viewer/1','/suite/patients/new','/suite/patients/PT00001','/suite/encounters/new','/suite/masters/facilities/new','/suite/masters/facilities/F001','/patient-record/PT-0001','/patient-360/PT-0001','/clinical-consultation/PT-0001','/clinical-triage/PT-0001','/op-consultation/PT-0001','/comprehensive-consultation/PT-0001','/op-registration/PT-0001','/clinic-billing/PT-0001'];
const diagnosticModules=['lis1','lis2','ris1'];
for(const variant of diagnosticModules){
 const definitions=JSON.parse(readFileSync(new URL('src/modules/'+variant+'/routes.json',root),'utf8'));
 routes.push(...definitions.filter(route=>!route.path.includes('[')&&!route.path.startsWith('/print')).map(route=>'/'+variant+(route.path==='/'?'':route.path)));
}

const pharmacy=readFileSync(new URL('src/modules/pharmacy/routes.ts',root),'utf8').split('export const pharmacyNavigation')[0];
routes.push(...[...pharmacy.matchAll(/path: "([^"]+)", title:/g)].map(match=>'/pharmacy'+(match[1]==='/'?'':match[1])));

const rcm=JSON.parse(readFileSync(new URL('src/modules/rcm/navigation.json',root),'utf8'));
routes.push(...rcm.flatMap(category=>category.pages.map(page=>'/rcm'+(page.path==='/'?'':page.path))));

routes.push('/teleconsult-provider','/teleconsult-provider/schedule','/teleconsult-provider/patients','/teleconsult-provider/notes','/teleconsult-patient','/teleconsult-patient/register','/teleconsult-patient/home','/teleconsult-patient/book','/teleconsult-patient/records');

routes.push(...['','/indicators','/tat','/events','/verification','/validation','/reports','/schedules','/submissions','/authorities','/users','/audit'].map(path=>'/quality'+path));

routes.push(...['','/schedule','/cases','/approvals','/patients','/inventory','/analytics','/masters'].map(path=>'/surgisuite'+path));

routes.push(...['','/patients','/patients/new','/encounters/new','/admissions','/encounters','/episodes'].map(path=>'/medband'+path));
examples.push('/medband/admissions/new');

routes.push(...['','/book','/calendar','/appointments','/patients','/resources','/services','/departments','/holidays','/notifications','/settings','/audit'].map(path=>'/medslot'+path));
