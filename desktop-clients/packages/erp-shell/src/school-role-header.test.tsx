import React from 'react';
import {describe,it,expect,vi,beforeEach} from 'vitest';
import {render,screen,fireEvent,within} from '@testing-library/react';
import {DEFAULT_PREFERENCES,NEXORA_PRODUCT,SCHOOL_ROLE_VIEWS} from '@pepbits/erp-config';
import {ProductProvider} from './product-context';
import {Header} from './header';
import {Sidebar} from './sidebar';
import {CommandPalette} from './layers/command-palette';
const state=vi.hoisted(()=>({moduleId:'reference-school-student'}));
const open=vi.hoisted(()=>vi.fn());
vi.mock('@pepbits/platform-ports',()=>({useNavigation:()=>({current:{pageId:'reference-school-dashboard',moduleId:state.moduleId},open,hrefFor:(target:{pageId:string;moduleId?:string})=>`/${target.moduleId}/${target.pageId}`})}));
vi.mock('@pepbits/auth',()=>({useSession:()=>({user:{name:'Synthetic admin',initials:'SA',role:'enterprise-admin'},logout:vi.fn()})}));
vi.mock('./erp-context',()=>({useERP:()=>({currentModule:state.moduleId,module:NEXORA_PRODUCT.modules[state.moduleId],preferences:{...DEFAULT_PREFERENCES,sidebarPinned:true},branch:'hq',setBranch:vi.fn(),updatePreference:vi.fn(),commandOpen:true,setCommandOpen:vi.fn(),setHelpOpen:vi.fn(),setDocumentationOpen:vi.fn(),toast:vi.fn(),t:(key:string)=>SCHOOL_ROLE_VIEWS.find(view=>key===view.titleKey||key===view.shortLabelKey)?.title ?? key})}));
vi.mock('./documentation',()=>({DocumentationLauncher:()=>null}));
describe('School header and sidebar',()=>{
 beforeEach(()=>{state.moduleId='reference-school-student';open.mockClear();});
 it.each(SCHOOL_ROLE_VIEWS)('selects $title through the shared header',view=>{
  render(<ProductProvider product={NEXORA_PRODUCT}><Header showInbox={false}/></ProductProvider>);
  fireEvent.click(document.querySelector('[data-tour=module] button')!);
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option',{name:new RegExp(view.title)}));
  expect(open).toHaveBeenLastCalledWith({pageId:'reference-school-dashboard',moduleId:view.id});
 });
 it('shows the student sidebar and retains that view when navigating fees',()=>{
  render(<ProductProvider product={NEXORA_PRODUCT}><Sidebar/></ProductProvider>);
  expect(screen.queryByText('Admissions')).toBeNull();expect(screen.queryByText('Teachers')).toBeNull();
  const link=screen.getByRole('link',{name:'Fees'});expect(link.getAttribute('href')).toBe('/reference-school-student/reference-school-fees');
  fireEvent.click(link);expect(open).toHaveBeenCalledWith({pageId:'reference-school-fees',moduleId:'reference-school-student'});
 });
});

it('command search opens School from another module through an authorized catalog view',()=>{
 state.moduleId='finance';render(<ProductProvider product={NEXORA_PRODUCT}><CommandPalette/></ProductProvider>);
 fireEvent.change(screen.getByPlaceholderText('Search pages, modules and actions…'),{target:{value:'reference-school-dashboard'}});
 fireEvent.click(document.querySelector('button.group')!);
 expect(open).toHaveBeenCalledWith({pageId:'reference-school-dashboard',moduleId:'reference-school'});
});
it('command search does not offer hidden School pages in the selected student view',()=>{
 state.moduleId='reference-school-student';render(<ProductProvider product={NEXORA_PRODUCT}><CommandPalette/></ProductProvider>);
 fireEvent.change(screen.getByPlaceholderText('Search pages, modules and actions…'),{target:{value:'reference-school-admissions'}});
 expect(document.querySelector('button.group')).toBeNull();
});
