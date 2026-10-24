import {describe,expect,it} from 'vitest';
import {buildNavigation,buildProduct,configPageId,hrefFor,pageFor,targetFromPath} from './navigation';
import {meta} from './modules/tenant-admin/test-utils';
const registry={categories:meta().categories,resources:meta().resources};
describe('Tenant Admin routes and navigation',()=>{
 it.each([['/','overview'],['/approvals','approvals'],['/activity','activity'],['/config/items','config-items'],['/config/e-m-tables','config-e-m-tables'],['/preferences','preferences']])('maps %s to %s and back',(path,pageId)=>{const target=targetFromPath(path);expect(target.pageId).toBe(pageId);expect(hrefFor(target)).toBe(path);});
 it('keeps deep-link queries for the module (?new=1, ?open=<id>, ?id=<id>)',()=>{
  for(const query of ['new=1','open=12','id=9','open=12&id=9']){const target=targetFromPath('/config/price-books',query);expect(target).toMatchObject({pageId:'config-price-books',query,path:'/config/price-books?'+query});expect(hrefFor(target)).toBe('/config/price-books?'+query);}
 });
 it.each(['/config/..','/config/%2e%2e','/config/a%2Fb','/config/Items','/config/items/7','/approvals/extra','/nope'])('sends %s to the module not-found page with its path',path=>{const target=targetFromPath(path);expect(target.pageId).toBe('not-found');expect(target.path).toBe(path);expect(hrefFor(target)).toBe(path);});
 it('lists only workspace pages before the registry answers, then the registry pages in category order',()=>{
  const empty=buildNavigation(null);expect(empty.modules['tenant-admin']!.navigation.map(s=>s.id)).toEqual(['workspace']);
  const loaded=buildNavigation(registry);expect(loaded.modules['tenant-admin']!.navigation.map(s=>[s.id,s.items.map(i=>i.pageId)])).toEqual([['workspace',['overview','approvals','activity']],['catalogue',['config-items','config-tax-rules']],['policy',['config-reimbursement-routes']]]);
  expect(loaded.pages[configPageId('items')]).toMatchObject({title:'Items and services',kind:'tenant-admin',module:'tenant-admin'});
 });
 it('renders an unlisted configuration key through the module, which asks the registry',()=>{expect(pageFor(targetFromPath('/config/new-key'),buildNavigation(registry))).toMatchObject({id:'config-new-key',kind:'tenant-admin'});expect(pageFor({pageId:'unknown'},buildNavigation(null)).id).toBe('not-found');});
 it('builds one product with the shared preferences page and no AI',()=>{const product=buildProduct(registry);expect(product.pages.preferences).toBeTruthy();expect(Object.values(product.pages).every(p=>!p.ai?.enabled)).toBe(true);expect(product.defaultModule).toBe('tenant-admin');});
});
