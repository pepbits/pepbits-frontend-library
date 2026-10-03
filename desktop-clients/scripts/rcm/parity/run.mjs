/**
 * Real-browser parity suite: prints readable results, or `{ checks: [{name, failures: []}] }` with --json.
 *   node scripts/rcm/parity/run.mjs [--json]     (Node 24, from desktop-clients; Chromium from the diagnostics browser install:
 *   FONTCONFIG_FILE, LD_LIBRARY_PATH, PLAYWRIGHT_BROWSERS_PATH as for the MedBand harness)
 * Wrapped by packages/reference-rcm/src/browser-parity.test.ts (opt-in, RCM_BROWSER_PARITY=1; child process because jsdom cannot host esbuild/Playwright).
 */
import {resolve} from 'node:path';
import {ROUTES, diffs, launch, mount, oracle, same, snapshot, stateValues} from './measure.mjs';
import {build} from './build.mjs';
import {SCENARIOS} from './scenarios.mjs';

const view = {width: 1440, height: 1000};
const checks = [];
const check = async (name, fn) => { try { checks.push({name, failures: await fn()}); } catch (error) { checks.push({name, failures: ['ERROR ' + String(error).split('\n')[0]]}); } };

const dir = await build(resolve('/tmp', `rcm-parity-${process.pid}`));
const browser = await launch();
const page = await browser.newPage({viewport: view}), ref = await browser.newPage({viewport: view});
page.setDefaultTimeout(6000);
await ref.goto(`file://${dir}/oracle.html`); await page.goto(`file://${dir}/index.html`);

const compare = async (route, run, minimum = 25) => {
  const items = await snapshot(page, route, {}, run);
  if (items.length < minimum) return [`${route}: only ${items.length} elements rendered`];
  const unique = [...new Map(items.map(i => [i.chain.map(c => c.cls).join('>') + i.tag + i.type + i.cls + i.focused + i.disabled, i])).values()];
  return [...diffs(unique, await oracle(ref, unique))].map(([key, list]) => `${key.slice(0, 140)}\n  ${list.join('\n  ')}`);
};
const probe = (selector, props) => page.evaluate(([s, p]) => { const el = document.querySelector(s); const cs = getComputedStyle(el); return Object.fromEntries(p.map(n => [n, cs.getPropertyValue(n)])); }, [selector, props]);
const expectEqual = (failures, label, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${label}: got ${JSON.stringify(got)} | want ${JSON.stringify(want)}`); };

for (const route of ROUTES) await check(`page ${route}: every element's colour, border, radius, spacing, type, shadow and fixed size equals the original's`, () => compare(route));
for (const scenario of SCENARIOS) await check(`open state: ${scenario.name}`, () => compare(scenario.route, scenario.run, 10));

await check('the module sits under the host global utilities (.library-preferences) and still has the original geometry', async () => {
  await mount(page, '/w/coverages?new=1');
  const got = await page.evaluate(() => {
    const host = document.querySelector('.library-preferences'), input = document.querySelector('[role="dialog"] input.input'), btn = document.querySelector('[role="dialog"] button.btn-primary');
    const i = getComputedStyle(input), b = getComputedStyle(btn);
    return {hosted: !!host, inputRadius: i.borderTopLeftRadius, inputHeight: i.height, inputSize: i.fontSize, btnRadius: b.borderTopLeftRadius, btnHeight: b.height, btnSize: b.fontSize};
  });
  const failures = [];
  expectEqual(failures, 'geometry', got, {hosted: true, inputRadius: '8px', inputHeight: '36px', inputSize: '13px', btnRadius: '8px', btnHeight: '36px', btnSize: '13px'});
  return failures;
});

await check('reference skin by default (original palette, Public Sans / Bricolage Grotesque, 13.5px base), not the host blue or Inter', async () => {
  await mount(page, '/');
  const got = await page.evaluate(() => {
    const root = document.querySelector('.reference-rcm'), h = document.querySelector('.reference-rcm h2'), tile = document.querySelector('.reference-rcm .bg-harbor-900');
    const r = getComputedStyle(root), t = getComputedStyle(tile), hh = getComputedStyle(h);
    return {rootBg: r.backgroundColor, rootColor: r.color, rootFont: r.fontFamily, rootSize: r.fontSize, headingFont: hh.fontFamily, bandBg: t.backgroundColor};
  });
  const failures = [];
  expectEqual(failures, 'default skin', got, {rootBg: 'rgb(237, 240, 244)', rootColor: 'rgb(10, 26, 46)', rootFont: '"Public Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif', rootSize: '13.5px', headingFont: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif', bandBg: 'rgb(16, 36, 62)'});
  return failures;
});

await check('hover and focus states equal the original\'s (buttons, chips, inputs, selects, textarea, rows, links)', async () => {
  const failures = [];
  const run = async (selector, state) => {
    if (!(await page.locator(selector).count())) { failures.push(`missing ${selector}`); return; }
    const {got, source, props} = await stateValues(page, ref, selector, state).catch(error => { failures.push(`${state} ${selector}: ${String(error).split('\n')[0]}`); return {got: {}, source: {}, props: []}; });
    for (const p of props) if (!same(got[p], source[p]) && !/^(width|height|min-height)$/.test(p)) failures.push(`${state} ${selector} ${p}: got ${got[p]} | source ${source[p]}`);
  };
  await mount(page, '/w/coverages');
  for (const [s, st] of [['button.btn-primary', 'hover'], ['button.btn-primary', 'focus'], ['input.input', 'hover'], ['input.input', 'focus'], ['tbody tr', 'hover'], ['button.rounded-lg.px-2\\.5', 'hover'], ['button.rounded-lg.px-2\\.5', 'focus']]) await run(s, st);
  await mount(page, '/w/coverages?new=1');
  for (const [s, st] of [['input.input >> nth=1', 'focus'], ['select.input', 'focus'], ['select.input', 'hover'], ['button.btn-quiet', 'hover']]) await run(s, st);
  await mount(page, '/');
  for (const [s, st] of [['a.group', 'hover'], ['a.group', 'focus']]) await run(s, st);
  return failures;
});

await check('a non-default theme re-expresses the neutrals on the host tokens; brand colours stay the original\'s', async () => {
  await mount(page, '/w/invoices', {theme: 'midnight'});
  const host = await page.evaluate(() => { const root = document.querySelector('.reference-rcm'); const t = document.createElement('i'); t.style.cssText = 'background:var(--bg);color:var(--text)'; root.appendChild(t); const cs = getComputedStyle(t); const out = {bg: cs.backgroundColor, text: cs.color}; t.remove(); return out; });
  const root = await probe('.reference-rcm', ['background-color', 'color']);
  const failures = [];
  expectEqual(failures, 'root background = host --bg', root['background-color'], host.bg);
  expectEqual(failures, 'root colour = host --text', root.color, host.text);
  expectEqual(failures, 'brand button stays navy', (await probe('.reference-rcm button.btn-primary', ['background-color']))['background-color'], 'rgb(16, 36, 62)');
  return failures;
});
await check('corner radius follows the preference (source 8px at the default 14; 0; scaled at 20)', async () => {
  const failures = [];
  for (const [radius, want] of [[14, '8px'], [0, '0px'], [20, '11.4286px']]) {
    await mount(page, '/w/coverages', {cornerRadius: radius});
    expectEqual(failures, `cornerRadius ${radius}`, (await probe('.reference-rcm input.input', ['border-top-left-radius']))['border-top-left-radius'].replace(/(\.\d{4})\d+/, '$1'), want);
  }
  return failures;
});
await check('font scales: shell scales the base, form the controls, result the tables', async () => {
  await mount(page, '/w/coverages', {fontSizeBase: 26, fontSizeForm: 26, fontSizeResult: 26});
  const failures = [];
  expectEqual(failures, 'base', (await probe('.reference-rcm', ['font-size']))['font-size'], '27px');
  expectEqual(failures, 'input', (await probe('.reference-rcm input.input', ['font-size']))['font-size'], '26px');
  expectEqual(failures, 'table', (await probe('.reference-rcm table', ['font-size']))['font-size'], '25px');
  return failures;
});
await check('a non-default font preference uses the host font; the default keeps Public Sans and Bricolage', async () => {
  const failures = [];
  await mount(page, '/', {fontFamily: 'plex'});
  if (!/^Inter/.test((await probe('.reference-rcm', ['font-family']))['font-family'])) failures.push('host font not applied for a non-default font preference');
  if (!/^Inter/.test((await probe('.reference-rcm h2', ['font-family']))['font-family'])) failures.push('host font not applied to headings');
  await mount(page, '/');
  if (!/^"Public Sans"/.test((await probe('.reference-rcm', ['font-family']))['font-family'])) failures.push('Public Sans lost by default');
  if (!/^"Bricolage Grotesque"/.test((await probe('.reference-rcm h2', ['font-family']))['font-family'])) failures.push('Bricolage lost by default');
  return failures;
});
await check('managed table density/wrapping/sticky apply when not at their defaults; the defaults give the source cells', async () => {
  const failures = [];
  await mount(page, '/w/invoices');
  expectEqual(failures, 'default cell (ledger py-1.5)', await probe('tbody td', ['padding-top', 'white-space']), {'padding-top': '6px', 'white-space': 'normal'});
  expectEqual(failures, 'default amount cell (whitespace-nowrap)', (await probe('tbody td.whitespace-nowrap', ['white-space']))['white-space'], 'nowrap');
  await mount(page, '/w/invoices', {density: 'compact'}); expectEqual(failures, 'compact', (await probe('tbody td', ['padding-top']))['padding-top'], '4px');
  await mount(page, '/w/invoices', {density: 'spacious'}); expectEqual(failures, 'spacious', (await probe('tbody td', ['padding-top']))['padding-top'], '16px');
  await mount(page, '/w/invoices', {wrapCellText: true}); expectEqual(failures, 'wrap', (await probe('tbody td', ['white-space']))['white-space'], 'normal');
  await mount(page, '/w/invoices', {stickyTableHeader: false}); expectEqual(failures, 'not sticky', (await probe('thead', ['position']))['position'], 'static');
  return failures;
});

await browser.close();
if (process.argv.includes('--json')) console.log(JSON.stringify({checks}));
else { for (const c of checks) console.log(`${c.failures.length ? 'FAIL' : 'ok  '} ${c.name}${c.failures.length ? '\n  ' + c.failures.join('\n  ') : ''}`); }
process.exit(checks.some(c => c.failures.length) ? 1 : 0);
