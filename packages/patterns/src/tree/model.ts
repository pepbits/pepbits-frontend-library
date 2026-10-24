export interface HierarchyNode {id:string;parentId?:string|null;label:string}
export interface HierarchyEntry<T> {node:T;depth:number;hasChildren:boolean;expanded:boolean}
/** Includes matching ancestors and tolerates missing parents and cyclic input. */
export function hierarchyEntries<T extends HierarchyNode>(nodes:readonly T[],expanded:ReadonlySet<string>,query=''):HierarchyEntry<T>[] {
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const children=new Map<string|null,T[]>();
  for(const node of byId.values()) {
    const parent=node.parentId&&node.parentId!==node.id&&byId.has(node.parentId)?node.parentId:null;
    children.set(parent,[...(children.get(parent)??[]),node]);
  }
  const term=query.trim().toLocaleLowerCase(),matches=new Set<string>();
  if(term)for(const node of byId.values())if(node.label.toLocaleLowerCase().includes(term)) {
    let current:T|undefined=node;const chain=new Set<string>();
    while(current&&!chain.has(current.id)){chain.add(current.id);matches.add(current.id);current=byId.get(current.parentId??'');}
  }
  const result:HierarchyEntry<T>[]=[],visited=new Set<string>();
  const walk=(node:T,depth:number)=>{
    if(visited.has(node.id))return;visited.add(node.id);
    if(term&&!matches.has(node.id))return;
    const descendants=children.get(node.id)??[],open=!!term||expanded.has(node.id);
    result.push({node,depth,hasChildren:!!descendants.length,expanded:open});
    if(open)descendants.forEach(child=>walk(child,depth+1));
  };
  (children.get(null)??[]).forEach(node=>walk(node,0));
  // Components with no root (cycles) get a deterministic root, never recurse forever.
  for(const node of byId.values()){
    let current:T|undefined=node;const chain=new Set<string>();
    while(current?.parentId&&byId.has(current.parentId)&&!chain.has(current.id)){chain.add(current.id);current=byId.get(current.parentId);}
    if(current&&chain.has(current.id)&&!visited.has(node.id))walk(node,0);
  }
  return result;
}
