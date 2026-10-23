import {createContext, useContext} from 'react';
import type {PreferencePolicy} from '@pepbits/preferences';
import type {WorkspaceNavigation} from '@pepbits/shell/workspace';
export const DemoContext = createContext<{
 policy:PreferencePolicy; setPolicy:(policy:PreferencePolicy)=>void;
 aiEnabled:boolean; setAiEnabled:(enabled:boolean)=>void; expireSession:()=>void;
}|null>(null);
export function useDemoPolicy(){const value=useContext(DemoContext);if(!value)throw new Error('Demo host is missing');return value;}
export const WorkspaceContext = createContext<WorkspaceNavigation|null>(null);
export function useDemoWorkspace(){const value=useContext(WorkspaceContext);if(!value)throw new Error('Demo workspace is missing');return value;}
