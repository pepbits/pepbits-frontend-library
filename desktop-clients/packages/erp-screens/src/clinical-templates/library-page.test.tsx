import React from 'react';
import {render} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import {DEFAULT_PREFERENCES, PAGE_REGISTRY} from '@pepbits/erp-config';
import type {PatientDestination} from './shared';

const state=vi.hoisted(()=>({workspace:vi.fn(),open:vi.fn(),request:vi.fn()}));
vi.mock('@pepbits/auth',()=>({useSession:()=>({user:{id:'user-1',tenantId:'tenant-1'}})}));
vi.mock('@pepbits/erp-shell',()=>({useERP:()=>({preferences:DEFAULT_PREFERENCES,preferencesAvailable:true}),useProduct:()=>({id:'nexora'})}));
vi.mock('@pepbits/platform-ports',()=>({useNavigation:()=>({openInNewContext:state.open})}));
vi.mock('../product-services',()=>({useProductRequest:()=>state.request}));
vi.mock('./workspace',()=>({ClinicalPatientWorkspace:(props:unknown)=>{state.workspace(props);return null;}}));
import {ClinicalLibraryPage} from './library-page';

for(const [pageId,view]of [['allyvora-patient-query','query'],['allyvora-patient-record','record'],['allyvora-patient-360','overview']]as const){
 test(`${pageId} opens its actual patient view, preserving patient and mode`,()=>{
  state.workspace.mockClear();render(<ClinicalLibraryPage page={PAGE_REGISTRY[pageId]} target={{pageId,recordId:'PT-0001',mode:'edit'}}/>);
  expect(state.workspace.mock.calls[0][0].initialPage).toEqual({view,patientId:'PT-0001',mode:'edit'});
 });
}
test('unrelated clinical library pages are not classified as patient query',()=>{
 state.workspace.mockClear();render(<ClinicalLibraryPage page={PAGE_REGISTRY['dcp-designer']} target={{pageId:'dcp-designer'}}/>);expect(state.workspace).not.toHaveBeenCalled();
});
for(const [destination,pageId]of [[{view:'record',mode:'new'},'allyvora-patient-record'],[{view:'record',patientId:'PT-0002',mode:'view'},'allyvora-patient-record'],[{view:'overview',patientId:'PT-0002'},'allyvora-patient-360'],[{view:'query'},'allyvora-patient-query']]as const){
 test(`patient ${destination.view}/${'mode'in destination?destination.mode:'default'} navigation targets the stable page ID`,()=>{
  state.workspace.mockClear();state.open.mockClear();render(<ClinicalLibraryPage page={PAGE_REGISTRY['allyvora-patient-query']} target={{pageId:'allyvora-patient-query'}}/>);
  state.workspace.mock.calls[0][0].onOpen(destination as PatientDestination);
  expect(state.open).toHaveBeenCalledWith({pageId,recordId:'patientId'in destination?destination.patientId:undefined,mode:'mode'in destination?destination.mode:undefined});
 });
}
