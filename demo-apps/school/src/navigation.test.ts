import {readFileSync} from 'node:fs';
import {createTranslator} from '@pepbits/i18n';
import {describe,it,expect} from 'vitest';
import {moduleContainsPage,productNavigationTarget} from '@pepbits/shell';
import {SCHOOL_ROLE_VIEWS,schoolPathAllowed} from './modules/school/role-views';
import {SCHOOL_ROUTES} from './modules/school/routes';
import {schoolProductForRole,grantedRoles,targetFromPath,hrefFor,pageId,type SchoolAccount} from './navigation';
import {fixtureSession} from './test/session';
const admin={...fixtureSession.user!,role:'enterprise-admin',referenceSchoolViews:SCHOOL_ROLE_VIEWS.map(view=>view.role)} as SchoolAccount;
const product=schoolProductForRole(admin.role,admin);
describe('ported school configuration contracts',()=>{
 it('keeps canonical pages while six modules select their own dashboard identity',()=>{
  expect(SCHOOL_ROLE_VIEWS.map(view=>view.role)).toEqual(['admin','teacher','student','parent','librarian','accountant']);
  expect(SCHOOL_ROUTES.filter(route=>!route.path.includes(':')).length).toBe(24);expect(SCHOOL_ROUTES).toHaveLength(26);
  for(const view of SCHOOL_ROLE_VIEWS){expect(targetFromPath('/dashboard','role='+view.role)).toMatchObject({pageId:'school-dashboard',moduleId:view.id});expect(productNavigationTarget(product,'school-dashboard',view.id).moduleId).toBe(view.id);}
  expect(product.pages['school-dashboard']!.module).toBe('school');
 });
 it('resolves child routes through explicit membership and blocks forbidden pages',()=>{
  expect(moduleContainsPage(product,'reference-school-teacher','school-quiz-builder')).toBe(true);
  expect(moduleContainsPage(product,'reference-school-student','school-quiz-builder')).toBe(false);
  expect(moduleContainsPage(product,'reference-school-teacher','school-student-registration')).toBe(false);
  expect(moduleContainsPage(product,'reference-school-parent','school-students')).toBe(false);
  expect(moduleContainsPage(product,'reference-school','school-student-registration')).toBe(true);
  expect(schoolPathAllowed('student','/quizzes/qz-1')).toBe(true);expect(schoolPathAllowed('parent','/live/lv-1')).toBe(true);
 });
 it('supports a product containing only one role view without its primary module',()=>{
  const teacher=schoolProductForRole('school-teacher');expect(teacher.pages['school-dashboard']).toBeDefined();expect(teacher.pages['school-quiz-builder']).toBeDefined();expect(teacher.pages['school-admissions']).toBeUndefined();
 });
 it('uses only effective authorized membership when a page has several views',()=>{
  const student=schoolProductForRole('school-student');expect(productNavigationTarget(student,'school-dashboard','reference-school-teacher').moduleId).toBe('reference-school-student');expect(moduleContainsPage(student,'reference-school-teacher','school-dashboard')).toBe(false);
 });
 it('maps unhinted URLs to the sole effective portal and keeps registration blocked',()=>{
  const teacher=schoolProductForRole('school-teacher');expect(productNavigationTarget(teacher,targetFromPath('/dashboard').pageId).moduleId).toBe('reference-school-teacher');expect(moduleContainsPage(teacher,'reference-school-teacher','school-student-registration')).toBe(false);
 });
});
it('uses explicit account grants rather than granting every portal to an administrator',()=>{expect(grantedRoles({role:'enterprise-admin'})).toEqual(['admin']);expect(grantedRoles(admin)).toHaveLength(6);expect(grantedRoles({role:'unknown',referenceSchoolViews:['student','invented']})).toEqual(['student']);});
it('round trips every destination and refuses malformed app routes',()=>{for(const route of SCHOOL_ROUTES){const target={pageId:pageId(route.id),moduleId:'reference-school',...(route.path.includes(':')?{recordId:'fixture-id'}:{})};expect(targetFromPath(hrefFor(target).split('?')[0]!,hrefFor(target).split('?')[1])).toMatchObject(target);}for(const path of ['/missing','/live/%','/live/a%2Fb','/live/%2e%2e'])expect(targetFromPath(path).pageId).toBe('not-found');});

it('translates the administrator portal through the canonical catalog rather than its missing prose alias',()=>{
 const messages=JSON.parse(readFileSync('../../mock-api/config/localization/shared/ar.json','utf8')).messages;
 const t=createTranslator({language:'ar',catalogs:{ar:messages}});const view=product.modules['reference-school']!;
 expect(t(view.labelKey??view.label)).toBe('مدير المدرسة');
 expect(t(view.shortLabelKey??view.shortLabel)).toBe('مدير المدرسة');
});
