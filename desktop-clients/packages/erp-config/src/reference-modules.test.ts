import {describe,it,expect} from 'vitest';
import {referenceInternalPath,referenceNavigationTarget,REFERENCE_MODULES} from './reference-modules';
describe('reference module host URLs',()=>{
 it('retains all 152 separate static destinations',()=>{expect(REFERENCE_MODULES.map(m=>m.pages.length)).toEqual([14,57,57,24]);});
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
