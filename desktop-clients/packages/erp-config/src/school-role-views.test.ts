import {describe,it,expect} from 'vitest';
import {SCHOOL_ROLE_VIEWS,schoolPathAllowed} from './school-role-views';
import {NEXORA_PRODUCT,defineProduct,moduleContainsPage,productNavigationTarget,legacySchoolModuleAlias} from './product';
import {referenceNavigationTarget,REFERENCE_PAGE_BY_ID,REFERENCE_MODULES} from './reference-modules';
describe('School role catalog views',()=>{
 it('keeps canonical pages while six modules select their own dashboard identity',()=>{
  expect(SCHOOL_ROLE_VIEWS.map(view=>view.role)).toEqual(['admin','teacher','student','parent','librarian','accountant']);
  expect(REFERENCE_MODULES.filter(module=>['erp1','erp2','school','reports'].includes(module.variant)).map(module=>module.pages.length)).toEqual([14,57,57,24]);
  for(const view of SCHOOL_ROLE_VIEWS){
   expect(referenceNavigationTarget(view.id,'/dashboard')).toMatchObject({pageId:'reference-school-dashboard',moduleId:view.id});
   expect(productNavigationTarget(NEXORA_PRODUCT,'reference-school-dashboard',view.id).moduleId).toBe(view.id);
  }
  expect(REFERENCE_PAGE_BY_ID['reference-school-dashboard'].moduleId).toBe('reference-school');
 });
 it('resolves child routes through allowed parent navigation and blocks forbidden pages',()=>{
  expect(moduleContainsPage(NEXORA_PRODUCT,'reference-school-teacher','reference-school-quizzes-new')).toBe(true);
  expect(moduleContainsPage(NEXORA_PRODUCT,'reference-school-student','reference-school-quizzes-new')).toBe(false);
  expect(moduleContainsPage(NEXORA_PRODUCT,'reference-school-teacher','reference-school-students-new')).toBe(false);
  expect(moduleContainsPage(NEXORA_PRODUCT,'reference-school-parent','reference-school-students')).toBe(false);
  expect(moduleContainsPage(NEXORA_PRODUCT,'reference-school','reference-school-students-new')).toBe(true);
  expect(schoolPathAllowed('student','/quizzes/qz-1')).toBe(true);
  expect(schoolPathAllowed('parent','/live/lv-1')).toBe(true);
 });
 it('supports a product containing only one role view without its primary module',()=>{
  const product=defineProduct({id:'teacher',name:'Teacher',tagline:'School',defaultModule:'reference-school-teacher',enabledModules:['reference-school-teacher']});
  expect(product.pages['reference-school-dashboard']).toBeDefined();
  expect(product.pages['reference-school-quizzes-new']).toBeDefined();
  expect(product.pages['reference-school-admissions']).toBeUndefined();
 });
 it('uses only effective authorized catalog membership when a shared page has several views',()=>{
  const product={...NEXORA_PRODUCT,modules:{'reference-school-student':NEXORA_PRODUCT.modules['reference-school-student']}};
  expect(productNavigationTarget(product,'reference-school-dashboard','reference-school-teacher').moduleId).toBe('reference-school-student');
  expect(moduleContainsPage(product,'reference-school-teacher','reference-school-dashboard')).toBe(false);
 });
});

it('aliases only legacy School URLs to the sole effective portal and keeps registration blocked',()=>{
 const teacher={...NEXORA_PRODUCT,modules:{'reference-school-teacher':NEXORA_PRODUCT.modules['reference-school-teacher']}};
 expect(legacySchoolModuleAlias(teacher,'reference-school')).toBe('reference-school-teacher');
 expect(legacySchoolModuleAlias(teacher,'reference-school-parent')).toBeUndefined();
 expect(moduleContainsPage(teacher,'reference-school-teacher','reference-school-students-new')).toBe(false);
 expect(legacySchoolModuleAlias(NEXORA_PRODUCT,'reference-school')).toBeUndefined();
});
