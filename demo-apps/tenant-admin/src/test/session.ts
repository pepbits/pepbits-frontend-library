import type {SessionValue} from '@pepbits/platform/auth';
/** A fictional authenticated host session; the API maps it onto a Tenant Admin user. */
export const fixtureSession:SessionValue={status:'authenticated',user:{id:'fixture-admin',name:'Fictional Administrator',email:'fixture@example.test',initials:'FA',title:'Tenant configuration admin',role:'tenant-config-admin',branch:'hq',tenantId:'fictional-tenant'},login:async()=>null,logout:async()=>{}};
