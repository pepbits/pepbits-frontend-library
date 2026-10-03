import {describe,it,expect} from 'vitest';
import {QUALITY_REFERENCE} from './quality-reference';
import {referenceNavigationTarget} from './reference-modules';
import {MODULES,PAGE_REGISTRY} from './navigation';
import {moduleContainsPage,NEXORA_PRODUCT} from './product';
describe('Quality source navigation boundary',()=>{
 it('preserves the twelve sidebar destinations in five original groups',()=>{
  const module=MODULES['reference-quality'];expect(module.navigation.map(s=>s.label)).toEqual(['Overview','Performance','Assurance','Reporting','Administration']);
  expect(module.navigation.flatMap(s=>s.items).map(i=>i.label)).toEqual(['Dashboard','Indicators','Turnaround times','Event Pulse','Verification','Validation','Reports','Schedules','Submissions','Authorities','Users and roles','Audit trail']);
  expect(QUALITY_REFERENCE.pages).toHaveLength(15);expect(PAGE_REGISTRY['reference-quality-report-designer']).toBeDefined();
 });
 it('maps record links and designer without invented sidebar IDs',()=>{
  expect(referenceNavigationTarget('reference-quality','/reports/designer').pageId).toBe('reference-quality-report-designer');
  expect(referenceNavigationTarget('reference-quality','/indicators/32').pageId).toBe('reference-quality-indicator-detail');
  expect(referenceNavigationTarget('reference-quality','/reports/8?from=2026-09').recordId).toBe('/reports/8?from=2026-09');
  expect(MODULES['reference-quality'].navigation.flatMap(s=>s.items).some(i=>i.pageId==='reference-quality-report-designer')).toBe(false);
 });
 it('authorizes a hidden designer only when the effective product grants its page and module',()=>{
  const id='reference-quality-report-designer';expect(moduleContainsPage(NEXORA_PRODUCT,'reference-quality',id)).toBe(true);
  const pages={...NEXORA_PRODUCT.pages};delete pages[id];expect(moduleContainsPage({...NEXORA_PRODUCT,pages},'reference-quality',id)).toBe(false);
  expect(moduleContainsPage(NEXORA_PRODUCT,'reference-lis1',id)).toBe(false);
 });
});
