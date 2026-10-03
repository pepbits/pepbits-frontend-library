import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
const workspace=resolve(import.meta.dirname,'..');
const require=createRequire(join(workspace,'package.json'));
const {webpack}=require('next/dist/compiled/webpack/webpack');
// Load the real config through the exact Next loader used by next build.
// A helper that works in direct ESM imports may still fail this CJS boundary.
const {transpileConfig}=require('next/dist/build/next-config-ts/transpile-config');
const loaded=await transpileConfig({nextConfigPath:join(workspace,'apps/web/next.config.ts'),dir:join(workspace,'apps/web')});
const nextConfig=loaded.default??loaded;
const splitCatalogChunks=nextConfig.webpack;
assert.equal(typeof splitCatalogChunks,'function','Actual Next config loaded');

test('Next Webpack bundles actual canonical English catalogs in separate assets',async()=>{
  const output=mkdtempSync(join(tmpdir(),'pepbits-catalog-chunks-'));
  const entry=join(output,'entry.mjs');
  writeFileSync(entry,`import locale from ${JSON.stringify(join(workspace,'packages/erp-config/src/locales/en.ts'))};import {ENGLISH_MESSAGES} from ${JSON.stringify(join(workspace,'packages/ops-ui/src/messages.en.ts'))};globalThis.catalogs=[locale,ENGLISH_MESSAGES];`);
  const compiler=webpack(splitCatalogChunks({mode:'production',context:workspace,target:'web',cache:false,devtool:false,entry,
    output:{path:join(output,'bundle'),filename:'[name].js'},module:{rules:[{test:/\.ts$/,use:join(workspace,'scripts/test-helpers/catalog-typescript-loader.cjs')}]},
    optimization:{minimize:false,splitChunks:{cacheGroups:{existingVendor:{test:/node_modules/,name:'vendor',chunks:'all'}}}},performance:{hints:false}}, {dev:false,isServer:false}));
  try{
    const stats=await new Promise((accept,reject)=>compiler.run((error,stats)=>error?reject(error):accept(stats)));
    assert.ok(stats&&!stats.hasErrors(),stats?.toString({all:false,errors:true}));
    const names=stats.toJson({all:false,assets:true}).assets.map(asset=>asset.name);
    for(const name of ['locale-fallback-en.js','ui-english-fallback.js']){
      assert.ok(names.includes(name),name);
      assert.ok(gzipSync(readFileSync(join(output,'bundle',name))).length<=550000,'Canonical catalog respects the existing compressed chunk budget: '+name);
    }
    assert.ok(readFileSync(join(output,'bundle','main.js')).length<10000,'Entry does not embed either complete catalog');
  }finally{await new Promise((accept,reject)=>compiler.close(error=>error?reject(error):accept()));rmSync(output,{recursive:true,force:true});}
});

test('Catalog grouping preserves framework groups and leaves development/server builds unchanged',()=>{
  for(const context of [{dev:true,isServer:false},{dev:false,isServer:true}]){
    const config={optimization:{splitChunks:{cacheGroups:{framework:{priority:40}}}}};
    const original=JSON.stringify(config);assert.equal(splitCatalogChunks(config,context),config);assert.equal(JSON.stringify(config),original);
  }
  const framework={priority:40};const config={optimization:{splitChunks:{cacheGroups:{framework}}}};
  splitCatalogChunks(config,{dev:false,isServer:false});assert.equal(config.optimization.splitChunks.cacheGroups.framework,framework);
  for(const language of ['en','ar','hi','ml']){
    const group=config.optimization.splitChunks.cacheGroups[`pepbitsLocale_${language}`];
    assert.equal(group.name,`locale-fallback-${language}`);
    assert.ok(group.test.test(`/packages/erp-config/src/locales/${language}.ts`));
    assert.ok(group.test.test(`C:\\packages\\erp-config\\src\\locales\\${language}.ts`));
  }
});
