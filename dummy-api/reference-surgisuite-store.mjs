import {createReferenceWorkerStore} from './reference-worker-store.mjs';
export const SURGISUITE_ROLES=Object.freeze({'enterprise-admin':'ADMIN','surgisuite-admin':'ADMIN','surgisuite-coordinator':'OT_COORDINATOR','surgisuite-surgeon':'SURGEON','surgisuite-anesthesia':'ANESTHESIOLOGIST','surgisuite-nurse':'CIRCULATING_NURSE','surgisuite-approver':'APPROVER','surgisuite-coder':'BILLING','surgisuite-viewer':'VIEWER'});
export function surgisuiteRequestAllowed(user,req){
 const role=SURGISUITE_ROLES[user?.role];if(!role)return 403;
 let p;try{p=decodeURIComponent(req.path.split('?')[0]).replace(/^\/api(?=\/|$)/,'').replace(/\/+$/,'')||'/';}catch{return 400;}
 if(!p.startsWith('/')||p.startsWith('//')||/[\\\x00-\x1f]/.test(p)||p.split('/').some(x=>x==='.'||x==='..'))return 400;
 if(p.startsWith('/auth')&&p!=='/auth/me')return 403;
 if(!/^(?:\/(?:auth\/me|health|dashboard|analytics|approvals|inventory|search|lookups|procedures|diagnoses|theatres|equipment|staff|patients|cases))(?:\/|$)/.test(p))return 404;
 if(!['GET','HEAD','POST','PUT','PATCH','DELETE'].includes(req.method))return 405;
 if(['GET','HEAD'].includes(req.method))return 200;
 if(role==='VIEWER')return 403;
 if(/^\/(staff|lookups|procedures|diagnoses|theatres|equipment)(\/|$)/.test(p)&&role!=='ADMIN')return 403;
 return 200;
}
export const createReferenceSurgiSuiteStore=options=>createReferenceWorkerStore({...options,namespace:'surgisuite',roles:SURGISUITE_ROLES,guard:surgisuiteRequestAllowed,workerUrl:new URL('./access-runtime/surgisuite-worker.mjs',import.meta.url),error:(status,code)=>({status,body:{error:code==='forbidden'?'Your role does not allow this action.':code==='scope'?'Authenticated scope is unavailable.':'The service is unavailable. Try again.'}})});
