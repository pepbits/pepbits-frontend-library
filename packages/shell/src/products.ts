import type {TranslationCatalog} from "@pepbits/i18n";
import type {MenuItem, ModuleDefinition, ModuleKey, PageDefinition, ShellNavigation} from "./navigation";
/** A build-time product profile over the currently supported screen modules.
 * This controls product availability, not user authorization.
 */
export type ProductAction = "create" | "edit" | "archive" | "export" | (string & {});
export interface ProductAccess {
  pages?: Record<string, readonly string[]>;
  actions?: Partial<Record<ProductAction, readonly string[]>>;
}
export interface ProductDefinition {
  access?: ProductAccess;
  translations?: TranslationCatalog;
  currentRole?: string;
  id: string;
  name: string;
  accentName?: string;
  tagline: string;
  defaultModule: ModuleKey;
  modules: Partial<Record<ModuleKey, ModuleDefinition>>;
  pages: Record<string, PageDefinition>;
}

/** Hosts may use named workspaces without a synthetic dashboard page. Resolve
 * the first registered leaf after checking for a real module dashboard. */
export function moduleLandingPage(product:ProductDefinition,module:ModuleKey):string|undefined{
 const definition=product.modules[module];if(!definition)return;
 const dashboard=module+'-dashboard';
 if(product.pages[dashboard])return dashboard;
 const first=(items:readonly MenuItem[]):string|undefined=>{
  for(const item of items){if(item.pageId&&product.pages[item.pageId])return item.pageId;const child=first(item.children??[]);if(child)return child;}
 };
 for(const section of definition.navigation){const page=first(section.items);if(page)return page;}
}

export function defineProduct(input: {
  navigation: ShellNavigation;
  id: string;
  name: string;
  accentName?: string;
  tagline: string;
  defaultModule: ModuleKey;
  enabledModules: readonly ModuleKey[];
  enabledPages?: readonly string[];
  pageTitles?: Record<string, string>;
  access?: ProductAccess;
  translations?: TranslationCatalog;
}): ProductDefinition {
  const {modules: MODULES, pages: PAGE_REGISTRY} = input.navigation;
  if (!/^[a-z][a-z0-9-]*$/.test(input.id)) throw new Error("Product id must be a lowercase slug");
  if (!input.name.trim()) throw new Error("Product name is required");
  if (!input.enabledModules.length || !input.enabledModules.includes(input.defaultModule)) {
    throw new Error("The default module must be enabled");
  }
  if (new Set(input.enabledModules).size !== input.enabledModules.length) throw new Error("Duplicate product module");
  for (const key of input.enabledModules) if (!MODULES[key]) throw new Error(`Unknown product module: ${key}`);
  const modules = Object.fromEntries(input.enabledModules.map((key) => [key, MODULES[key]]));
  // Hosts explicitly catalogue utility and shared pages; no product registry is inferred.
  const itemPageIds=(items:readonly MenuItem[]):string[]=>items.flatMap(item=>[...(item.pageId?[item.pageId]:[]),...itemPageIds(item.children??[])]);
  const enabledPageIds = new Set(input.enabledModules.flatMap(key => [...MODULES[key]!.navigation.flatMap(section=>itemPageIds(section.items)),...(MODULES[key]!.pageIds??[])]));
  const pages = Object.fromEntries(Object.entries(PAGE_REGISTRY)
    .filter(([id, page]) => page.module === "shared" || input.enabledModules.includes(page.module) || enabledPageIds.has(id)));
  if (input.enabledPages) {
    for (const id of input.enabledPages) if (!pages[id]) throw new Error(`Unknown or disabled product page: ${id}`);
    for (const id of Object.keys(pages)) if (!input.enabledPages.includes(id)) delete pages[id];
  }
  for (const [id,title] of Object.entries(input.pageTitles ?? {})) {
    if (!pages[id] || !title.trim()) throw new Error(`Invalid product page title: ${id}`);
    pages[id] = {...pages[id]!,title};
  }
  for (const id of Object.keys(input.access?.pages ?? {})) if (!pages[id]) throw new Error(`Unknown permission page: ${id}`);
  for (const roles of [...Object.values(input.access?.pages ?? {}), ...Object.values(input.access?.actions ?? {})]) {
    if (!Array.isArray(roles) || roles.some(role => typeof role !== "string" || !role.trim())) throw new Error("Permissions must contain role names");
  }
  const configuredModules = input.enabledPages || input.pageTitles ? pruneModules(modules,pages) : modules;
  return { translations: input.translations, id: input.id, name: input.name, accentName: input.accentName, tagline: input.tagline,
    defaultModule: input.defaultModule, modules: configuredModules, pages, ...(input.access ? {access:input.access} : {}) };
}

function pruneModules(modules: ProductDefinition["modules"], pages: ProductDefinition["pages"]): ProductDefinition["modules"] {
  const items = (source: MenuItem[]): MenuItem[] => source.flatMap(item => {
    const children = item.children ? items(item.children) : undefined;
    if (item.pageId && !pages[item.pageId]) return [];
    if (children && !children.length && !item.pageId) return [];
    return [{...item, ...(item.pageId ? {label:pages[item.pageId]!.title} : {}), ...(children ? {children} : {})}];
  });
  return Object.fromEntries(Object.entries(modules).flatMap(([id,module]) => module ? [[id,{...module,navigation:module.navigation.map(section=>({...section,items:items(section.items)})).filter(section=>section.items.length)}]] : []));
}

/** UI availability only. Services must independently authorize every request. */
export function canProductAction(product: ProductDefinition, action: ProductAction): boolean {
  const actions = product.access?.actions;
  const roles = actions && Object.hasOwn(actions, action) ? actions[action] : undefined;
  return Array.isArray(roles) && !!product.currentRole && roles.includes(product.currentRole);
}

export function productForRole(product: ProductDefinition, role?: string): ProductDefinition {
  if (!product.access) return {...product, currentRole: role};
  const pages = Object.fromEntries(Object.entries(product.pages).filter(([id]) => {
    const roles=product.access?.pages?.[id];
    return !roles || !!role && roles.includes(role);
  }));
  return {...product,currentRole:role,pages,modules:pruneModules(product.modules,pages)};
}

/** Resolve shared page membership from the host's effective navigation catalog.
 * Non-menu detail pages belong to their declared module; hosts supply all metadata. */
export function moduleContainsPage(product:ProductDefinition,moduleId:string,pageId:string):boolean{
 const visit=(items:readonly MenuItem[]):boolean=>items.some(item=>item.pageId===pageId||visit(item.children??[]));
 if(!product.pages[pageId]||!product.modules[moduleId])return false;
 return product.modules[moduleId]!.pageIds?.includes(pageId) === true || product.modules[moduleId]!.navigation.some(section=>visit(section.items)) || product.pages[pageId]!.module===moduleId;
}
export function productModuleForPage(product:ProductDefinition,pageId:string,preferred?:string):ModuleKey|undefined{
 if(preferred && moduleContainsPage(product,preferred,pageId))return preferred;
 const primary=product.pages[pageId]?.module;
 if(primary && primary!=="shared" && product.modules[primary])return primary;
 return Object.keys(product.modules).find(module=>moduleContainsPage(product,module,pageId));
}
export function productNavigationTarget(product:ProductDefinition,pageId:string,preferred?:string){
 const moduleId=productModuleForPage(product,pageId,preferred);
 const primary=product.pages[pageId]?.module;
 return {pageId,...(moduleId && moduleId!==primary?{moduleId}:{})};
}
