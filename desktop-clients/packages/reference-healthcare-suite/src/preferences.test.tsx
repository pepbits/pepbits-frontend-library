import {act,fireEvent,render,renderHook,screen,waitFor} from '@testing-library/react';
import {ReferenceHostProvider,type ReferenceHost} from '@pepbits/reference-host';
import {DEFAULT_PREFERENCES,type UserPreferences,type PreferencePolicy} from '@pepbits/erp-config';
import {ApiProvider} from './lib/api';
import {SessionProvider,useSession} from './lib/session';
import {useFormat} from './lib/format';
import {useCsvExport} from './lib/export';
import {DataTable,Pagination} from './components/ui/DataTable';
import {ToastProvider,useToast} from './components/ui/Toast';
import {ReferenceHealthcareSuiteModule} from './module';
import type {ReactNode} from 'react';
const session={canWrite:true,user:{id:'host-user',name:'Actual Host Actor',role:'enterprise-admin',email:'fictional@example.test',initials:'AH'},facilities:[{id:'F001',name:'Fictional clinic',status:'Active'},{id:'F002',name:'Fictional pharmacy',status:'Active'},{id:'F003',name:'Inactive facility',status:'Inactive'}],defaultFacilityId:'F001',currency:'AED',today:'2026-09-29'};
function makeHost(preferences:Partial<UserPreferences>={},policy?:PreferencePolicy):ReferenceHost {const p={...DEFAULT_PREFERENCES,...preferences};return {scope:{moduleId:'reference-healthcare-suite',tenantId:'fictional',applicationId:'product',branchId:'branch',userId:'host-user',roles:['enterprise-admin']},preferences:p,preferenceHost:{preferences:p,preferencePolicy:policy,preferencesAvailable:true,onPreferenceChange:vi.fn()},navigate:vi.fn(),request:vi.fn(async<T,>(path:string)=>{if(path==='/api/session')return session as T;return [] as T;}) as ReferenceHost['request']};}
function sessionWrapper(host:ReferenceHost){return function Wrapper({children}:{children:ReactNode}){return <ReferenceHostProvider host={host}><ApiProvider><SessionProvider>{children}</SessionProvider></ApiProvider></ReferenceHostProvider>;};}
test('session uses the actual actor, validates active facility choices and respects managed tab preference',async()=>{
 const host=makeHost({openRecordsInTabs:false},{revision:1,rules:{openRecordsInTabs:{locked:true,value:false}}});const {result}=renderHook(useSession,{wrapper:sessionWrapper(host)});await waitFor(()=>expect(result.current.session?.user?.id).toBe('host-user'));expect(result.current.session?.user?.name).toBe('Actual Host Actor');expect(result.current.formLayout).toBe('pages');act(()=>{result.current.setFacilityId('F002');result.current.setFormLayout('tabs');});expect(result.current.facilityId).toBe('F002');expect(host.preferenceHost?.onPreferenceChange).not.toHaveBeenCalled();act(()=>result.current.setFacilityId('F003'));expect(result.current.facilityId).toBe('F002');act(()=>result.current.setFacilityId('untrusted'));expect(result.current.facilityId).toBe('F002');
});
test('all shared table presentation attributes and effective card result view apply',()=>{
 const host=makeHost({density:'spacious',zebraStripes:false,wrapCellText:true,stickyTableHeader:false,resultView:'table'});const props={rows:[{id:'P001',name:'Fictional patient'}],columns:[{key:'name',header:'Patient'}],rowKey:(r:{id:string})=>r.id};const {rerender}=render(<ReferenceHostProvider host={host}><DataTable {...props}/></ReferenceHostProvider>);const table=screen.getByRole('table');expect(table).toHaveAttribute('data-density','spacious');expect(table).toHaveAttribute('data-striped','false');expect(table).toHaveAttribute('data-wrap','true');expect(table).toHaveAttribute('data-sticky','false');rerender(<ReferenceHostProvider host={{...host,preferences:{...host.preferences,resultView:'cards'}}}><DataTable {...props}/></ReferenceHostProvider>);expect(screen.queryByRole('table')).not.toBeInTheDocument();expect(screen.getByText('Fictional patient')).toBeInTheDocument();
});
test('managed page size cannot update and CSV capability follows effective export policy',()=>{
 const host=makeHost({pageSize:20,exportFormat:'xlsx'},{revision:1,rules:{pageSize:{locked:true,value:20}}});render(<ReferenceHostProvider host={host}><Pagination page={1} pageSize={20} total={40} onPage={vi.fn()}/></ReferenceHostProvider>);expect(screen.getByRole('combobox')).toBeDisabled();const {result}=renderHook(useCsvExport,{wrapper:({children})=><ReferenceHostProvider host={host}>{children}</ReferenceHostProvider>});expect(result.current.disabled).toBe(true);expect(result.current.downloadCsv('should-not-download',['id'],[['fictional']])).toBe(false);
});
test('source formatter consumes host dates, clock, numbers and currency',()=>{
 const host=makeHost({dateFormat:'mdy',timeFormat:'12h',numberLocale:'de-DE',currencyCode:'EUR',currencyDisplay:'code',decimalPlaces:3});const {result}=renderHook(useFormat,{wrapper:({children})=><ReferenceHostProvider host={host}>{children}</ReferenceHostProvider>});expect(result.current.fmtDate('2026-09-29')).toBe('09/29/2026');expect(result.current.fmtTime('14:30')).toContain('2:30');expect(result.current.money(1234.5)).toContain('EUR');expect(result.current.money(1234.5)).toContain('1.234,500');
});
test('source toast consumes host position, style, maximum count and duration',()=>{
 vi.useFakeTimers();const host=makeHost({toastPosition:'top-left',toastDuration:2000,toastStyle:'solid',maxVisibleToasts:1});function Emit(){const toast=useToast();return <button onClick={()=>{toast({tone:'ok',title:'first notice'});toast({tone:'info',title:'second notice'});}}>Emit</button>;}
 const {unmount}=render(<ReferenceHostProvider host={host}><ToastProvider><Emit/></ToastProvider></ReferenceHostProvider>);fireEvent.click(screen.getByText('Emit'));expect(screen.queryByText('first notice')).not.toBeInTheDocument();const second=screen.getByText('second notice');expect(second.closest('[data-toast-style]')).toHaveAttribute('data-toast-style','solid');expect(second.closest('[aria-live]')).toHaveClass('top-4','left-4');act(()=>vi.advanceTimersByTime(2001));expect(screen.queryByText('second notice')).not.toBeInTheDocument();unmount();vi.useRealTimers();
});
test('patient creation keeps entered values and inline validation on recoverable failures',async()=>{
 const host=makeHost();host.fetch=vi.fn(async(path:string)=>new Response(JSON.stringify(path==='/api/session'?session:path==='/api/patients'?{message:'Fix highlighted fields',fields:{firstName:'First name is required'}}:[]),{status:path==='/api/patients'?422:200}));render(<ReferenceHealthcareSuiteModule path="/patients/new" host={host}/>);const first=await screen.findByLabelText(/First name/);fireEvent.change(first,{target:{value:'Fictional'}});fireEvent.change(screen.getByLabelText(/Last name/),{target:{value:'Retained'}});fireEvent.click(screen.getByRole('button',{name:/^Save$/}));await screen.findByText('First name is required');expect(first).toHaveValue('Fictional');expect(screen.getByLabelText(/Last name/)).toHaveValue('Retained');expect(host.navigate).not.toHaveBeenCalled();
});
test('read-only actual host role sees status banner and no patient creation command',async()=>{
 const host=makeHost();host.fetch=vi.fn(async()=>new Response(JSON.stringify({...session,canWrite:false,user:{...session.user,role:'finance-manager'}})));render(<ReferenceHealthcareSuiteModule path="/patients/new" host={host}/>);await screen.findAllByText('Healthcare Suite is read-only for your role.');expect(screen.queryByRole('button',{name:/^Save$/})).not.toBeInTheDocument();
});
test('source composite modal title keeps its readable accessible name through the shared overlay',async()=>{
 const {Modal}=await import('./components/ui/overlay');render(<ReferenceHostProvider host={makeHost()}><Modal open onClose={vi.fn()} title={<span><svg aria-hidden="true"/><span>Request prior approval</span></span>}><p>Fictional order review</p></Modal></ReferenceHostProvider>);expect(screen.getByRole('dialog',{name:'Request prior approval'})).toBeInTheDocument();expect(screen.getByRole('heading',{name:'Request prior approval'})).toBeInTheDocument();
});
test('populated encounter renders consultation charges, totals and named cancellation actions',async()=>{
 const host=makeHost();
 const encounter={id:'EN000001',encNo:'ENC-000001',patientName:'Fictional Patient',encounterType:'Outpatient',providerName:'Fictional Provider',createdAt:'2026-09-29T10:00:00Z',paymentClass:'Cash',status:'Registered',patient:{firstName:'Fictional',lastName:'Patient',fullName:'Fictional Patient',mrn:'MRN-000001',allergies:''},orders:[{id:'O000001',orderNo:'ORD-000001',name:'Consultation charge',category:'Consultation',billingCategory:'Hospital',status:'Draft',qty:1,unitPrice:100,net:100,patientShare:100,payerShare:0,covered:true,priorAuthRequired:false,erxRequired:false}],approvals:[],invoices:[],totals:{net:100,patientShare:100,payerShare:0,hospital:100,pharmacy:0}};
 host.fetch=vi.fn(async(path:string)=>new Response(JSON.stringify(path==='/api/session'?session:path==='/api/encounters/EN000001'?encounter:[])));
 render(<ReferenceHealthcareSuiteModule path="/encounters/EN000001" host={host}/>);
 expect(await screen.findByRole('button',{name:'Cancel Consultation charge'})).toBeInTheDocument();
 expect(screen.getByText('Consultation charge')).toBeInTheDocument();
 expect(screen.getByText('Totals')).toBeInTheDocument();
 expect(screen.getByRole('link',{name:/Hospital bill/})).toHaveTextContent('AED 100');
});
