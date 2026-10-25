// @vitest-environment node
import {afterAll,beforeAll,expect,test} from 'vitest';
import {chromium,type Browser} from 'playwright';
import {createServer,type ViteDevServer} from 'vite';
import tailwind from '@tailwindcss/postcss';
import {THEME_OPTIONS} from '@pepbits/preferences';
let server:ViteDevServer,browser:Browser,base:string;
beforeAll(async()=>{
  server=await createServer({configFile:false,root:process.cwd(),logLevel:'error',server:{host:'127.0.0.1',port:0},
    css:{postcss:{plugins:[tailwind()]}},resolve:{dedupe:['react','react-dom']}});
  await server.listen();base=server.resolvedUrls!.local[0]!;
  browser=await chromium.launch({headless:true});
},60000);
afterAll(async()=>{await browser?.close();await server?.close();});
test.each(['left','right'] as const)('Chromium Arabic RTL places the rail physically %s through focus and keyboard expansion',async side=>{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto(`${base}src/test/browser/index.html?side=${side}`);
    const rail=page.getByRole('complementary');await rail.waitFor();
    expect(await page.locator('html').getAttribute('dir')).toBe('rtl');expect(await page.locator('html').getAttribute('lang')).toBe('ar');
    const collapsed=await rail.boundingBox();expect(collapsed).not.toBeNull();
    const physical=async()=>{const box=(await rail.boundingBox())!;expect(Math.abs(side==='left'?box.x:1280-box.x-box.width)).toBeLessThan(1);return box;};
    await physical();
    const main=(await page.getByRole('main').boundingBox())!;
    expect(Math.abs(side==='left'?main.x-collapsed!.width:1280-main.x-main.width-collapsed!.width)).toBeLessThan(1);
    // Focus, not a mouse click, expands the actual rail. Its physical edge stays fixed.
    await rail.getByRole('button',{name:'Items',exact:true}).focus();
    await page.getByRole('button',{name:'Collapse navigation',exact:true}).waitFor();
    await expect.poll(async()=> (await physical()).width).toBeGreaterThan(collapsed!.width);
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'Expand navigation',exact:true}).waitFor();
    await expect.poll(async()=> (await physical()).width).toBeCloseTo(collapsed!.width,0);
    // Native keyboard activation of the toggle still works in RTL.
    await page.getByRole('button',{name:'Expand navigation',exact:true}).focus();await page.keyboard.press('Enter');
    await page.getByRole('button',{name:'Collapse navigation',exact:true}).waitFor();await expect.poll(async()=> (await physical()).width).toBeGreaterThan(collapsed!.width);
    await page.locator('[data-outside]').focus();await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  } finally {await page.close();}
},30000);

test.each(THEME_OPTIONS.map(theme=>theme.id))('accent avatar initials retain readable contrast on shared surfaces in %s',async theme=>{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 try{
  // D deterministically selects the accent wash that failed the ERP route axe sweep.
  await page.goto(`${base}src/test/browser/index.html?avatars=1&theme=${theme}`);
  await page.getByRole('img',{name:'D',exact:true}).first().waitFor();
  const contrasts=await page.locator('[data-avatar-surface] [role=img]').evaluateAll(nodes=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d')!;
   const pixel=(color:string,background:string)=>{context.clearRect(0,0,1,1);context.fillStyle=background;context.fillRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3);};
   const luminance=(rgb:number[])=>rgb.map(c=>{const n=c/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((total,v,i)=>total+v*[.2126,.7152,.0722][i]!,0);
   return nodes.map(node=>{const css=getComputedStyle(node),surface=getComputedStyle(node.parentElement!).backgroundColor,b=luminance(pixel(css.backgroundColor,surface)),f=luminance(pixel(css.color,surface));return {surface:node.parentElement!.getAttribute('data-avatar-surface'),ratio:(Math.max(f,b)+.05)/(Math.min(f,b)+.05)};});
  });
  expect(contrasts).toHaveLength(4);expect(contrasts.filter(item=>item.ratio<4.5)).toEqual([]);
 }finally{await page.close();}
},30000);

test.each(['nexora','midnight'])('solid notifications retain readable copy for every tone in %s',async theme=>{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 try{
  await page.goto(`${base}src/test/browser/index.html?toasts=1&theme=${theme}`);
  await page.getByRole('button',{name:'Show notifications'}).click();
  await page.getByText('success notification',{exact:true}).waitFor();
  const contrasts=await page.locator('[data-shell-toasts] > div').evaluateAll(nodes=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d')!;
   const pixel=(color:string,background='#fff')=>{context.clearRect(0,0,1,1);context.fillStyle=background;context.fillRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3);};
   const luminance=(rgb:number[])=>rgb.map(c=>{const n=c/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((total,v,i)=>total+v*[.2126,.7152,.0722][i]!,0);
   return nodes.flatMap(node=>{const bg=getComputedStyle(node).backgroundColor,b=luminance(pixel(bg));return [...node.querySelectorAll('span')].filter(span=>span.childElementCount===0&&span.textContent?.trim()).map(span=>{const f=luminance(pixel(getComputedStyle(span).color,bg));return {text:span.textContent,ratio:(Math.max(f,b)+.05)/(Math.min(f,b)+.05)};});});
  });
  expect(contrasts).toHaveLength(8);expect(contrasts.filter(item=>item.ratio<4.5)).toEqual([]);
 }finally{await page.close();}
},30000);
