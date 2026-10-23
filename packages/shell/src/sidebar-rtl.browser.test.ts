// @vitest-environment node
import {afterAll,beforeAll,expect,test} from 'vitest';
import {chromium,type Browser} from 'playwright';
import {createServer,type ViteDevServer} from 'vite';
import tailwind from '@tailwindcss/postcss';
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
