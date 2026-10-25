import {createReferenceWorkerStore} from './reference-worker-store.mjs';
import {RESOURCES} from './access-runtime/dist/rcm/registry.js';
export const RCM_REFERENCE_ROLES=Object.freeze({'enterprise-admin':'admin','rcm-reference-admin':'admin','rcm-reference-clerk':'clerk','rcm-reference-supervisor':'supervisor','rcm-reference-insurance':'insurance','rcm-reference-accountant':'accountant','rcm-reference-coder':'coder','rcm-reference-viewer':'viewer'});
const resourceMap=new Map(RESOURCES.map(r=>[r.key,r]));
const areas={clerk:['front','charges','money'],supervisor:['front','charges','money'],insurance:['insurance'],accountant:['money','receivables','accounting'],coder:['coding']};
export function rcmResourceWritable(role,resource){return role==='admin'||!!areas[role]?.includes(resource.category);}
export function rcmRequestAllowed(user,req){
 const role=RCM_REFERENCE_ROLES[user?.role];if(!role)return 403;let p;try{p=decodeURIComponent(req.path.split('?')[0]).replace(/^\/api(?=\/|$)/,'').replace(/\/+$/,'')||'/';}catch{return 400;}
 if(!p.startsWith('/')||p.startsWith('//')||p.length>2048||/[\\\x00-\x1f]/.test(p)||p.split('/').some(v=>v==='.'||v==='..'))return 400;
 if(/^\/(auth|users|seed|admin)(\/|$)/.test(p))return 403;
 if(!['GET','HEAD','POST','PUT'].includes(req.method))return 405;
 if(['GET','HEAD'].includes(req.method))return 200;
 if(role==='viewer')return 403;
 const match=p.match(/^\/records\/([a-z0-9-]+)(?:\/(\d+)(?:\/actions\/([a-z0-9-]+))?)?$/);if(!match)return 403;const resource=resourceMap.get(match[1]);if(!resource)return 404;
 if(!rcmResourceWritable(role,resource))return 403;
 const action=match[3]?resource.actions.find(a=>a.key===match[3]):undefined;if(match[3]&&!action)return 404;
 if(action?.independent&&role==='clerk')return 403;
 return 200;
}
export const createReferenceRcmStore=options=>createReferenceWorkerStore({...options,namespace:'rcm',forwardedHeaders:['x-rcm-scope'],roles:RCM_REFERENCE_ROLES,guard:rcmRequestAllowed,workerUrl:new URL('./access-runtime/rcm-worker.mjs',import.meta.url),error:(status,code)=>({status,body:{error:{code:'rcm_'+code,message:code==='forbidden'?'Your role does not allow this action.':code==='scope'?'Authenticated scope is unavailable.':'The service is unavailable. Try again.'}}})});
