import {describe,expect,test} from 'vitest';
import {defineProduct,productForRole,canProductAction,moduleLandingPage,moduleContainsPage,productModuleForPage,productNavigationTarget} from './products';
import {catalog,product} from './test/host';
const base={navigation:catalog,id:'example',name:'Example',tagline:'Workspace',defaultModule:'operations',enabledModules:['operations']};
describe('host product profiles',()=>{
  test('the complete profile retains the supplied catalog',()=>{expect(product.modules).toEqual(catalog.modules);expect(Object.keys(product.pages)).toEqual(Object.keys(catalog.pages));});
  test('a smaller profile excludes other domains while retaining explicitly shared pages',()=>{
    const selected=defineProduct(base);expect(Object.keys(selected.modules)).toEqual(['operations']);expect(selected.pages['operations-dashboard']).toBeDefined();expect(selected.pages.preferences).toBeDefined();expect(selected.pages['resources-dashboard']).toBeUndefined();expect(Object.values(selected.pages).every(p=>p.module==='operations'||p.module==='shared')).toBe(true);
  });
  test('rejects a landing module that is not enabled',()=>{expect(()=>defineProduct({...base,defaultModule:'resources'})).toThrow(/default module/);});
  test('profiles are isolated from the host catalog membership',()=>{
    const selected=defineProduct(base);expect(Object.keys(product.modules)).toHaveLength(2);expect(Object.keys(product.modules)).toEqual(['operations','resources']);expect(Object.keys(selected.modules)).toHaveLength(1);
  });
  test('host modules open a registered leaf without an invented dashboard',()=>{
    const selected=defineProduct({...base,enabledPages:['items']});expect(moduleLandingPage(selected,'operations')).toBe('items');expect(moduleLandingPage(selected,'unavailable')).toBeUndefined();expect(moduleLandingPage(product,'operations')).toBe('operations-dashboard');
  });
  test('page selection and role rules prune nested navigation without changing the catalog',()=>{
    const navigation={...catalog,modules:{...catalog.modules,operations:{...catalog.modules.operations!,navigation:[{id:'nested',label:'Records',items:[{id:'group',label:'Records',children:[{id:'items',label:'Items',pageId:'items'}]}]}]}}};
    const selected=defineProduct({...base,navigation,enabledPages:['items'],pageTitles:{items:'Records'},access:{pages:{items:['editor']},actions:{edit:['editor'],archive:[]}}});
    const denied=productForRole(selected,'viewer');expect(denied.pages.items).toBeUndefined();expect(JSON.stringify(denied.modules)).not.toContain('"pageId":"items"');expect(canProductAction(denied,'edit')).toBe(false);expect(canProductAction(productForRole(selected),'edit')).toBe(false);
    const granted=productForRole(selected,'editor');expect(granted.pages.items!.title).toBe('Records');expect(canProductAction(granted,'edit')).toBe(true);expect(canProductAction(granted,'archive')).toBe(false);expect(catalog.pages.items!.title).toBe('Items');expect(selected.pages.items).toBeDefined();
    // Explicit page selection no longer silently adds a product's dashboard.
    expect(granted.pages['operations-dashboard']).toBeUndefined();
  });
  test('rejects unknown pages and malformed permissions',()=>{
    expect(()=>defineProduct({...base,enabledPages:['missing']})).toThrow(/page/);expect(()=>defineProduct({...base,pageTitles:{missing:'Other'}})).toThrow(/title/);expect(()=>defineProduct({...base,access:{actions:{edit:['']}}})).toThrow(/role/);
  });
  test('rejects malformed identity, unknown and duplicated modules',()=>{
    expect(()=>defineProduct({...base,id:'Invalid'})).toThrow(/slug/);expect(()=>defineProduct({...base,name:' '})).toThrow(/name/);expect(()=>defineProduct({...base,enabledModules:['operations','missing']})).toThrow(/module/);expect(()=>defineProduct({...base,enabledModules:['operations','operations']})).toThrow(/Duplicate/);
  });
  test('action grants fail closed with absent access, role or action',()=>{
    expect(canProductAction({...product,access:undefined},'edit')).toBe(false);expect(canProductAction(product,'edit')).toBe(false);expect(canProductAction(productForRole(product,'editor'),'unconfigured')).toBe(false);
    expect(canProductAction(productForRole(product,'editor'),'toString')).toBe(false);
  });
  test('shared pages retain explicit module membership and detail pages use declared ownership',()=>{
    expect(moduleContainsPage(product,'operations','preferences')).toBe(true);expect(moduleContainsPage(product,'resources','preferences')).toBe(false);expect(productModuleForPage(product,'preferences','operations')).toBe('operations');expect(productNavigationTarget(product,'preferences','operations')).toEqual({pageId:'preferences',moduleId:'operations'});expect(productNavigationTarget(product,'items')).toEqual({pageId:'items'});
    const detail={...product,pages:{...product.pages,detail:{...product.pages.items!,id:'detail'}}};expect(moduleContainsPage(detail,'operations','detail')).toBe(true);expect(moduleContainsPage(detail,'missing','detail')).toBe(false);expect(moduleContainsPage(detail,'operations','missing')).toBe(false);
  });
});
