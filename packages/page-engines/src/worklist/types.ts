import type {ReactNode} from 'react';
import type {PersonalViewLayout} from './personal-views';
import type {PageDefinition,WorklistConfig} from '../types';
import type {ApprovalAdapter,ImportAdapter} from '@pepbits/data';
import type {ImportDefinition} from '@pepbits/patterns/imports';
export type WorklistRequest=(path:string,init?:RequestInit)=>Promise<Response>;
/** Authenticated request transport. Relative wire paths retain the generic service protocol. */
export interface WorklistAdapter {
 request:WorklistRequest;
 identity:string;
 applicationId:string;
 actor?:{id:string;name?:string;email?:string;tenantId?:string};
 sessionAvailable?:boolean;
 referenceKeys?:Record<string,string>;
}
/** Host composition uses the engine's current state and guarded application path. */
export interface WorklistViewControls {
 layout:PersonalViewLayout;
 onApply:(layout:PersonalViewLayout)=>void;
}
export interface WorklistFilterControls {
 values:Record<string,string>;
 onChange:(key:string,value:string)=>void;
 onReset:()=>void;
}
export interface WorklistPageProps {
 page:PageDefinition;config:WorklistConfig;adapter:WorklistAdapter;
 imports?:{definition:ImportDefinition;adapter:ImportAdapter};
 approvals?:{adapter:ApprovalAdapter;roleOptions:readonly string[]};
 /** Disable when the host service does not implement the personal-view protocol. */
 personalViews?:boolean;
 /** Replace the generic service UI when the host has a different view-state contract. */
 renderViewControls?:(controls:WorklistViewControls)=>ReactNode;
 /** Compose domain filters without duplicating results, paging or selection. */
 renderFilters?:(controls:WorklistFilterControls)=>ReactNode;
 /** Use record navigation for row activation while retaining the preview action. */
 rowClick?:'preview'|'open';
 /** Requery after an external write while preserving filters, sort and paging. */
 refreshKey?:string|number;
 onReturn?:()=>void;onPreferences?:()=>void;
}
