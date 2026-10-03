import {createHash} from 'node:crypto';
export const DIAGNOSTIC_VARIANTS=['lis1','lis2','ris1'];
export function diagnosticScope(variant,user,scope){
 if(!DIAGNOSTIC_VARIANTS.includes(variant)||!user?.id||!user?.tenantId||!scope?.applicationId||!scope?.branchId)throw new Error('Authenticated diagnostic scope is required');
 return createHash('sha256').update(JSON.stringify([variant,user.tenantId,scope.applicationId,scope.branchId])).digest('hex');
}
export function diagnosticPolicy(user,method,rawPath){
 let path;try{path=decodeURIComponent(rawPath.split('?')[0]);}catch{return 400;}
 if(!path.startsWith('/api/')||/[\\\x00-\x1f]/.test(path)||path.split('/').some(p=>p==='.'||p==='..'))return 400;
 if(path.startsWith('/api/auth/')&&path!=='/api/auth/me'||path==='/api/session'&&method!=='GET')return 403;
 if(!['GET','POST','PUT','PATCH','DELETE','HEAD'].includes(method))return 405;
 if(['GET','HEAD'].includes(method))return 200;
 if(user.role==='enterprise-admin')return 200;
 if(user.role==='finance-manager'&&/^\/api\/billing(?:\/|$)/.test(path))return 200;
 return 403;
}
