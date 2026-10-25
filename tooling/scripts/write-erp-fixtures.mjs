import {createReferenceErpStore} from '../../mock-api/reference-erp-store.mjs';
import {writeFileSync} from 'node:fs';
const store=createReferenceErpStore({variant:'erp1'}),user={id:'fixture-admin',tenantId:'fictional-tenant',role:'enterprise-admin',branch:'head-office'},scope={tenantId:user.tenantId,applicationId:'nexora',branchId:user.branch};
const values={};function get(path,query={}){const result=store.handle(user,scope,{path,method:'GET',query:new URLSearchParams(query)});if(result.status!==200)throw new Error(JSON.stringify(result));return result.body;}
for(const page of store.pages){values[page.section+'/'+page.slug]={lookups:get('/lookups',{entity:page.entity,page:page.section+'/'+page.slug}),list:page.template==='dashboard'?null:get('/entities/'+page.entity,{size:'2'})};}
writeFileSync(new URL('../../demo-apps/erp/src/test/fixtures.json',import.meta.url),JSON.stringify({pages:values,dashboard:get('/dashboard')},null,2)+'\n');
