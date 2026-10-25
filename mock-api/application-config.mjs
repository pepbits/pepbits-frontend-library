import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {schoolViewRoles} from './school-view-policy.mjs';
import {schoolRoleView} from '../desktop-clients/packages/erp-config/src/school-role-views.ts';
const LANGUAGES={en:'ltr',ar:'rtl',hi:'ltr',ml:'ltr'};
const slug=/^[a-z][a-z0-9.-]*$/;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);
const fail=message=>{throw new Error(`Application configuration: ${message}`);};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
function catalog(value){
 if(!object(value)||value.schemaVersion!==1||!object(value.messages))fail('invalid catalog');
 for(const [key,message] of Object.entries(value.messages))if(!key||['__proto__','constructor','prototype'].includes(key)||typeof message!=='string')fail('invalid message');
 return value.messages;
}
export function validateNavigation(value,knownPages){
 if(!object(value)||value.schemaVersion!==1||!slug.test(value.productId)||!Array.isArray(value.nodes)||!Array.isArray(value.pages)||!Array.isArray(value.roles)||!value.roles.length)fail('invalid navigation document');
 const pages=new Set();
 const roles=entry=>{if(entry.roles!==undefined&&(!Array.isArray(entry.roles)||!entry.roles.length||entry.roles.some(role=>typeof role!=='string')))fail('invalid roles');};
 roles(value);
 for(const page of value.pages){if(!object(page)||!slug.test(page.id)||pages.has(page.id)||!knownPages.has(page.id)||typeof page.titleKey!=='string'||typeof page.subtitleKey!=='string')fail('invalid or duplicate page');pages.add(page.id);roles(page);}
 const nodes=new Map();
 for(const node of value.nodes){
  if(!object(node)||!slug.test(node.id)||nodes.has(node.id)||!['module','section','group','page'].includes(node.kind)||typeof node.labelKey!=='string'||!Number.isFinite(node.order))fail('invalid or duplicate menu');
  if(node.icon!==undefined&&typeof node.icon!=='string'||node.badge!==undefined&&typeof node.badge!=='string')fail('invalid display metadata');
  if(node.kind==='page'&&!pages.has(node.pageId)||node.pageId!==undefined&&!pages.has(node.pageId))fail('unknown menu page');
  if(node.kind==='module'&&(!slug.test(node.moduleId)||typeof node.shortLabelKey!=='string'||node.parentId!==null))fail('invalid module');
  roles(node);nodes.set(node.id,node);
 }
 const modules=value.nodes.filter(n=>n.kind==='module').map(n=>n.moduleId);
 if(new Set(modules).size!==modules.length||!modules.includes(value.defaultModule)||!pages.has(value.defaultPageId))fail('invalid defaults');
 for(const node of value.nodes){
  if(node.kind!=='module'){
   const parent=nodes.get(node.parentId);
   if(!parent||node.kind==='section'&&parent.kind!=='module'||['group','page'].includes(node.kind)&&!['section','group'].includes(parent.kind))fail('invalid parent');
  }
  const seen=new Set([node.id]);let parent=nodes.get(node.parentId);
  while(parent){if(seen.has(parent.id))fail('cyclic menu');seen.add(parent.id);parent=nodes.get(parent.parentId);}
 }
 return value;
}
export function createApplicationConfig(root,knownPages){
 const read=file=>JSON.parse(readFileSync(file,'utf8'));
 const shared=Object.fromEntries(Object.keys(LANGUAGES).map(language=>[language,catalog(read(join(root,'localization','shared',`${language}.json`)))]));
 const products=new Map();
 for(const file of readdirSync(join(root,'navigation')).filter(file=>file.endsWith('.json'))){
  const nav=validateNavigation(read(join(root,'navigation',file)),knownPages);
  if(file!==`${nav.productId}.json`||products.has(nav.productId))fail('product filename mismatch');
  const dictionaries=Object.fromEntries(Object.keys(LANGUAGES).map(language=>[language,{...shared[language],...catalog(read(join(root,'localization','products',nav.productId,`${language}.json`)))}]));
  const english=dictionaries.en;
  for(const key of [...nav.nodes.flatMap(n=>[n.labelKey,...(n.shortLabelKey?[n.shortLabelKey]:[])]),...nav.pages.flatMap(p=>[p.titleKey,p.subtitleKey])])if(!Object.hasOwn(english,key))fail(`missing English key ${key}`);
  const tokens=message=>[...message.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(',');
  for(const [language,messages] of Object.entries(dictionaries))for(const [key,message] of Object.entries(messages))if(!Object.hasOwn(english,key)||tokens(message)!==tokens(english[key]))fail(`placeholder mismatch ${language}:${key}`);
  products.set(nav.productId,{nav,dictionaries});
 }
 const get=(user,productId)=>{
  if(!user)return {status:401,error:'Not signed in.'};
  if(typeof productId!=='string'||!slug.test(productId))return {status:400,error:'Invalid product.'};
  const product=products.get(productId);
  if(!product||!product.nav.roles.includes(user.role))return {status:403,error:'Product is unavailable.'};
  return product;
 };
 return {
  navigation(user,productId){
   const product=get(user,productId);if(product.error)return product;
   const schoolRoles=schoolViewRoles(user);
   const nodeById=new Map(product.nav.nodes.map(node=>[node.id,node]));
   const schoolModule=item=>{
    let current=item;while(current&&current.kind!=='module')current=nodeById.get(current.parentId);
    return current?.kind==='module'?schoolRoleView(current.moduleId):undefined;
   };
   const allowed=item=>{
    const view=schoolModule(item);
    if(view)return schoolRoles.includes(view.role)&&(!item.roles||item.roles.includes('school-'+view.role));
    if(item.id.startsWith('reference-school-')&&!item.kind)return schoolRoles.length>0&&(!item.roles||schoolRoles.some(role=>item.roles.includes('school-'+role)));
    return !item.roles||item.roles.includes(user.role);
   };
   const pages=product.nav.pages.filter(allowed).map(({roles,...page})=>page),pageIds=new Set(pages.map(p=>p.id));
   const build=parentId=>product.nav.nodes.filter(n=>n.parentId===parentId&&allowed(n)&&(!n.pageId||pageIds.has(n.pageId))).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)).flatMap(node=>{
    const children=build(node.id);if(node.kind!=='page'&&!node.pageId&&!children.length)return [];
    const {roles,...visible}=node;return [visible,...children];
   });
   const nodes=build(null),modules=nodes.filter(n=>n.kind==='module');
   if(!modules.length)return {status:403,error:'No navigation is available for this account.'};
   const defaultModule=modules.some(m=>m.moduleId===product.nav.defaultModule)?product.nav.defaultModule:modules[0].moduleId;
   const defaultPageId=pageIds.has(product.nav.defaultPageId)?product.nav.defaultPageId:pages[0]?.id;
   const body={schemaVersion:1,productId,defaultModule,defaultPageId,pages,nodes};return {status:200,body:{...body,revision:hash(body)}};
  },
  localization(user,productId,language){
   const product=get(user,productId);if(product.error)return product;
   if(!Object.hasOwn(LANGUAGES,language))return {status:400,error:'Unsupported language.'};
   const body={schemaVersion:1,productId,language,direction:LANGUAGES[language],fallbackLanguage:'en',messages:product.dictionaries[language],fallbackMessages:product.dictionaries.en};
   return {status:200,body:{...body,revision:hash(body)}};
  }
 };
}
