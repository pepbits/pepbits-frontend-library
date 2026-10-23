import {FileQuestion} from '@pepbits/icons';
import {defineProduct, type ShellNavigation, type ShellDocumentation, type ShellTours} from '@pepbits/shell';
import type {DocumentationGuide} from '@pepbits/shell/documentation';
import {areas} from './areas';
export const brand = {name:'Showcase',tagline:'Library examples'};
export const navigation: ShellNavigation = {defaultModule:'gallery',modules:{gallery:{id:'gallery',label:'Showcase',shortLabel:'UI',description:'Component gallery',accent:'var(--primary)',icon:FileQuestion,navigation:[{id:'areas',label:'Gallery navigation',items:areas.map(area=>({id:area.id,pageId:area.id,label:area.title}))}]}},pages:Object.fromEntries(areas.map(area=>[area.id,{id:area.id,title:area.title,subtitle:'Library examples',kind:'gallery',module:'gallery'}]))};
export const product = defineProduct({...brand,id:'showcase',navigation,defaultModule:'gallery',enabledModules:['gallery'],access:{actions:{create:['editor'],edit:['editor'],export:['editor'],archive:['editor']}}});
export const tours:ShellTours = Object.fromEntries(areas.map(area=>[area.id,[{target:`gallery-${area.id}-heading`,title:'Library examples',text:'Fictional examples use the current preferences.'},{target:`gallery-${area.id}-search`,title:'Search examples',text:'Search by component or export name, then inspect its source.'}]]));
/** Fictional authored content; this request port performs no I/O. */
export const documentation:ShellDocumentation = {releaseId:'2026-10-23-showcase',request:async path=>{
 const params=new URLSearchParams(path.split('?')[1]),pageId=params.get('pageId')??'shell';
 const guide:DocumentationGuide={pageId,module:'gallery',title:'Fictional showcase guide',revision:1,status:'authored',language:params.get('language')??'en',requestedLanguage:params.get('language')??'en',reviewStatus:'Demo copy; native review pending',sections:[{id:'overview',title:'Explore the gallery',paragraphs:['This fictional guide is served from browser memory. Browse the sidebar, inspect a live example, and copy its executable source.','Preferences and policy are temporary. Real applications enforce authorization on the server (PREF-08).']}],fields:[],tour:[...(tours[pageId]??[])]};
 return Response.json({guide});
}};
