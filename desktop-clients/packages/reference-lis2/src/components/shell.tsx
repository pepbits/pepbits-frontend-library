'use client';
export {useDiagnosticUser as useUser} from '@pepbits/reference-diagnostics';
export const can=(user:{role:string}|null,...roles:string[])=>!!user&&(user.role==='ADMIN'||roles.includes(user.role));
