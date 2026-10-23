'use client';
export {useDiagnosticUser as useUser} from '../../diagnostics';
export const can=(user:{role:string}|null,...roles:string[])=>!!user&&(user.role==='ADMIN'||roles.includes(user.role));
