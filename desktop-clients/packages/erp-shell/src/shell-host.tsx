"use client";
import React,{createContext,useContext} from 'react';
/** Real hosts supply verified presentation data; the shell never resolves permissions itself. */
export interface ShellHost {
 branch:string;
 branches:Array<{value:string;label:string;timezone?:string}>;
 onBranchChange:(value:string)=>void;
 tenantLabel:string;
 statusLabel:string;
 versionLabel:string;
 regionLabel?:string;
 showInbox?:boolean;
}
const Context=createContext<ShellHost|undefined>(undefined);
export const useShellHost=()=>useContext(Context);
export function ShellHostProvider({value,children}:{value:ShellHost;children:React.ReactNode}){return <Context.Provider value={value}>{children}</Context.Provider>;}
