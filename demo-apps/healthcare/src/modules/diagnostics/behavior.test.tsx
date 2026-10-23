import React from 'react';
import {act,fireEvent,render,renderHook,screen,waitFor} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import axe from 'axe-core';
import {TestHost} from '@pepbits/patterns/testing';
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import {sharedMessages} from '../../test/render';
import {ReferenceHostProvider,type ReferenceHost} from './host';
import {DiagnosticPagination} from './controls';
import {useFilters} from '../lis2/lib/hooks';
import {PatientForm} from '../lis1/app/(app)/patients/PatientForm';
import {PatientFormModal} from '../lis2/components/patient';
import RisPatientForm from '../ris1/components/PatientForm';
const scope={tenantId:'tenant',applicationId:'nexora',branchId:'hq',moduleId:'reference-lis1',userId:'synthetic',roles:['enterprise-admin']};
it.each(['lis1','lis2','ris1'] as const)('%s patient editor retains values after a failed save and retries through HTTP',async variant=>{
 let writes=0;const fetch=vi.fn(async(_path:string,init?:RequestInit)=>{if(init?.method==='POST'){writes++;return writes===1?Response.json({message:'Synthetic rejection'},{status:422}):Response.json({id:7});}return Response.json([]);});
 const host:ReferenceHost={scope:{...scope,moduleId:'reference-'+variant},preferences:DEFAULT_PREFERENCES,fetch,navigate:vi.fn()},saved=vi.fn(),closed=vi.fn();
 const Component={lis1:PatientForm,lis2:PatientFormModal,ris1:RisPatientForm}[variant];
 render(<TestHost messages={sharedMessages}><ReferenceHostProvider host={host}><Component open onClose={closed} onSaved={saved}/></ReferenceHostProvider></TestHost>);
 const first=await screen.findByRole('textbox',{name:/First name/});fireEvent.change(first,{target:{value:'Synthetic'}});
 fireEvent.change(screen.getByRole('textbox',{name:/Last name/}),{target:{value:'Patient'}});
 fireEvent.change(screen.getByLabelText(/Date of birth/,{selector:'input'}),{target:{value:'1990-01-01'}});
 const save=await screen.findByRole('button',{name:variant==='lis1'?'Save patient':'Register patient'});fireEvent.click(save);
 await waitFor(()=>expect(writes).toBe(1));await waitFor(()=>expect(save).not.toBeDisabled());expect(first).toHaveValue('Synthetic');expect(saved).not.toHaveBeenCalled();expect(closed).not.toHaveBeenCalled();
 const result=await axe.run(screen.getByRole('dialog'),{rules:{'color-contrast':{enabled:false}}});expect(result.violations.map(v=>v.id)).toEqual([]);
 fireEvent.click(save);await waitFor(()=>expect(saved).toHaveBeenCalledWith({id:7}));
});
it('uses effective page size, central updates and mounted tenant locks for LIS2 requests',async()=>{
 const update=vi.fn();let locked=false;
 const {result,rerender}=renderHook(()=>useFilters({q:'',pageSize:25}),{wrapper:({children})=><TestHost preferences={{pageSize:50}} preferencePolicy={locked?{revision:2,rules:{pageSize:{value:10,locked:true}}}:undefined} update={update}>{children}</TestHost>});
 expect(result.current[0].pageSize).toBe(50);
 act(()=>result.current[1]({pageSize:100}));expect(update).toHaveBeenCalledWith({pageSize:100});
 locked=true;rerender();await waitFor(()=>expect(result.current[0].pageSize).toBe(10));update.mockClear();act(()=>result.current[1]({pageSize:100}));expect(update).not.toHaveBeenCalled();expect(result.current[0].pageSize).toBe(10);
});

it('sends one page-size update from the paginated laboratory control and enforces a mounted lock',async()=>{
 const update=vi.fn();
 function Controls(){const [filters,set]=useFilters({pageSize:20});return <DiagnosticPagination page={filters.page} pageSize={filters.pageSize} total={120} onPage={page=>set({page})} onPageSize={pageSize=>set({pageSize})}/>;}
 const {rerender}=render(<TestHost messages={sharedMessages} update={update}><Controls/></TestHost>);
 fireEvent.change(await screen.findByRole('combobox'),{target:{value:'50'}});
 await waitFor(()=>expect(update).toHaveBeenCalledExactlyOnceWith({pageSize:50}));
 update.mockClear();rerender(<TestHost messages={sharedMessages} update={update} preferencePolicy={{revision:2,rules:{pageSize:{value:10,locked:true}}}}><Controls/></TestHost>);
 await waitFor(()=>expect(screen.getByRole('combobox')).toBeDisabled());
 expect(screen.getByRole('combobox')).toHaveValue('10');fireEvent.change(screen.getByRole('combobox'),{target:{value:'100'}});expect(update).not.toHaveBeenCalled();
});
