import {createReferenceWorkerStore,referenceWorkerScope} from './reference-worker-store.mjs';
export const PHARMACY_ROLES=Object.freeze({'enterprise-admin':'admin','pharmacy-admin':'admin','pharmacy-pharmacist':'pharmacist','pharmacy-technician':'technician','pharmacy-billing':'billing','pharmacy-viewer':'viewer'});
export const pharmacyScope=(user,scope)=>referenceWorkerScope('pharmacy',user,scope);
export function pharmacyRequestAllowed(user,request){
 const role=PHARMACY_ROLES[user?.role];if(!role)return 403;
 let path;try{path=decodeURIComponent(request.path.split('?')[0]).replace(/^\/api(?=\/)/,'').replace(/\/+$/,'')||'/';}catch{return 400;}
 if(!path.startsWith('/')||path.length>2048||/[\\\x00-\x1f]/.test(path)||path.split('/').some(p=>p==='.'||p==='..'))return 400;
 if(/^\/(auth|users|seed)(\/|$)/.test(path))return 403;
 if(!['GET','HEAD','POST','PATCH'].includes(request.method))return 405;
 if(['GET','HEAD'].includes(request.method))return 200;
 if(role==='viewer')return 403;
 if(/^\/payers\//.test(path))return role==='admin'?200:403;
 if(/^\/prescriptions(?:\/|$)|^\/dispensings\//.test(path)){
  if(role==='admin'||role==='pharmacist')return 200;
  return role==='technician'&&(!/^\/prescriptions\/[^/]+\/(verify|cancel|hold|authorizations)$/.test(path))&&!/^\/dispensings\/[^/]+\/(check|cancel|return)$/.test(path)?200:403;
 }
 if(/^\/claims\/|^\/remittances\//.test(path))return ['admin','billing'].includes(role)||role==='pharmacist'&&path.endsWith('/resubmit-realtime')?200:403;
 if(/^\/authorizations\//.test(path))return ['admin','billing','pharmacist'].includes(role)?200:403;
 if(/^\/batches\//.test(path))return ['admin','pharmacist'].includes(role)?200:403;
 if(/^\/purchase-orders|^\/orders|^\/patients/.test(path))return ['admin','pharmacist','technician'].includes(role)?200:403;
 if(/^\/sales/.test(path))return ['admin','pharmacist','technician','billing'].includes(role)?200:403;
 return role==='admin'?200:403;
}
const messages={forbidden:'Your role does not allow this Pharmacy action.',scope:'Pharmacy scope is unavailable.',capacity:'Pharmacy service is at capacity. Try again.',unavailable:'Pharmacy service is unavailable. Try again.'};
export function createReferencePharmacyStore(options){return createReferenceWorkerStore({...options,namespace:'pharmacy',workerUrl:new URL('./pharmacy-runtime/worker.mjs',import.meta.url),roles:PHARMACY_ROLES,guard:pharmacyRequestAllowed,error:(status,code)=>({status,body:{error:{code:'pharmacy_'+code,message:messages[code]}}})});}
