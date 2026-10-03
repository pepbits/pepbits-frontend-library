'use client';
import {createContext,useContext,useEffect,useState,useCallback,type ReactNode} from 'react';
import {useSourceApi,ApiError} from '../../lib/api';
import type {User} from '../../lib/types';
import {ErrorNote,Spinner,Button} from '../ui';
interface Settings{facility_name:string;facility_now:string;reminder_hours:string;default_slot_minutes:string;[k:string]:string}
interface AuthCtx{user:User;settings:Settings;can:(...roles:User['role'][])=>boolean;refreshSettings:()=>void}
const Ctx=createContext<AuthCtx|null>(null);
export function useAuth(){const c=useContext(Ctx);if(!c)throw Error('Authenticated MedSlot user required');return c;}
export function AuthProvider({children}:{children:ReactNode}){const api=useSourceApi(),[user,setUser]=useState<User|null>(null),[settings,setSettings]=useState<Settings|null>(null),[error,setError]=useState<ApiError|null>(null),[retry,setRetry]=useState(0);
 const refreshSettings=useCallback(()=>{void api<Settings>('/settings').then(setSettings).catch(setError);},[api]);
 useEffect(()=>{let alive=true;setError(null);Promise.all([api<{user:User}>('/auth/me'),api<Settings>('/settings')]).then(([u,s])=>{if(alive){setUser(u.user);setSettings(s);}}).catch(e=>alive&&setError(e));return()=>{alive=false;};},[api,retry]);
 if(error)return <div className="p-5"><ErrorNote error={error} onRetry={()=>setRetry(x=>x+1)}/></div>;
 if(!user||!settings)return <div role="status" className="p-5"><Spinner/></div>;
 return <Ctx.Provider value={{user,settings,can:(...roles)=>roles.includes(user.role),refreshSettings}}>{children}</Ctx.Provider>;
}
