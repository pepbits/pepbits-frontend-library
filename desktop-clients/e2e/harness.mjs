/**
 * The shared half of the browser checks.
 *
 * A real browser, driven against the running shell, asserting the things jsdom
 * structurally cannot see: whether an element is actually visible, what is in
 * the address bar, what is in localStorage, and whether a component survived a
 * re-render or was rebuilt.
 *
 * That distinction is not academic. Every bug in `e2e/README.md` was green in
 * the unit suite at the moment it was found.
 *
 * Playwright is resolved rather than imported: it is a ~300MB browser download
 * that most people running `npm test` do not need, so it is not a dependency of
 * this package. `npm run e2e` says clearly what to install when it is absent.
 */
import { suites } from "./suites.mjs";
import { basename } from "node:path";
import { createRequire } from "node:module";

export const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:3100";
export const DESKTOP = process.env.E2E_DESKTOP ?? "http://127.0.0.1:3101";
/** The API these suites intend to assert against. */
export const API = process.env.E2E_API ?? "http://127.0.0.1:3200";

export function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const specifier of ["playwright", "playwright-core"]) {
    try { return guardedPlaywright(require(specifier)); } catch { /* try the next */ }
  }
  if (process.env.PLAYWRIGHT_PATH) {
    try { return guardedPlaywright(require(`${process.env.PLAYWRIGHT_PATH}/index.js`)); } catch { /* fall through */ }
  }
  console.error(`
  Playwright is not installed.

    npx playwright install --with-deps chromium

  or point PLAYWRIGHT_PATH at an existing copy. It is deliberately not a
  dependency of this package: it is a large browser download, and \`npm test\`
  does not need it.
`);
  process.exit(2);
}

/** Fails the run rather than reporting a pass against a shell that is not up. */
export async function requireShell(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (response.ok || response.status === 307) return;
    throw new Error(`status ${response.status}`);
  } catch (error) {
    console.error(`\n  ${url} is not answering (${error.message}).\n  Start it with:  ./run.sh start\n`);
    process.exit(2);
  }
}

export function reporter(title) {
  const results = [];
  console.log(`\n  ${title}\n`);
  return {
    say(name, ok, detail = "") {
      results.push([name, ok]);
      console.log(`    ${ok ? "ok  " : "FAIL"}  ${name.padEnd(56)}${detail}`);
    },
    finish(errors = []) {
      const passed = results.filter(([, ok]) => ok).length;
      console.log(`\n    ${passed}/${results.length} passed`);
      if (errors.length) {
        console.log("    console errors:");
        for (const error of [...new Set(errors)].slice(0, 5)) console.log(`      ${error}`);
      }
      return passed === results.length && errors.length === 0;
    },
  };
}

/**
 * Which API the shell was BUILT against, observed rather than assumed.
 *
 * `NEXT_PUBLIC_*` is inlined by `next build`, not read at runtime, and
 * apps/web/.env.local points at the deployed API — so setting the variable on
 * `next start` does nothing and the shell keeps calling whatever host it was
 * last built for. Nine suites ran against front-design.pepbits.com for a whole
 * session before an endpoint that existed only locally failed with no
 * explanation at all.
 *
 * Read from the first request the shell actually makes rather than from the
 * build output: it reports where the application talks, which is the question,
 * and it does not need to know how the bundle is laid out.
 */
function watchApi(page) {
  const seen = { base: null };
  page.on("request", (request) => {
    if (seen.base) return;
    const match = /^(.*?)\/auth\//.exec(request.url());
    if (match) seen.base = match[1];
  });
  return seen;
}

/**
 * Fail loudly when the shell is talking to somewhere else.
 *
 * Loudly, and before any assertion runs: a suite pointed at the wrong API does
 * not fail, it passes — the deployed shell implements the same contract, so
 * everything agrees right up until the first endpoint that only exists locally.
 */
export function requireApi(observed) {
  if (!observed || observed === API) return;
  console.error(`
  The shell under test is calling a different API.

    it calls   ${observed}
    suites use ${API}

  NEXT_PUBLIC_* is inlined at BUILD time, so setting it on \`next start\` does
  nothing. Rebuild against the API you mean to test:

    NEXT_PUBLIC_API_URL=${API} VITE_API_URL=${API} npm run build

  or set E2E_API=${observed} if that is genuinely what you meant.
`);
  process.exit(2);
}

/** Signs in and returns a page. The demo shell has one account. */
export async function signIn(browser, url = BASE, viewport = { width: 1500, height: 950 }, context) {
  /* A caller that needs an init script — anything stubbing a browser API before
     the first byte of the app runs — makes its own context and passes it. */
  const page = context ? await context.newPage() : await browser.newPage({ viewport });
  const api = watchApi(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(`PAGEERROR: ${error.message.slice(0, 180)}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`CONSOLE: ${message.text().slice(0, 180)}`); });

  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  const password = page.locator('input[type="password"]');
  if (await password.count()) {
    await page.locator("input").first().fill("user1");
    await password.fill("user1");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(6000);
  }
  /* Checked HERE rather than left to each suite: a guard every caller has to
     remember is a guard that gets forgotten by the tenth caller. */
  requireApi(api.base);
  return { page, errors, apiBase: api.base };
}

/** Ctrl+K, type, pick a result. The one navigation path that works everywhere. */
export async function openViaPalette(page, query, index = 1) {
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(700);
  await page.keyboard.type(query);
  await page.waitForTimeout(700);
  const hit = page.locator('[role="dialog"] button').nth(index);
  if (!(await hit.count())) { await page.keyboard.press("Escape"); return false; }
  await hit.click();
  await page.waitForTimeout(2200);
  return true;
}

/**
 * Put a preference into a known state before asserting on it.
 *
 * Preferences persist per account, so a suite that assumes a default is
 * asserting against whatever the last run left behind. This cost a full
 * debugging pass: the workspace suite reported no tab strip, which was correct
 * — an earlier session had switched floating windows on and never switched them
 * back.
 */
export async function setPreference(page, switchName, on) {
  await openViaPalette(page, "preferences");
  const toggle = page.getByRole("switch", { name: switchName }).first();
  if (!(await toggle.count())) return false;
  await toggle.scrollIntoViewIfNeeded();
  if ((await toggle.getAttribute("aria-checked")) !== String(on)) {
    /* Dispatched on the element: with floating windows on, the preferences
       screen is itself a frame and a plain click can land on whichever frame
       is above it. */
    await toggle.evaluate((element) => element.click());
    await page.waitForTimeout(1800);
  }
  return (await toggle.getAttribute("aria-checked")) === String(on);
}


export function assertApiTarget(url, expected, method='GET') {
  const request=new URL(url),target=new URL(expected);
  const base=target.pathname.replace(/\/$/,'');
  // These endpoints read the existing host identity. They never receive login
  // credentials or create a competing module session. Keep the exact namespace
  // and method checks as well as the expected API origin/path boundary.
  const identityPaths=['/reference-modules/quality/auth/me','/reference-modules/surgisuite/api/auth/me','/reference-modules/medslot/api/auth/me'];
  const hostAuth=['/auth/login','/auth/me','/auth/logout'].some(path=>request.pathname===base+path);
  const moduleIdentity=method==='GET'&&identityPaths.some(path=>request.pathname===base+path);
  if(request.origin!==target.origin||request.username||request.password||(!hostAuth&&!moduleIdentity))throw new Error(`API target mismatch: shell calls ${request.origin+request.pathname}; expected ${expected}. Rebuild the shell for this test environment.`);
}

const wrapped=new WeakMap();
function guardedPlaywright(playwright) {
  if(wrapped.has(playwright))return wrapped.get(playwright);
  const result={...playwright};
  for(const engine of ['chromium','firefox','webkit']){
    const type=playwright[engine];
    result[engine]=new Proxy(type,{get(target,key){
      if(key!=='launch'){const value=target[key];return typeof value==='function'?value.bind(target):value;}
      return async options=>{
        const browser=await target.launch(options);
        const original=browser.newContext.bind(browser);
        browser.newContext=async options=>{
          const context=await original(options);
          const expected=process.env.E2E_API??(suites.browser.includes(basename(process.argv[1]??''))?API:'http://127.0.0.1:3330');
          // Installed before tests add fixture routes. Authentication is checked
          // before credentials leave the browser, not after a successful login.
          await context.route(/\/auth\/(?:login|me|logout)(?:[?#]|$)/,async route=>{
            try{assertApiTarget(route.request().url(),expected,route.request().method());}
            catch(error){await route.abort();throw error;}
            await route.continue();
          });
          return context;
        };
        // Playwright's browser.newPage uses an internal context constructor.
        browser.newPage=async options=>{const context=await browser.newContext(options);return context.newPage();};
        return browser;
      };
    }});
  }
  wrapped.set(playwright,result);return result;
}
