/**
 * Computed-style parity of the module against the ORIGINAL stylesheet. Every classed element the module renders is re-created as a
 * bare element with the same tag, ancestors and class string on a page that carries only the original RCM CSS (Tailwind 3); the
 * colour/box/type/shadow properties are compared. There is no exception list: every difference is reported. Helpers (launch, PROPS,
 * diffs) come from the stable MedBand harness; the page-specific parts (root class, snapshot, state probes) are RCM's.
 */
import {launch, PROPS} from '../../medband/parity/measure.mjs';
export {launch, PROPS};

/**
 * Computed colours are compared as numbers: Chromium serialises `color-mix()` results as `color(srgb r g b / a)` and plain hex as
 * `rgb()`, which are the same colour. Everything else is compared as normalised text. There is no ignore list.
 */
const channel = v => Math.round(Number(v) * 255);
const normalise = value => value.replace(/\s+/g, ' ').trim()
  .replace(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)/g, (_, r, g, b, a) => (a === undefined || Number(a) === 1 ? `rgb(${channel(r)}, ${channel(g)}, ${channel(b)})` : `rgba(${channel(r)}, ${channel(g)}, ${channel(b)}, ${+Number(a).toFixed(3)})`))
  .replace(/rgba\((\d+), (\d+), (\d+), 1\)/g, 'rgb($1, $2, $3)');
export const same = (a, b) => normalise(a) === normalise(b);
const fixed = (p, cls) => !/^(width|height|min-height)$/.test(p) || new RegExp(`(^| )${p === 'width' ? 'w' : p === 'height' ? 'h' : 'min-h'}-(\\d|\\[)`).test(cls);
export function diffs(items, expected) {
  const out = new Map();
  items.forEach((item, i) => {
    for (const p of PROPS) {
      if (!fixed(p, item.cls)) continue;
      const a = normalise(item.values[p]), b = normalise(expected[i][p]);
      if (a !== b) { const key = `${item.focused ? 'FOCUSED ' : ''}${item.disabled ? 'DISABLED ' : ''}${item.tag}${item.type ? '[' + item.type + ']' : ''}.${item.cls}`; (out.get(key) ?? out.set(key, []).get(key)).push(`${p}: got ${a} | source ${b}`); }
    }
  });
  return out;
}

export const ROUTES = ['/', '/aging', '/reports', '/approvals', '/w/invoices', '/w/coverages', '/w/claims', '/w/exchange-messages'];
const ROOT = 'reference-rcm';

export async function mount(page, path, prefs = {}) {
  await page.evaluate(([p, pr]) => window.mount(p, pr), [path, prefs]);
  await page.waitForSelector('[data-rcm-stage]', {timeout: 8000}).catch(() => {});
  await page.waitForTimeout(600);
}

export async function snapshot(page, path, prefs = {}, run) {
  await mount(page, path, prefs);
  if (run) { await run(page); await page.mouse.move(0, 0); await page.waitForTimeout(400); }
  return page.evaluate(([props, rootClass]) => [...document.querySelectorAll(`.${rootClass} [class]`)]
    .filter(e => !e.closest('svg') || e.tagName === 'svg').map(e => {
    const cs = getComputedStyle(e);
    const chain = []; for (let a = e.parentElement; a && !a.classList.contains(rootClass); a = a.parentElement) chain.unshift({tag: a.tagName.toLowerCase(), cls: a.getAttribute('class') ?? '', style: a.getAttribute('style'), open: a.tagName === 'DIALOG' && a.open, disabled: a.disabled === true, idx: (() => { let n = 0; for (let x = a.previousElementSibling; x; x = x.previousElementSibling) n++; return n; })()});
    let idx = 0; for (let x = e.previousElementSibling; x; x = x.previousElementSibling) idx++;
    return {idx, style: e.getAttribute('style'), chain, tag: e.tagName.toLowerCase(), type: e.getAttribute('type'), cls: e.getAttribute('class'), focused: e === document.activeElement && e.matches(':focus-visible'), open: e.tagName === 'DIALOG' && e.open, disabled: e.disabled === true, values: Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)]))};
  }), [PROPS, ROOT]);
}

/** Computed props of bare elements with the same tag/type/class (and ancestor chain) on the original-CSS page. */
export async function oracle(page, items) {
  await page.addStyleTag({content: '*{transition:none!important;animation:none!important}'});
  await page.bringToFront(); // :focus only matches in the foreground page
  return page.evaluate(([list, props]) => list.map(i => {
    let parent = document.body; const made = [];
    for (const a of i.chain) { const n = document.createElement(['svg', 'path', 'circle', 'line', 'rect', 'polyline'].includes(a.tag) ? 'span' : a.tag); for (let k = 0; k < (a.idx ?? 0); k++) parent.appendChild(document.createElement('span')); n.className = a.cls; if (a.style) n.setAttribute('style', a.style); if (a.open) n.setAttribute('open', ''); if (a.disabled) n.disabled = true; parent.appendChild(n); made.push(n); parent = n; }
    for (let k = 0; k < (i.idx ?? 0); k++) parent.appendChild(document.createElement('span'));
    const e = document.createElement(i.tag === 'svg' ? 'span' : i.tag); if (i.type) e.setAttribute('type', i.type); e.className = i.cls; if (i.style) e.setAttribute('style', i.style); if (i.open) e.setAttribute('open', ''); parent.appendChild(e); if (i.disabled) e.disabled = true; if (i.focused) { e.tabIndex = 0; e.focus(); }
    const cs = getComputedStyle(e); const out = Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)])); (made[0] ?? e).remove(); return out;
  }), [items, PROPS]);
}

const STATE_PROPS = [...PROPS, 'outline-style', 'outline-color', 'outline-width', 'outline-offset', 'text-decoration-line']; // cursor is not compared: the host shows pointers on buttons/links
const describe = (el, rootClass) => {
  const index = x => { let n = 0; for (let y = x.previousElementSibling; y; y = y.previousElementSibling) n++; return n; };
  const chain = []; for (let a = el.parentElement; a && !a.classList.contains(rootClass); a = a.parentElement) chain.unshift({tag: a.tagName.toLowerCase(), cls: a.getAttribute('class') ?? '', idx: index(a)});
  return {idx: index(el), chain, tag: el.tagName.toLowerCase(), type: el.getAttribute('type'), cls: el.getAttribute('class'), disabled: el.disabled === true};
};

/** Computed values of `selector`'s first match while hovered/focused, in the module and on the original-CSS page. */
export async function stateValues(page, ref, selector, state) {
  await page.addStyleTag({content: '*{transition:none!important;animation:none!important}'});
  await ref.addStyleTag({content: '*{transition:none!important;animation:none!important}'});
  await page.evaluate(() => document.activeElement?.blur());
  const locator = page.locator(selector).first();
  await locator.scrollIntoViewIfNeeded();
  const info = await locator.evaluate(describe, ROOT);
  await page.mouse.move(0, 0);
  await page.keyboard.press('Shift'); // keyboard modality so programmatic focus matches :focus-visible, as on the oracle page
  if (state === 'hover') await locator.hover(); else await locator.focus();
  const got = await locator.evaluate((el, props) => { const cs = getComputedStyle(el); return Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)])); }, STATE_PROPS);
  await page.mouse.move(0, 0);
  await ref.bringToFront();
  await ref.mouse.move(0, 0);
  await ref.evaluate(() => document.activeElement?.blur());
  await ref.evaluate(i => {
    document.getElementById('probe-root')?.remove();
    const root = document.createElement('div'); root.id = 'probe-root'; document.body.appendChild(root);
    let parent = root; for (const a of i.chain) { const n = document.createElement(['svg', 'path'].includes(a.tag) ? 'span' : a.tag); for (let k = 0; k < (a.idx ?? 0); k++) parent.appendChild(document.createElement('span')); n.className = a.cls; parent.appendChild(n); parent = n; }
    for (let k = 0; k < (i.idx ?? 0); k++) parent.appendChild(document.createElement('span'));
    const e = document.createElement(i.tag); if (i.type) e.setAttribute('type', i.type); e.className = i.cls; e.id = 'probe'; if (i.tag === 'a') e.setAttribute('href', '#'); if (i.tag === 'tr') { const td = document.createElement('td'); td.textContent = 'x'; e.appendChild(td); } else e.textContent = 'x'; if (i.disabled) e.disabled = true; parent.appendChild(e);
  }, info);
  const probe = ref.locator('#probe');
  await ref.keyboard.press('Shift');
  if (state === 'hover') await probe.hover(); else await probe.focus();
  const source = await probe.evaluate((el, props) => { const cs = getComputedStyle(el); return Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)])); }, STATE_PROPS);
  await page.bringToFront();
  return {got, source, props: STATE_PROPS};
}
