import {describe,it,expect} from 'vitest';
import {TENANT_ADMIN_REFERENCE,MEDBAND_REFERENCE} from './access-reference';
import {referenceNavigationTarget} from './reference-modules';
import {MODULES,PAGE_REGISTRY} from './navigation';
import {NEXORA_PRODUCT,moduleContainsPage} from './product';
describe('Separate reference access modules',()=>{
 it('retains every configuration destination and MedBand sidebar item',()=>{
  expect(TENANT_ADMIN_REFERENCE.pages).toHaveLength(33);
  expect(TENANT_ADMIN_REFERENCE.pages.filter(p=>p.path.startsWith('/config/'))).toHaveLength(30);
  expect(MODULES['reference-medband'].navigation.flatMap(s=>s.items).map(i=>i.label)).toEqual(['Today','Find patient','Register patient','New encounter','Admissions','Encounters','Episodes and cases']);
  expect(PAGE_REGISTRY['reference-pharmacy-counter']).toBeDefined();
 });
 it('keeps actual patient and configuration deep links inside their owning module',()=>{
  expect(referenceNavigationTarget('reference-medband','/patients/pat-123?tab=coverage')).toMatchObject({pageId:'reference-medband-patients-detail',recordId:'/patients/pat-123?tab=coverage'});
  expect(referenceNavigationTarget('reference-tenant-admin','/config/numbering?id=42')).toMatchObject({pageId:'reference-tenant-admin-numbering',recordId:'/config/numbering?id=42'});
  expect(moduleContainsPage(NEXORA_PRODUCT,'reference-medband','reference-tenant-admin-numbering')).toBe(false);
 });
});
