/**
 * Computed-style parity of the module against the ORIGINAL stylesheet. Every classed element rendered by the module is
 * re-created as a bare element with the same tag and class string on a page that carries only the original MedBand CSS;
 * the box/colour/type properties are compared. Exported for the focused check; run directly to print a report.
 */
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {build} from './build.mjs';
import {SCENARIOS} from './scenarios.mjs';

export const PROPS = ['color', 'background-color', 'border-top-color', 'border-top-width', 'border-top-style', 'border-bottom-color', 'border-bottom-width', 'border-left-color', 'border-left-width', 'border-top-left-radius', 'border-bottom-right-radius', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'font-size', 'font-weight', 'font-family', 'line-height', 'letter-spacing', 'text-transform', 'box-shadow', 'height', 'min-height', 'width'];
export const ROUTES = ['/', '/patients', '/patients/new', '/patients/pat-1', '/encounters', '/encounters/new', '/admissions', '/admissions/new', '/episodes'];

export async function launch() {
  process.env.PW_TEST_TIMEOUT ??= '4000';
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/home/pepadmin/pb/saas/.local/diagnostics-browser/browsers';
  const pw = createRequire('/home/pepadmin/pb/saas/.local/diagnostics-browser/package.json')('playwright');
  return pw.chromium.launch();
}

/** Snapshot of every classed element: tag, class, type and computed props, in the module page. */
export async function mount(page, path, prefs = {}) {
  await page.evaluate(([p, pr]) => window.mount(p, pr), [path, prefs]);
  await page.waitForSelector('[data-medband-stage]', {timeout: 8000}).catch(() => {});
  await page.waitForTimeout(500);
}
export async function snapshot(page, path, prefs = {}, run) {
  await mount(page, path, prefs);
  if (run) { await run(page); await page.mouse.move(0, 0); await page.waitForTimeout(400); }
  return page.evaluate(props => [...document.querySelectorAll('.reference-medband [class]')].filter(e => !e.closest('svg') || e.tagName === 'svg').map(e => {
    const cs = getComputedStyle(e);
    const chain = []; for (let a = e.parentElement; a && !a.classList.contains('reference-medband'); a = a.parentElement) chain.unshift({tag: a.tagName.toLowerCase(), cls: a.getAttribute('class') ?? '', disabled: a.disabled === true});
    return {chain, tag: e.tagName.toLowerCase(), type: e.getAttribute('type'), cls: e.getAttribute('class'), focused: e === document.activeElement, disabled: e.disabled === true, values: Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)])), w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height};
  }), PROPS);
}

/** Computed props of bare elements with the given tag/type/class on the original-CSS page. */
/** Classes the shared Card adds around the source Panel classes (`rounded-2xl border-0 ...` is the source's own). */
const HOST_BASE_SOURCE = String.raw`(^| )border border-\[var\(--border\)\]( |$)`;
export async function oracle(page, items) {
  await page.addStyleTag({content: '*{transition:none!important;animation:none!important}'});
  await page.bringToFront(); // :focus only matches in the foreground page
  return page.evaluate(([list, props, hostBase]) => { const HOST_BASE = new RegExp(hostBase, 'g'); return list.map(i => {
    // the original page: body > the same ancestor chain (tags and classes) > the element, so inherited colour and type match
    let parent = document.body; const made = [];
    for (const a of i.chain) { const n = document.createElement(['svg', 'path', 'circle', 'line', 'rect', 'polyline'].includes(a.tag) ? 'span' : a.tag); n.className = a.cls.replace(HOST_BASE, ' '); if (a.disabled) n.disabled = true; parent.appendChild(n); made.push(n); parent = n; }
    const e = document.createElement(i.tag === 'svg' ? 'span' : i.tag); if (i.type) e.setAttribute('type', i.type); e.className = i.cls.replace(HOST_BASE, ' '); parent.appendChild(e); if (i.disabled) e.disabled = true; if (i.focused) { e.tabIndex = 0; e.focus(); }
    const cs = getComputedStyle(e); const out = Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)])); (made[0] ?? e).remove(); return out;
  }); }, [items, PROPS, HOST_BASE_SOURCE]);
}

const norm = (prop, v) => v.replace(/\s+/g, ' ').trim();
/** Host adaptations that have no source counterpart (the demonstration-data notice uses utilities the source never generated). */
export const ADAPTED = item => /bg-band\/30/.test(item.cls);
export function diffs(items, expected, ignore = ADAPTED) {
  const out = new Map();
  items.forEach((item, i) => {
    for (const p of PROPS) {
      // size props are layout-dependent unless the class fixes them
      if (/^(width|height|min-height)$/.test(p) && !new RegExp(`(^| )${p === "width" ? "w" : p === "height" ? "h" : "min-h"}-(\\d|\\[)`).test(item.cls)) continue;
      if (/^(height|min-height)$/.test(p) && !/(^| )(min-)?h-(\d|\[)/.test(item.cls)) continue;
      const a = norm(p, item.values[p]), b = norm(p, expected[i][p]);
      if (a !== b && !ignore(item, p, a, b)) { const key = `${item.focused ? 'FOCUSED ' : ''}${item.disabled ? 'DISABLED ' : ''}${item.tag}${item.type ? '[' + item.type + ']' : ''}.${item.cls}`; (out.get(key) ?? out.set(key, []).get(key)).push(`${p}: got ${a} | source ${b}`); }
    }
  });
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = await build(); const browser = await launch();
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}}); page.setDefaultTimeout(5000); const ref = await browser.newPage({viewport: {width: 1440, height: 1000}});
  await ref.goto(`file://${dir}/oracle.html`); await page.goto(`file://${dir}/index.html`);
  const all = new Map();
  const jobs = [...(process.argv[2] ? [process.argv[2]] : ROUTES).map(route => ({name: route, route})), ...(process.argv[2] ? [] : SCENARIOS)];
  for (const job of jobs) {
    const route = job.name;
    const items = await snapshot(page, job.route, {}, job.run).catch(error => { console.log('SCENARIO FAILED', job.name, String(error).split('\n')[0]); return []; });
    if (!items.length) continue; const unique = [...new Map(items.map(i => [i.chain.map(c => c.cls).join('>') + i.tag + i.type + i.cls + i.focused + i.disabled, i])).values()];
    for (const [k, v] of diffs(unique, await oracle(ref, unique))) all.set(k, v);
    console.log(route, items.length, 'elements');
  }
  for (const [k, v] of all) console.log('\n' + k.slice(0, 160) + '\n  ' + v.join('\n  '));
  console.log('\ndiffering class strings:', all.size);
  await browser.close();
}

/** A property list that includes the focus ring (box-shadow/outline) and everything a state can change. */
const STATE_PROPS = [...PROPS, 'outline-style', 'outline-color', 'outline-width', 'outline-offset', 'text-decoration-line'];  // cursor is deliberately not compared: the host shows a pointer on buttons/links (source: default)

/** Describes an element for re-creation: tag, type, class, flags and its ancestor chain up to the module root. */
const describe = el => {
  const chain = []; for (let a = el.parentElement; a && !a.classList.contains('reference-medband'); a = a.parentElement) chain.unshift({tag: a.tagName.toLowerCase(), cls: a.getAttribute('class') ?? ''});
  return {chain, tag: el.tagName.toLowerCase(), type: el.getAttribute('type'), cls: el.getAttribute('class'), disabled: el.disabled === true, checked: el.checked === true};
};

/** Computed values of `selector`'s first match while hovered/focused, in the module and on the original-CSS page. Returns [got, source]. */
export async function stateValues(page, ref, selector, state) {
  await page.addStyleTag({content: '*{transition:none!important;animation:none!important}'});
  await ref.addStyleTag({content: '*{transition:none!important;animation:none!important}'});
  const locator = page.locator(selector).first();
  await locator.scrollIntoViewIfNeeded();
  const info = await locator.evaluate(describe);
  await page.mouse.move(0, 0);
  await page.keyboard.press('Shift'); // keyboard modality: programmatic focus then matches :focus-visible, as on the oracle page
  if (state === 'hover') await locator.hover(); else await locator.focus();
  const got = await locator.evaluate((el, props) => { const cs = getComputedStyle(el); return Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)])); }, STATE_PROPS);
  await page.mouse.move(0, 0);
  await ref.bringToFront();
  await ref.evaluate(([i, hostBase]) => {
    document.getElementById('probe-root')?.remove();
    const base = new RegExp(hostBase, 'g'); const root = document.createElement('div'); root.id = 'probe-root'; document.body.appendChild(root);
    let parent = root; for (const a of i.chain) { const n = document.createElement(['svg', 'path'].includes(a.tag) ? 'span' : a.tag); n.className = a.cls.replace(base, ' '); parent.appendChild(n); parent = n; }
    const e = document.createElement(i.tag); if (i.type) e.setAttribute('type', i.type); e.className = i.cls.replace(base, ' '); e.id = 'probe'; if (i.tag === 'a') e.setAttribute('href', '#'); if (i.tag === 'tr') { const td = document.createElement('td'); td.textContent = 'x'; e.appendChild(td); } else e.textContent = 'x'; if (i.disabled) e.disabled = true; if (i.checked) e.checked = true; parent.appendChild(e);
  }, [info, HOST_BASE_SOURCE]);
  const probe = ref.locator('#probe');
  await ref.keyboard.press('Shift');
  if (state === 'hover') await probe.hover(); else await probe.focus();
  const source = await probe.evaluate((el, props) => { const cs = getComputedStyle(el); return Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)])); }, STATE_PROPS);
  await page.bringToFront();
  return {got, source, props: STATE_PROPS};
}
