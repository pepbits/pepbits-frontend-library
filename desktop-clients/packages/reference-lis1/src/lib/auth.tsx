'use client';
import {useDiagnosticUser} from '@pepbits/reference-diagnostics';
export function useAuth(){const user=useDiagnosticUser();return {user,ready:!!user,can:(...roles:string[])=>!!user&&(user.role==='ADMIN'||roles.includes(user.role))};}
