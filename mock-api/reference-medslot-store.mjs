import {createReferenceWorkerStore} from './reference-worker-store.mjs';
export const MEDSLOT_ROLES=Object.freeze({'enterprise-admin':'admin','medslot-admin':'admin','medslot-scheduler':'scheduler','medslot-provider':'provider'});
export function medslotRequestAllowed(user,req){
 const role=MEDSLOT_ROLES[user?.role];if(!role)return 403;
 let p;try{p=decodeURIComponent(req.path.split('?')[0]).replace(/^\/api(?=\/|$)/,'').replace(/\/+$/,'')||'/';}catch{return 400;}
 if(!p.startsWith('/')||p.startsWith('//')||/[\\\x00-\x1f]/.test(p)||p.split('/').some(x=>x==='.'||x==='..'))return 400;
 if(!/^(?:\/(?:auth\/me|health|kpis|settings|users|audit|departments|specialties|resource-types|resources|services|holidays|patients|appointments|availability|notifications))(?:\/|$)/.test(p))return 404;
 if(!['GET','HEAD','POST','PUT','PATCH','DELETE'].includes(req.method))return 405;
 if(role!=='admin'&&/^\/(users|audit|notifications)(\/|$)/.test(p))return 403;
 if(['GET','HEAD'].includes(req.method))return 200;
 if(p==='/auth/me'||p==='/health')return 403;
 if(role==='provider'&&!/^\/appointments\/\d+\/(status|duration)$/.test(p))return 403;
 if(role!=='admin'&&/^\/(settings|users|departments|specialties|resource-types|services|holidays)(\/|$)/.test(p))return 403;
 return 200;
}
export const createReferenceMedslotStore=options=>createReferenceWorkerStore({...options,namespace:'medslot',roles:MEDSLOT_ROLES,guard:medslotRequestAllowed,workerUrl:new URL('./access-runtime/medslot-worker.mjs',import.meta.url),error:(status,code)=>({status,body:{error:code==='forbidden'?'Your role does not allow this action.':code==='scope'?'Authenticated scope is unavailable.':'The service is unavailable. Try again.'}})});
