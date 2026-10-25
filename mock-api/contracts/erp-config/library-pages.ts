import {MODULES} from "./navigation.ts";
/** Includes shared destinations linked from Library even when the API assigns
 * their canonical route to another module. Reused by compliance checks. */
const ids=new Set<string>();
function collect(value:unknown):void {
  if(Array.isArray(value)){value.forEach(collect);return;}
  if(!value||typeof value!=='object')return;
  const node=value as Record<string,unknown>;
  if(typeof node.pageId==='string')ids.add(node.pageId);
  Object.values(node).forEach(collect);
}
collect(MODULES.library.navigation);
export const LIBRARY_PAGE_IDS:readonly string[]=[...ids];
