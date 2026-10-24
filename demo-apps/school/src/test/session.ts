import type {SessionValue} from '@pepbits/platform/auth';
export const fixtureSession:SessionValue={status:'authenticated',user:{id:'fixture-admin',name:'Fictional Administrator',email:'fixture@example.test',initials:'FA',title:'Administrator',role:'enterprise-admin',branch:'head-office',tenantId:'fictional-tenant'},login:async()=>null,logout:async()=>{}};
