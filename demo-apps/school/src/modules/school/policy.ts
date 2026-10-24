import {schoolPathAllowed,type SchoolRole} from './role-views';
/** Presentation mirrors the existing demo service's narrower resource grants. */
export function schoolPageAvailable(role:SchoolRole,path:string){
 if(!schoolPathAllowed(role,path))return false;
 const root=path.split('?')[0]!.split('/')[1];
 if(role==='librarian')return ['dashboard','library','messages','settings'].includes(root??'');
 if(role==='accountant')return ['dashboard','fees','reports','messages','settings'].includes(root??'');
 return true;
}
export const hasAcademicLookups=(role:SchoolRole)=>role!=='librarian'&&role!=='accountant';
