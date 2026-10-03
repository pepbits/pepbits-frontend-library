/** Generate isolated CSS from each original Tailwind 3 design. No global selectors. */
import {createRequire} from 'node:module';import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import ts from 'typescript';
const root=resolve(import.meta.dirname,'../..');
const require=createRequire(process.env.DIAGNOSTIC_STYLE_TOOL??resolve(root,'scripts/diagnostics/style-tools/package.json'));
const postcss=require('postcss'),tailwind=require('tailwindcss'),selectorParser=require('postcss-selector-parser');
const source=process.env.DIAGNOSTIC_REFERENCE_ROOT??'/home/pepadmin/pb/saas/reference/frontend';
for(const [variant,folder,configName,css] of [['lis1','lis-1/lis-system/frontend','tailwind.config.ts','app/globals.css'],['lis2','lis-2/lis-frontend','tailwind.config.js','src/app/globals.css'],['ris1','ris-1/ris','tailwind.config.ts','src/app/globals.css']]){
 const configText=ts.transpileModule(readFileSync(resolve(source,folder,configName),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const holder={exports:{}};new Function('module','exports',configText)(holder,holder.exports);const config=holder.exports.default??holder.exports;
 config.content=[resolve(root,'packages/reference-'+variant+'/src/**/*.{ts,tsx}')];
 const original=readFileSync(resolve(source,folder,css),'utf8').replace(/^@import[^\n]+/gm,'');
 const result=await postcss([tailwind(config)]).process(original,{from:undefined});
 const scope='.diagnostic-'+variant;const names=new Map();result.root.walkAtRules(/keyframes$/,rule=>{names.set(rule.params,variant+'-'+rule.params);rule.params=variant+'-'+rule.params;});
 result.root.walkRules(rule=>{
  if(rule.parent.type==='atrule'&&/keyframes$/.test(rule.parent.name))return;
  rule.selector=selectorParser(selectors=>{selectors.each(selector=>{
   const first=selector.nodes[0];
   if(first&&((first.type==='tag'&&['html','body'].includes(first.value))||(first.type==='pseudo'&&first.value===':root')))first.replaceWith(selectorParser.className({value:'diagnostic-'+variant}));
   else{selector.prepend(selectorParser.combinator({value:' '}));selector.prepend(selectorParser.className({value:'diagnostic-'+variant}));}
  });}).processSync(rule.selector);
 });
 result.root.walkDecls(decl=>{if(!/^(?:--[\w-]+|-?[a-zA-Z][\w-]*)$/.test(decl.prop)){decl.remove();return;}if(decl.prop.startsWith('animation'))for(const [a,b]of names)decl.value=decl.value.replace(new RegExp('\\b'+a+'\\b','g'),b);if(decl.prop==='border-radius'&&!['9999px','50%','0','0px'].includes(decl.value))decl.value='var(--radius, '+decl.value+')';});
 result.root.walkRules(rule=>{if(!rule.nodes.length)rule.remove();});
 const preferences=`\n${scope}{min-width:0;width:100%;font-family:inherit;font-size:calc(14px * var(--fs-form,1));padding:1rem;background:var(--surface-2);color:var(--text);}\n${scope} input,${scope} select,${scope} textarea{font-size:calc(13px * var(--fs-form,1));}\n${scope} table{font-size:calc(13px * var(--fs-result,1));}\n[data-reduced-motion="true"] ${scope} *{animation:none!important;transition:none!important;}\n`;
 writeFileSync(resolve(root,'packages/reference-'+variant+'/src/styles.css'),'/* Generated scoped source styles; scripts/diagnostics/styles.mjs. */\n'+result.root.toString()+preferences);
 console.log(variant,'scoped styles generated');
}
