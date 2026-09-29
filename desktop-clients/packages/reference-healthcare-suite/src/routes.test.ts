import {healthcareSuiteRoutes,resolveHealthcareSuiteRoute} from './routes';
import {MASTERS} from './lib/masters';
test('all 23 source destinations plus nine RCM workflows and 14 masters resolve with dynamic routes',()=>{
 expect(healthcareSuiteRoutes).toHaveLength(32);expect(Object.keys(MASTERS)).toHaveLength(14);for(const r of healthcareSuiteRoutes)expect(resolveHealthcareSuiteRoute(r.path),r.path).not.toBeNull();for(const entity of Object.keys(MASTERS)){expect(resolveHealthcareSuiteRoute(`/masters/${entity}/new`)).toEqual({kind:'master-new',entity,id:'new'});expect(resolveHealthcareSuiteRoute(`/masters/${entity}/record%20one?mode=edit`)).toEqual({kind:'master-record',entity,id:'record one'});}
});
test('creation differs from records and malformed/unknown paths are rejected',()=>{
 expect(resolveHealthcareSuiteRoute('/patients/new')).toEqual({kind:'patient-new'});expect(resolveHealthcareSuiteRoute('/encounters/E001?tab=orders')).toEqual({kind:'encounter-record',id:'E001'});for(const path of ['/masters/unknown','/masters/__proto__','/masters/items/a/extra','/patients/%zz','//patients/P001'])expect(resolveHealthcareSuiteRoute(path)).toBeNull();
});

test('nine RCM workspaces resolve and unknown financial route fails closed',()=>{for(const section of ["claims", "exchange", "remittances", "patient-finance", "packages", "drg", "accounting", "commercial", "receivables"]){expect(resolveHealthcareSuiteRoute('/rcm/'+section)).toEqual({kind:'rcm',section});}expect(resolveHealthcareSuiteRoute('/rcm/unknown')).toBeNull();expect(resolveHealthcareSuiteRoute('/rcm/claims/extra')).toBeNull();});
