import {build} from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import {readFileSync,writeFileSync,mkdtempSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(join(root,'package.json'));
const out=process.env.SCHOOL_VISUAL_DIR??mkdtempSync(join(tmpdir(),'school-visual-'));
await build({entryPoints:[join(root,'docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24/visual-harness.tsx')],bundle:true,outfile:join(out,'harness.js'),jsx:'automatic',format:'iife',loader:{'.css':'local-css'},define:{'process.env.NODE_ENV':'"production"'},logLevel:'error',plugins:[{name:'read-only-reference-packages',setup(builder){
 builder.onResolve({filter:/^@pepbits\//},args=>{
  if(!args.importer.includes('/desktop-clients/'))return;
  const name=args.path.split('/')[1],suffix=args.path.split('/').slice(2).join('/'),folder=join(root,'desktop-clients/packages',name);
  if(!existsSync(join(folder,'package.json')))return;
  const pkg=JSON.parse(readFileSync(join(folder,'package.json'),'utf8'));
  const entry=pkg.exports?.[suffix?'./'+suffix:'.']??pkg.main;
  if(typeof entry==='string')return {path:resolve(folder,entry)};
 });
 builder.onResolve({filter:/^(react|react-dom)(\/.*)?$|^lucide-react$/},args=>({path:args.path==='lucide-react'?require.resolve(args.path,{paths:[process.env.SCHOOL_REFERENCE_RUNTIME??join(root,'desktop-clients'),'/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/desktop-clients']}):require.resolve(args.path)}));
}}]});
const css=`@import "tailwindcss";\n@import "${root}packages/tokens/src/tokens.css";\n@source "${root}desktop-clients/packages/reference-school/src";\n@source "${root}desktop-clients/packages/ops-ui/src";\n@source "${root}demo-apps/school/src";\n@source "${root}packages";\n@font-face{font-family:Inter;font-style:normal;font-weight:100 900;src:url("file://${root}node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2")}body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font-ui)}#source,#demo{width:1280px;min-height:900px}main{height:100%}button,input,select,textarea{font:inherit}`;
const tokens=JSON.parse(readFileSync(join(root,'packages/tokens/package.json'),'utf8')).exports['./tokens.css'];
const built=await postcss([tailwind({base:root,optimize:false})]).process(css.replace(root+'packages/tokens/src/tokens.css',resolve(root,'packages/tokens',tokens)),{from:join(root,'demo-apps/school/visual.css')});
writeFileSync(join(out,'utilities.css'),built.css);
writeFileSync(join(out,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><title>School source comparison</title><link rel="stylesheet" href="utilities.css"><link rel="stylesheet" href="harness.css"></head><body><div id="source"></div><div id="demo"></div><script src="harness.js"></script></body></html>');
console.log(out);
