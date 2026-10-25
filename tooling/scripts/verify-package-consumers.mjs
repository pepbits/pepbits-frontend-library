import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
import {publicPackages,root} from './release-pack.mjs';

const base=path.resolve(process.env.CONSUMER_PROOF_DIR || path.join(process.env.HOME,'.cache/pepbits-phase7a/consumers'));
const tarballs=path.resolve(process.env.RELEASE_PACK_DIR);
assert(base !== path.resolve(root) && !base.startsWith(root), 'Consumers must be outside the repository');
const packedManifest=JSON.parse(fs.readFileSync(path.join(tarballs,'manifest.json'),'utf8'));
const results=[];
for(const kind of ['next','vite']) {
  const dir=path.join(base,kind);fs.mkdirSync(dir,{recursive:true});
  const write=(name,value)=>{fs.mkdirSync(path.dirname(path.join(dir,name)),{recursive:true});fs.writeFileSync(path.join(dir,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');};
  const dependencies=Object.fromEntries(publicPackages.map(name=>[`@pepbits/${name}`,`file:${path.join(tarballs,`pepbits-${name}-0.1.0.tgz`)}`]));
  Object.assign(dependencies,{react:'19.2.0','react-dom':'19.2.0'});
  const devDependencies={typescript:'5.9.3','@types/react':'^19.0.0','@types/react-dom':'^19.0.0','@types/node':'^22.0.0','tailwindcss':'4.3.3','@tailwindcss/postcss':'4.3.3',postcss:'8.5.31',...(kind==='next'?{next:'16.3.3'}:{vite:'7.3.7'})};
  write('package.json',{name:`phase7a-${kind}-consumer`,private:true,type:'module',scripts:{build:kind==='next'?'next build --webpack':'tsc --noEmit && vite build'},dependencies,devDependencies});
  write('.npmrc','registry=https://registry.npmjs.org\n');
  write('tsconfig.json',{compilerOptions:{target:'ES2022',lib:['dom','dom.iterable','es2022'],module:'esnext',moduleResolution:'bundler',jsx:'react-jsx',strict:true,skipLibCheck:true,esModuleInterop:true,noEmit:true},include:['**/*.tsx','**/*.ts'],exclude:['node_modules']});
  write('postcss.config.mjs',`export default {plugins:{'@tailwindcss/postcss':{}}};\n`);
  for(const file of ['Consumer.tsx','style.css'])fs.copyFileSync(path.join(root,'tooling/consumer-proof',file),path.join(dir,file));
  if(kind==='next') {
    write('next.config.mjs',`export default {agentRules:false,experimental:{cpus:2}};\n`);
    write('app/layout.tsx',`import '../style.css';\nimport '@pepbits/tokens/reference-fonts.css';\nexport default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}\n`);
    // Direct server-component imports verify preserved package client boundaries.
    write('app/page.tsx',`import Consumer from '../Consumer';\nimport {Button} from '@pepbits/ui';\nexport default function Page(){return <><Button>Server imported client button</Button><Consumer/></>;}\n`);
  } else {
    write('index.html','<!doctype html><html lang="en"><head><title>Packed Vite consumer</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
    write('main.tsx',`import React from 'react';import {createRoot} from 'react-dom/client';import Consumer from './Consumer';import './style.css';import '@pepbits/tokens/reference-fonts.css';createRoot(document.getElementById('root')!).render(<Consumer/>);`);
  }
  // A local tarball can change without its filename changing during a rehearsal.
  // Never let a previous proof lockfile retain the old content-addressed artifact.
  fs.rmSync(path.join(dir,'package-lock.json'),{force:true});
  let server,browser;
  try {
    const install=execFileSync('npm',['install','--no-audit','--no-fund'],{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024});
    write('install.log',install);
    for(const name of publicPackages)assert(!fs.lstatSync(path.join(dir,'node_modules/@pepbits',name)).isSymbolicLink());
    const lock=JSON.parse(fs.readFileSync(path.join(dir,'package-lock.json'),'utf8'));
    for(const pkg of packedManifest)assert.equal(lock.packages[`node_modules/${pkg.name}`].integrity,pkg.integrity,`Installed tarball mismatch: ${pkg.name}`);
    const require=createRequire(path.join(dir,'package.json')),XLSX=require('xlsx');
    const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['name'],['Example']]),'Proof');
    fs.mkdirSync(path.join(dir,'public'),{recursive:true});XLSX.writeFile(workbook,path.join(dir,'public/fixture.xlsx'),{compression:false});
    const started=Date.now();
    try {write('build.log',execFileSync('npm',['run','build'],{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024}));}
    catch(error){write('build.log',`${error.stdout??''}\n${error.stderr??''}`);throw error;}
    const port=kind==='next'?3571:3572;
    const bin=kind==='next'?'node_modules/next/dist/bin/next':'node_modules/vite/bin/vite.js';
    const args=kind==='next'?['start','--hostname','127.0.0.1','--port',String(port)]:['preview','--host','127.0.0.1','--port',String(port),'--strictPort'];
    const log=fs.openSync(path.join(dir,'server.log'),'w');server=spawn(process.execPath,[bin,...args],{cwd:dir,stdio:['ignore',log,log]});fs.closeSync(log);
    const url=`http://127.0.0.1:${port}`;let ready=false;
    for(let i=0;i<240;i++){if(server.exitCode!==null)throw new Error('Server exited before ready');try{if((await fetch(url)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
    assert(ready,'Production server ready');
    browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(60000);
    const errors=[],failed=[],fontResponses=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    page.on('requestfailed',request=>failed.push(request.url()));page.on('response',response=>{if(response.url().includes('.woff2'))fontResponses.push({url:response.url().replace(url,''),status:response.status()});});
    await page.goto(url,{waitUntil:'networkidle',timeout:120000});await page.getByRole('heading',{name:'Packed consumer proof'}).waitFor();
    await page.getByRole('button',{name:'Packed action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-testid="clicks"]')?.textContent==='1');
    await page.getByLabel('Packed input',{exact:true}).fill('Changed');assert.equal(await page.getByLabel('Packed input',{exact:true}).inputValue(),'Changed');
    await page.getByText('Packed template',{exact:true}).waitFor();
    const css=await page.evaluate(async()=>{await document.fonts.ready;const label=document.querySelector('[data-testid="pattern"] section'),button=[...document.querySelectorAll('button')].find(el=>el.textContent==='Packed action');return {labelDisplay:getComputedStyle(label).display,labelDirection:getComputedStyle(label).flexDirection,buttonDisplay:getComputedStyle(button).display,buttonHeight:getComputedStyle(button).height,token:getComputedStyle(document.querySelector('main')).getPropertyValue('--surface'),fontLoaded:[...document.fonts].some(font=>font.family.replaceAll('"','')==='Public Sans'&&font.status==='loaded')};});
    assert.equal(css.labelDisplay,'flex');assert.equal(css.labelDirection,'column');assert.equal(css.buttonDisplay,'inline-flex');assert(parseFloat(css.buttonHeight)>=30);assert(css.token.trim());assert(css.fontLoaded);assert(fontResponses.some(response=>response.status===200));
    await page.getByRole('button',{name:'Check packed worker'}).click();await page.waitForFunction(()=>document.querySelector('[data-testid="worker"]')?.textContent==='passed',null,{timeout:60000});
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    const result={kind,packages:12,build:'passed',buildAndRenderSeconds:Math.round((Date.now()-started)/1000),checks:11,css,fontResponses,pageErrors:errors,failedRequests:failed,worker:'passed',nodeModulesRemoved:false};
    results.push(result);console.log(JSON.stringify(result));
  } finally {
    if(browser)await browser.close();
    if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>{server.once('exit',resolve);const timeout=setTimeout(()=>{server.kill('SIGKILL');},10000);timeout.unref();});}
    fs.rmSync(path.join(dir,'node_modules'),{recursive:true,force:true});
    if(results.at(-1)?.kind===kind)results.at(-1).nodeModulesRemoved=true;
    fs.writeFileSync(path.join(base,'results.json'),JSON.stringify(results,null,2)+'\n');
  }
}
