import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';

const workspace=resolve(import.meta.dirname,'..');
const require=createRequire(join(workspace,'package.json'));
const {webpack}=require('next/dist/compiled/webpack/webpack');
const {trace}=require('next/dist/trace');
const fonts=join(workspace,'packages/tokens/src/fonts');
const provenance=JSON.parse(readFileSync(join(fonts,'provenance.json'),'utf8'));
const expected=['public-sans-latin-ext-wght-normal.woff2','public-sans-latin-wght-normal.woff2','public-sans-latin-ext-wght-italic.woff2','public-sans-latin-wght-italic.woff2','bricolage-grotesque-latin-standard-normal.woff2'];
const digest=file=>createHash('sha256').update(readFileSync(file)).digest('hex');

for(const entry of ['apps/web/src/app/globals.css','apps/desktop/src/globals.css']){
 test('shared fonts survive Tailwind imports and Next Webpack URL resolution: '+entry,async()=>{
  const output=mkdtempSync(join(tmpdir(),'pepbits-font-bundle-'));
  const compiler=webpack({mode:'development',context:workspace,target:'web',cache:false,devtool:false,
   entry:join(workspace,entry),output:{path:output,filename:'font-test.js'},
   plugins:[{apply(compiler){compiler.hooks.compilation.tap('FontTestTrace',compilation=>webpack.NormalModule.getCompilationHooks(compilation).loader.tap('FontTestTrace',context=>{context.currentTraceSpan=trace('reference-font-resolution');}));}}],
   module:{rules:[{test:/\.css$/,use:[{loader:require.resolve('next/dist/build/webpack/loaders/css-loader/src'),options:{url:true,import:false,modules:false,postcss:async()=>({postcss:require('postcss')})}},join(workspace,'scripts/test-helpers/reference-fonts-postcss-loader.cjs')]},{test:/\.woff2$/,type:'asset/resource',generator:{filename:'fonts/[name][ext]'}}]},
   optimization:{minimize:false},performance:{hints:false}});
  try{
   const stats=await new Promise((accept,reject)=>compiler.run((error,stats)=>error?reject(error):accept(stats)));
   assert.ok(stats&&!stats.hasErrors(),stats?.toString({all:false,errors:true,errorDetails:true}));
   const assets=stats.toJson({all:false,assets:true}).assets;
   for(const name of expected){assert.ok(assets.some(asset=>asset.name==='fonts/'+name),'Bundled font: '+name);assert.equal(digest(join(fonts,name)),provenance.sha256[name],'Source matches retained licensed font provenance');assert.equal(digest(join(output,'fonts',name)),digest(join(fonts,name)),'Font bytes must retain source identity');}
  }finally{await new Promise((accept,reject)=>compiler.close(error=>error?reject(error):accept()));rmSync(output,{recursive:true,force:true});}
 });
}
