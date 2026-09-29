import {describe,it,expect} from 'vitest';
import {referenceInternalPath,referenceNavigationTarget,REFERENCE_MODULES} from './reference-modules';
import {PAGE_REGISTRY,MODULES} from './navigation';
describe('reference module host URLs',()=>{
 it('retains all 152 separate static destinations',()=>{expect(REFERENCE_MODULES.filter(m=>m.id!=='reference-healthcare-suite').map(m=>m.pages.length)).toEqual([14,57,57,24]);});
 it('keeps healthcare suite records and queries inside its own header module',()=>{
  const patient=referenceNavigationTarget('reference-healthcare-suite','/patients/patient-7?tab=insurance');
  expect(patient).toMatchObject({pageId:'reference-healthcare-suite-patients',recordId:'/patients/patient-7?tab=insurance'});
  const master=referenceNavigationTarget('reference-healthcare-suite','/masters/resources/new');
  expect(master.pageId).toBe('reference-healthcare-suite-masters-resources');
  expect(PAGE_REGISTRY[patient.pageId].module).toBe('reference-healthcare-suite');
  expect(PAGE_REGISTRY['patient-master'].module).toBe('healthcare');
  const module=MODULES['reference-healthcare-suite'];
  expect(module?.navigation.flatMap(s=>s.items.map(p=>p.pageId))).toEqual(REFERENCE_MODULES.find(m=>m.id==='reference-healthcare-suite')?.pages.map(p=>p.id));
 });
 it('decodes Next encoded route parameters once including nested record paths and queries',()=>{
  const path='/builder/new?copy=custom%20report';
  const target=referenceNavigationTarget('reference-reports',path);
  expect(target.pageId).toBe('reference-reports-builder');
  expect(referenceInternalPath(encodeURIComponent(target.recordId))).toBe(path);
 });
 it('preserves already decoded desktop paths and source-encoded identifiers',()=>{
  expect(referenceInternalPath('/reports/report%20name')).toBe('/reports/report%20name');
  expect(referenceInternalPath('%2Freports%2Freport%2520name')).toBe('/reports/report%20name');
 });
 it('does not treat arbitrary host record identifiers as module routes',()=>{
  expect(referenceInternalPath('customer-1')).toBeUndefined();
  expect(referenceInternalPath('%2Fbad%')).toBeUndefined();
 });
});
