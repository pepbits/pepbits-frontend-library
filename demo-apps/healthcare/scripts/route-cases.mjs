import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const masterSource=readFileSync(new URL('src/modules/suite/lib/masters.ts',root),'utf8');
const masters=[...masterSource.matchAll(/^  (?:([\w-]+)|'([^']+)'):\s*\{/gm)].map(match=>match[1]??match[2]);
const clinical=[...readFileSync(new URL('src/navigation.ts',root),'utf8').matchAll(/^  \['([^']+)', '[^']+', '(?:patients|clinical)'\]/gm)].map(match=>'/'+match[1]);
export const routes=['/suite','/suite/patients','/suite/appointments','/suite/encounters','/suite/approvals','/suite/billing/hospital','/suite/billing/pharmacy','/suite/billing/invoices','/suite/contracts',...masters.map(entity=>'/suite/masters/'+entity),...clinical,'/preferences'];
export const examples=['/suite/patients/new','/suite/patients/PT00001','/suite/encounters/new','/suite/masters/facilities/new','/suite/masters/facilities/F001','/patient-record/PT-0001','/patient-360/PT-0001','/clinical-consultation/PT-0001','/clinical-triage/PT-0001','/op-consultation/PT-0001','/comprehensive-consultation/PT-0001','/op-registration/PT-0001','/clinic-billing/PT-0001'];
