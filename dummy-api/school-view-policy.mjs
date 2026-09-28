import {SCHOOL_ROLE_VIEWS,schoolRoleForHost,schoolRoleView} from '../desktop-clients/packages/erp-config/src/school-role-views.ts';

// These grants are read only from the authenticated server account. Request headers
// select a view; they never add a grant or replace the actor/session identity.
export function schoolViewRoles(user){
 const own=schoolRoleForHost(String(user?.role??''));
 const granted=Array.isArray(user?.referenceSchoolViews)?user.referenceSchoolViews:[];
 return [...new Set([own,...granted].filter(role=>SCHOOL_ROLE_VIEWS.some(view=>view.role===role)))];
}
export function resolveSchoolView(user,moduleHeader){
 const own=schoolRoleForHost(String(user?.role??''));
 const requested=moduleHeader??SCHOOL_ROLE_VIEWS.find(view=>view.role===own)?.id;
 const view=typeof requested==='string'?schoolRoleView(requested):undefined;
 return view&&schoolViewRoles(user).includes(view.role)?view:null;
}
