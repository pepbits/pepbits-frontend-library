/** Backend catalogs are canonical. Generate standalone component / offline fallbacks. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const root=new URL('../../../',import.meta.url);
const catalogs=Object.fromEntries(['en','ar','hi','ml'].map(language=>[language,JSON.parse(readFileSync(new URL(`dummy-api/config/localization/shared/${language}.json`,root),'utf8')).messages]));
// Navigation and schema namespaces are delivered by bootstrap; don't bundle their
// thousands of per-page aliases into the standalone component fallback.
const fallbackKeys=Object.keys(catalogs.en).filter(key=>key.startsWith('preferences.')||key.startsWith('ui.')||key.startsWith('preference.')||key.startsWith('recovery.')||key.startsWith('draft.')||key.startsWith('center.')||key.startsWith('catalog.')||key.startsWith('template.')||key.startsWith('registration.')||key.startsWith('designer.')||key.startsWith('care.')||key.startsWith('identity.')||key.startsWith('devices.')||key.startsWith('labels.')||key.startsWith('sentinel.')||key.startsWith('api.')||key===catalogs.en[key]);
const uiCatalogs=Object.fromEntries(Object.entries(catalogs).map(([language,messages])=>[language,Object.fromEntries(fallbackKeys.map(key=>[key,messages[key]]))]));
const outputs=[
 ...Object.entries(uiCatalogs).map(([language,messages])=>[
  `desktop-clients/packages/erp-config/src/locales/${language}.ts`,
  `// Generated language fallback. Edit dummy-api/config/localization/shared/${language}.json.\nexport default ${JSON.stringify(messages,null,2)};\n`
 ]),
 ['desktop-clients/packages/erp-config/src/locale-messages.ts',`// Generated loader. English is immediate; other offline fallbacks load on demand.
import english from './locales/en.ts';
import type {LanguageKey} from './types';
export const UI_MESSAGES: Record<LanguageKey, Record<string,string>> = {en:english,ar:{},hi:{},ml:{}};
const loaders = {ar:()=>import('./locales/ar.ts'),hi:()=>import('./locales/hi.ts'),ml:()=>import('./locales/ml.ts')};
const pending = new Map<LanguageKey,Promise<void>>();
export function loadFallbackLanguage(language:LanguageKey):Promise<void> {
 if(language==='en'||Object.keys(UI_MESSAGES[language]).length)return Promise.resolve();
 if(!pending.has(language))pending.set(language,loaders[language]().then(module=>{UI_MESSAGES[language]=module.default;}).catch(error=>{pending.delete(language);throw error;}));
 return pending.get(language)!;
}
`],
 ['desktop-clients/packages/ops-ui/src/messages.en.ts',`// Generated English fallback for standalone UI components; backend catalogs remain canonical.\nexport const ENGLISH_MESSAGES: Record<string,string> = ${JSON.stringify(Object.fromEntries(Object.entries(catalogs.en).filter(([key])=>key.startsWith('preferences.')||key.startsWith('ui.')||key.startsWith('recovery.')||key.startsWith('draft.')||key.startsWith('center.')||key.startsWith('catalog.')||key.startsWith('template.')||key.startsWith('registration.')||key.startsWith('designer.')||key.startsWith('care.')||key.startsWith('identity.')||key.startsWith('devices.')||key.startsWith('labels.'))),null,2)};\n`],
];
mkdirSync(new URL("desktop-clients/packages/erp-config/src/locales/",root),{recursive:true});
let stale=false;for(const [file,content] of outputs){const url=new URL(file,root);if(process.argv.includes('--check')){if(readFileSync(url,'utf8')!==content){console.error(`${file} is stale`);stale=true;}}else writeFileSync(url,content);}if(stale)process.exitCode=1;
