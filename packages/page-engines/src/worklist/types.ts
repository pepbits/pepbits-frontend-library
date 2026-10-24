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
export interface WorklistPageProps {
 page:PageDefinition;config:WorklistConfig;adapter:WorklistAdapter;
 imports?:{definition:ImportDefinition;adapter:ImportAdapter};
 approvals?:{adapter:ApprovalAdapter;roleOptions:readonly string[]};
 /** Disable when the host service does not implement the personal-view protocol. */
 personalViews?:boolean;
 /** Use record navigation for row activation while retaining the preview action. */
 rowClick?:'preview'|'open';
 onReturn?:()=>void;onPreferences?:()=>void;
}
