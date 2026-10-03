import {describe,it,expect} from 'vitest';
import {PHARMACY_REFERENCE} from './pharmacy-reference';
import {referenceNavigationTarget} from './reference-modules';
import {MODULES,PAGE_REGISTRY} from './navigation';
import {productForRole,NEXORA_PRODUCT,moduleContainsPage} from './product';
describe('Pharmacy-1 source navigation',()=>{
 it('preserves source worklists and Settings in the independent module',()=>{
  expect(PHARMACY_REFERENCE.pages).toHaveLength(13);
  expect(MODULES['reference-pharmacy'].navigation.flatMap(s=>s.items).map(i=>i.label)).toEqual(['Command center','Rx workbench','Counter sale','Customer orders','Sales and returns','Inventory','Purchasing','Prior authorizations','Claims','Remittance & payments','Patients','Audit trail','Settings']);
  expect(PAGE_REGISTRY['reference-quality-dashboard']).toBeDefined();
 });
 it('preserves actual query IDs in record links and module isolation',()=>{
  expect(referenceNavigationTarget('reference-pharmacy','/workbench?rx=rx_001').recordId).toBe('/workbench?rx=rx_001');
  expect(moduleContainsPage(NEXORA_PRODUCT,'reference-quality','reference-pharmacy-counter')).toBe(false);
 });
 it('retains effective page grants separately from module selection',()=>{
  const technician=productForRole({...NEXORA_PRODUCT,access:{pages:{'reference-pharmacy-settings':['enterprise-admin','pharmacy-admin']}}},'pharmacy-technician');
  expect(moduleContainsPage(technician,'reference-pharmacy','reference-pharmacy-workbench')).toBe(true);
  expect(moduleContainsPage(technician,'reference-pharmacy','reference-pharmacy-settings')).toBe(false);
 });
});
