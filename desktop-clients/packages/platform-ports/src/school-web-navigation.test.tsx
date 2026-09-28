import React from "react";
import {ProductProvider} from "@pepbits/erp-shell";
import {NEXORA_PRODUCT} from "@pepbits/erp-config";
import {describe,it,expect,vi,beforeEach} from 'vitest';
import {renderHook} from '@testing-library/react';
const route=vi.hoisted(()=>({module:'reference-school-student',page:'reference-school-quizzes',recordId:encodeURIComponent('/quizzes/qz-1')}));
const push=vi.hoisted(()=>vi.fn());
const replace=vi.hoisted(()=>vi.fn());
vi.mock('next/navigation',()=>({useParams:()=>route,usePathname:()=>`/${route.module}/${route.page}/${route.recordId}`,useRouter:()=>({push,replace}),notFound:()=>{throw Error('404');},redirect:(path:string)=>{throw Error('redirect:'+path);}}));
import {hrefFor,useWebNavigation} from '../../../apps/web/src/platform/web-navigation';
import {resolvePage} from '../../../apps/web/src/app/[module]/[page]/resolve';
describe('School web view routing',()=>{
 beforeEach(()=>{push.mockClear();replace.mockClear();route.module='reference-school-student';});
 it('retains role module on refresh, nested source route and new-tab URL',()=>{
  const {result}=renderHook(()=>useWebNavigation());
  expect(result.current.current).toMatchObject({moduleId:'reference-school-student',pageId:'reference-school-quizzes',recordId:'/quizzes/qz-1'});
  expect(hrefFor(result.current.current)).toBe('/reference-school-student/reference-school-quizzes/%2Fquizzes%2Fqz-1');
  const popup=vi.spyOn(window,'open').mockImplementation(()=>null);
  result.current.openInNewContext(result.current.current);
  expect(popup).toHaveBeenCalledWith(hrefFor(result.current.current),'_blank','noopener');popup.mockRestore();
 });
 it('keeps source routes for valid views and canonical redirects for unrelated modules',()=>{
  expect(resolvePage('reference-school-parent','reference-school-live').id).toBe('reference-school-live');
  expect(()=>resolvePage('reference-school-unknown','reference-school-dashboard')).toThrow('redirect:/reference-school/reference-school-dashboard');
  expect(hrefFor({pageId:'customer-master'})).toBe('/finance/customer-master');
 });
 it('follows browser back/forward route module changes',()=>{
  const {result,rerender}=renderHook(()=>useWebNavigation());route.module='reference-school-teacher';rerender();
  expect(result.current.current.moduleId).toBe('reference-school-teacher');
 });
});

it('redirects legacy teacher URLs through the effective catalog and preserves encoded source paths',()=>{
 route.module='reference-school';
 const product={...NEXORA_PRODUCT,modules:{'reference-school-teacher':NEXORA_PRODUCT.modules['reference-school-teacher']}};
 renderHook(()=>useWebNavigation(),{wrapper:({children})=><ProductProvider product={product}>{children}</ProductProvider>});
 expect(replace).toHaveBeenCalledWith('/reference-school-teacher/reference-school-quizzes/%2Fquizzes%2Fqz-1');
});
