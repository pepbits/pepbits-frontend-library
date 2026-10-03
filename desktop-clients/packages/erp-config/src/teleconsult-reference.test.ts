import {describe,it,expect} from 'vitest';
import {REFERENCE_MODULES,referenceNavigationTarget} from './reference-modules';
import {MODULES,PAGE_REGISTRY} from './navigation';
import {NEXORA_PRODUCT,moduleContainsPage} from './product';
describe('two teleconsult header modules',()=>{
 it('has exactly provider and patient identities with separate navigation',()=>{
  const modules=REFERENCE_MODULES.filter(m=>m.variant.startsWith('teleconsult-'));
  expect(modules.map(m=>m.id)).toEqual(['reference-teleconsult-provider','reference-teleconsult-patient']);
  expect(MODULES['reference-teleconsult-provider'].navigation.flatMap(s=>s.items.map(i=>i.pageId))).toEqual(modules[0].pages.filter(p=>!p.path.includes('[id]')).map(p=>p.id));
  expect(MODULES['reference-teleconsult-patient'].navigation.flatMap(s=>s.items.map(i=>i.pageId))).toEqual(modules[1].pages.filter(p=>!p.path.includes('[id]')).map(p=>p.id));
 });
 it('routes real consultation and summary records to distinct page help and preserves queries',()=>{
  expect(referenceNavigationTarget('reference-teleconsult-provider','/consult/a2')).toMatchObject({pageId:'reference-teleconsult-provider-consult',recordId:'/consult/a2'});
  expect(referenceNavigationTarget('reference-teleconsult-patient','/visit/a2')).toMatchObject({pageId:'reference-teleconsult-patient-visit'});
  expect(referenceNavigationTarget('reference-teleconsult-patient','/visit/a2/summary?print=1')).toMatchObject({pageId:'reference-teleconsult-patient-summary',recordId:'/visit/a2/summary?print=1'});
 });
 it('allows dynamic pages within their authorized module without invented sidebar IDs',()=>{
  expect(moduleContainsPage(NEXORA_PRODUCT,'reference-teleconsult-provider','reference-teleconsult-provider-consult')).toBe(true);
  expect(moduleContainsPage(NEXORA_PRODUCT,'reference-teleconsult-patient','reference-teleconsult-provider-consult')).toBe(false);
  const denied={...NEXORA_PRODUCT,pages:{...NEXORA_PRODUCT.pages}};delete denied.pages['reference-teleconsult-provider-consult'];
  expect(moduleContainsPage(denied,'reference-teleconsult-provider','reference-teleconsult-provider-consult')).toBe(false);
 });
 it('preserves original Healthcare and diagnostic module ownership',()=>{
  expect(PAGE_REGISTRY['patient-master'].module).toBe('healthcare');expect(PAGE_REGISTRY['reference-healthcare-suite-patients'].module).toBe('reference-healthcare-suite');
  expect(referenceNavigationTarget('reference-lis1','/patients/7').pageId).toBe('reference-lis1-patients');
 });
});
