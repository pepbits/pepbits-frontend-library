import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {applyApplicationConfig,parseNavigation,parseLocalization} from './application-config';
import {NEXORA_PRODUCT} from './product';
import type {LanguageKey} from './types';
const read=(path:string)=>JSON.parse(readFileSync(resolve(process.cwd(),'../dummy-api/config',path),'utf8'));
const raw=()=>({...read('navigation/nexora.json'),revision:'test'});
const locales=()=>['en','ar','hi','ml'].map(language=>parseLocalization({schemaVersion:1,revision:'test',productId:'nexora',language,direction:language==='ar'?'rtl':'ltr',fallbackLanguage:'en',messages:read(`localization/shared/${language}.json`).messages,fallbackMessages:read('localization/shared/en.json').messages},'nexora',language as LanguageKey));
describe('API application configuration',()=>{
 it('uses backend menus and keys while keeping page components and field identities local',()=>{
  const nav=raw();nav.nodes=nav.nodes.filter((n:{pageId?:string})=>n.pageId!=='vendor-master');
  const value=applyApplicationConfig(NEXORA_PRODUCT,parseNavigation(nav,'nexora'),locales());
  expect(JSON.stringify(value.modules.finance?.navigation)).not.toContain('vendor-master');
  expect(value.pages['customer-master'].titleKey).toBe('page.customer-master.title');
  expect(value.pages['customer-master'].entity).toBe(NEXORA_PRODUCT.pages['customer-master'].entity);
  expect(value.translations?.ar?.['Customer Master']).toBe('سجل العملاء');
 });
 it('legacy aliases never overwrite a catalog entry that many pages share',()=>{
  const english=read('localization/shared/en.json').messages;
  const value=applyApplicationConfig(NEXORA_PRODUCT,parseNavigation(raw(),'nexora'),locales());
  const lis=value.pages['reference-lis1-dashboard'],medslot=value.pages['reference-medslot-dashboard'];
  expect(lis.subtitleKey).toBe('reference.modules.demoNotice');
  for(const language of ['en','ar','hi','ml'] as const){
   const catalog=value.translations?.[language]??{};
   expect(catalog['reference.modules.demoNotice']).toBe(read(`localization/shared/${language}.json`).messages['reference.modules.demoNotice']);
   expect(catalog[medslot.subtitleKey!]).not.toBe(catalog['reference.modules.demoNotice']);
  }
  expect(value.translations?.en?.['reference.modules.demoNotice']).toBe(english['reference.modules.demoNotice']);
  expect(value.translations?.ar?.['Customer Master']).toBe('سجل العملاء');
 });
 it('rejects product/locale mismatches and cyclic or duplicate menus',()=>{
  expect(()=>parseNavigation(raw(),'ledger')).toThrow();
  const nav=raw();nav.nodes.push(nav.nodes[0]);expect(()=>parseNavigation(nav,'nexora')).toThrow();
  const cyclic=raw();const group=cyclic.nodes.find((n:{kind:string})=>n.kind==='group');group.parentId=group.id;expect(()=>parseNavigation(cyclic,'nexora')).toThrow();
  expect(()=>parseLocalization({...locales()[0],language:'ar'},'nexora','en')).toThrow();
 });
 it('never creates unsupported frontend pages from API configuration',()=>{
  const nav=raw();nav.pages.push({id:'uninstalled',titleKey:'unknown',subtitleKey:'unknown'});
  nav.nodes.push({id:'custom.menu',parentId:nav.nodes.find((n:{kind:string})=>n.kind==='section').id,kind:'page',pageId:'uninstalled',labelKey:'unknown',order:0});
  const value=applyApplicationConfig(NEXORA_PRODUCT,parseNavigation(nav,'nexora'),locales());
  expect(value.pages.uninstalled).toBeUndefined();expect(JSON.stringify(value.modules)).not.toContain('custom.menu');
 });
});
