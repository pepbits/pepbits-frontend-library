import {useMemo,type ReactNode} from 'react';
import {ScreenHostProvider,useScreenHost} from '@pepbits/patterns/screen-host';
import {useKeystone} from './context';

export interface ErpActor {role:string;permissions?:readonly string[]}
const fullRoles=new Set(['admin','enterprise-admin','operations','operations-analyst']);
const financeRoles=new Set(['finance','finance-manager','accountant']);
// Mirrors the unchanged ERP API's explicit entity grants. Presentation only;
// the authenticated server checks every command, including direct requests.
export const FINANCE_ENTITIES=['chart-of-accounts','tax-rates','journal-vouchers','payment-vouchers','petty-cash','depreciation-run','receivables-aging','ledger-entries'] as const;
export function canWriteEntity(actor:ErpActor|undefined,entity:string):boolean {
  if(!actor||!entity)return false;
  if(fullRoles.has(actor.role))return true;
  return financeRoles.has(actor.role)&&(FINANCE_ENTITIES.some(value=>value===entity)||!!actor.permissions?.includes('erp:write:'+entity));
}
export function EntityAccess({entity,children}:{entity:string;children:ReactNode}) {
  const host=useScreenHost(),{actor}=useKeystone();
  const value=useMemo(()=>({...host,can:(action:string,context?:unknown)=>host.can(action,context)&&(!['create','edit','delete'].includes(action)||canWriteEntity(actor,entity))}),[host,actor,entity]);
  return <ScreenHostProvider value={value}>{children}</ScreenHostProvider>;
}
