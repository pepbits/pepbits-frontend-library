import {describe,it,expect} from 'vitest';
import {moduleContainsPage} from '@pepbits/shell';
import {teleconsultMenus,teleconsultPages} from './navigation';
import {product,pages,hrefFor,targetFromPath} from '../../navigation';
/** The four original Teleconsult host-registry cases, adapted to this app's public navigation. */
describe('two Teleconsult header modules',()=>{
 it('has exactly provider and patient identities with separate navigation',()=>{
  expect(teleconsultMenus.map(m=>m.id)).toEqual(['reference-teleconsult-provider','reference-teleconsult-patient']);
  for(const module of teleconsultMenus)expect(product.modules[module.id]!.navigation.flatMap(s=>s.items.map(i=>i.pageId))).toEqual(teleconsultPages.filter(p=>p.module===module.id&&p.menu).map(p=>p.id));
  expect(teleconsultPages.filter(p=>p.menu)).toHaveLength(9);
 });
 it('routes actual consultation and summary records to distinct pages and preserves queries',()=>{
  expect(targetFromPath('/teleconsult-provider/consult/a2')).toMatchObject({pageId:'teleconsult-provider-consult',teleconsultPath:'/consult/a2'});
  expect(targetFromPath('/teleconsult-patient/visit/a2').pageId).toBe('teleconsult-patient-visit');
  const target=targetFromPath('/teleconsult-patient/visit/a2/summary','print=1');expect(target.pageId).toBe('teleconsult-patient-summary');expect(hrefFor(target)).toBe('/teleconsult-patient/visit/a2/summary?print=1');
 });
 it('allows record pages within their authorized module without invented sidebar IDs',()=>{
  expect(moduleContainsPage(product,'reference-teleconsult-provider','teleconsult-provider-consult')).toBe(true);
  expect(moduleContainsPage(product,'reference-teleconsult-patient','teleconsult-provider-consult')).toBe(false);
  const denied={...product,pages:{...product.pages}};delete denied.pages['teleconsult-provider-consult'];
  expect(moduleContainsPage(denied,'reference-teleconsult-provider','teleconsult-provider-consult')).toBe(false);
 });
 it('preserves original Healthcare and diagnostic module ownership',()=>{
  expect(pages.find(p=>p.id==='patient-query')?.module).toBe('library');expect(pages.find(p=>p.id==='suite-patients')?.module).toBe('reference-healthcare-suite');
  expect(targetFromPath('/lis1/patients').pageId).toBe('reference-lis1-patients');expect(targetFromPath('/lis2/patients/7').pageId).toBe('reference-lis2-patients');
 });
});
