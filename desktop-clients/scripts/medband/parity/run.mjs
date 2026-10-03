/**
 * Runs the whole real-browser parity suite and prints one JSON object { checks: [{name, failures: []}] } (or a readable report).
 *   node scripts/medband/parity/run.mjs [--json]     (Node 24, from desktop-clients; Chromium from the diagnostics browser install)
 * Wrapped by packages/reference-medband/src/browser-parity.test.ts (opt-in with MEDBAND_BROWSER_PARITY=1), which runs it in a child
 * process because vitest's jsdom environment cannot host esbuild/Playwright.
 */
import {resolve} from 'node:path';
import {ADAPTED, ROUTES, diffs, launch, mount, oracle, snapshot, stateValues} from './measure.mjs';
import {build} from './build.mjs';
import {SCENARIOS} from './scenarios.mjs';

const view = {width: 1440, height: 1000};
const checks = [];
const check = async (name, fn) => { try { checks.push({name, failures: await fn()}); } catch (error) { checks.push({name, failures: ['ERROR ' + String(error).split('\n')[0]]}); } };

const dir = await build(resolve('/tmp', `medband-parity-${process.pid}`));
const browser = await launch();
const page = await browser.newPage({viewport: view}), ref = await browser.newPage({viewport: view});
page.setDefaultTimeout(6000);
await ref.goto(`file://${dir}/oracle.html`); await page.goto(`file://${dir}/index.html`);

const compare = async (route, run) => {
  const items = await snapshot(page, route, {}, run);
  if (items.length < 40) return [`${route}: only ${items.length} elements rendered`];
  const unique = [...new Map(items.map(i => [i.chain.map(c => c.cls).join('>') + i.tag + i.type + i.cls + i.focused + i.disabled, i])).values()];
  return [...diffs(unique, await oracle(ref, unique), ADAPTED)].map(([key, list]) => `${key.slice(0, 120)}\n  ${list.join('\n  ')}`);
};
const probe = (selector, props) => page.evaluate(([s, p]) => { const el = document.querySelector(s); const cs = getComputedStyle(el); return Object.fromEntries(p.map(n => [n, cs.getPropertyValue(n)])); }, [selector, props]);
const expectEqual = (failures, label, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${label}: got ${JSON.stringify(got)} | want ${JSON.stringify(want)}`); };

for (const route of ROUTES) await check(`page ${route}: every element's colour, border, radius, spacing, type and fixed size equals the original's`, () => compare(route));
for (const scenario of SCENARIOS) await check(`open state: ${scenario.name}`, () => compare(scenario.route, scenario.run));

await check('reference skin by default (teal, Public Sans, 16px, source control geometry), not the host blue', async () => {
  await mount(page, '/patients/new');
  const got = await page.evaluate(() => {
    const root = document.querySelector('.reference-medband'), next = document.querySelector('.reference-medband a.bg-scrub-700'), input = document.querySelectorAll('.reference-medband input.rounded-lg')[1];
    const r = getComputedStyle(root), n = getComputedStyle(next), i = getComputedStyle(input);
    return {rootBg: r.backgroundColor, rootColor: r.color, rootFont: r.fontFamily, rootSize: r.fontSize, nextBg: n.backgroundColor, inputBorder: i.borderTopColor, inputRadius: i.borderTopLeftRadius, inputHeight: i.height, inputSize: i.fontSize};
  });
  const failures = [];
  expectEqual(failures, 'default skin', got, {rootBg: 'rgb(233, 238, 236)', rootColor: 'rgb(21, 35, 43)', rootFont: '"Public Sans Variable", "Segoe UI", system-ui, -apple-system, sans-serif', rootSize: '16px', nextBg: 'rgb(14, 76, 88)', inputBorder: 'rgb(213, 222, 219)', inputRadius: '8px', inputHeight: '40px', inputSize: '14px'});
  return failures;
});

await check('hover and focus states equal the original\'s (buttons, segments, inputs, selects, textarea, table rows, toolbar)', async () => {
  const failures = [];
  const run = async (selector, state) => {
    if (!(await page.locator(selector).count())) { failures.push(`missing ${selector}`); return; }
    const {got, source, props} = await stateValues(page, ref, selector, state).catch(error => { failures.push(`${state} ${selector}: ${String(error).split('\n')[0]}`); return {got: {}, source: {}, props: []}; });
    for (const p of props) if (got[p] !== source[p] && !/^(width|height|min-height)$/.test(p)) failures.push(`${state} ${selector} ${p}: got ${got[p]} | source ${source[p]}`);
  };
  await mount(page, '/patients/new');
  for (const [s, st] of [['a.bg-scrub-700', 'hover'], ['a.border', 'hover'], ['button.bg-scrub-700', 'hover'], ['button[role="radio"][aria-checked="false"]', 'hover'], ['input.rounded-lg >> nth=1', 'focus'], ['select.rounded-lg', 'focus'], ['input.rounded-lg >> nth=1', 'hover'], ['a.bg-scrub-700', 'focus'], ['button[role="radio"]', 'focus']]) await run(s, st);
  await mount(page, '/encounters');
  for (const [s, st] of [['tbody tr', 'hover'], ['button.bg-canvas', 'hover']]) await run(s, st);
  return failures;
});

const prefs = {};
await check('a non-default theme re-expresses the skin on the host tokens', async () => {
  await mount(page, '/patients/new', {theme: 'midnight'});
  const host = await page.evaluate(() => { const root = document.querySelector('.reference-medband'); const t = document.createElement('i'); t.style.cssText = 'background:var(--bg);color:var(--text)'; root.appendChild(t); const cs = getComputedStyle(t); const out = {bg: cs.backgroundColor, text: cs.color}; t.remove(); return out; });
  const root = await probe('.reference-medband', ['background-color', 'color']);
  const failures = [];
  expectEqual(failures, 'root background = host --bg', root['background-color'], host.bg); expectEqual(failures, 'root colour = host --text', root.color, host.text);
  if (root['background-color'] === 'rgb(233, 238, 236)') failures.push('still the reference canvas under midnight');
  return failures;
});
await check('corner radius follows the preference (source 8px at the default 14; 0; scaled at 20)', async () => {
  const failures = [];
  for (const [radius, want] of [[14, '8px'], [0, '0px'], [20, '11.4286px']]) {
    await mount(page, '/patients/new', {cornerRadius: radius});
    expectEqual(failures, `cornerRadius ${radius}`, (await probe('.reference-medband input.rounded-lg', ['border-top-left-radius']))['border-top-left-radius'].replace(/(\.\d{4})\d+/, '$1'), want);
  }
  return failures;
});
await check('font scales: shell scales the base, form the controls, result the tables', async () => {
  await mount(page, '/encounters', {fontSizeBase: 26, fontSizeForm: 26, fontSizeResult: 26});
  const failures = [];
  expectEqual(failures, 'base', (await probe('.reference-medband', ['font-size']))['font-size'], '32px');
  expectEqual(failures, 'select', (await probe('.reference-medband select.rounded-lg', ['font-size']))['font-size'], '28px');
  expectEqual(failures, 'table', (await probe('.reference-medband table', ['font-size']))['font-size'], '26px');
  return failures;
});
await check('a non-default font preference uses the host font; the default keeps Public Sans', async () => {
  const failures = [];
  await mount(page, '/patients/new', {fontFamily: 'plex'});
  if (!/^Inter/.test((await probe('.reference-medband', ['font-family']))['font-family'])) failures.push('host font not applied for a non-default font preference');
  await mount(page, '/patients/new');
  if (!/^"Public Sans Variable"/.test((await probe('.reference-medband', ['font-family']))['font-family'])) failures.push('Public Sans lost by default');
  return failures;
});
await check('managed table density/wrapping apply when not at their defaults; the defaults give the source cells', async () => {
  const failures = [];
  await mount(page, '/encounters');
  expectEqual(failures, 'default cell', await probe('tbody td', ['padding-top', 'white-space']), {'padding-top': '10px', 'white-space': 'normal'});
  await mount(page, '/encounters', {density: 'compact'}); expectEqual(failures, 'compact', (await probe('tbody td', ['padding-top']))['padding-top'], '4px');
  await mount(page, '/encounters', {density: 'spacious'}); expectEqual(failures, 'spacious', (await probe('tbody td', ['padding-top']))['padding-top'], '16px');
  await mount(page, '/encounters', {wrapCellText: true}); expectEqual(failures, 'wrap', (await probe('tbody td', ['white-space']))['white-space'], 'normal');
  return failures;
});

await browser.close();
if (process.argv.includes('--json')) console.log(JSON.stringify({checks}));
else { for (const c of checks) console.log(`${c.failures.length ? 'FAIL' : 'ok  '} ${c.name}${c.failures.length ? '\n  ' + c.failures.join('\n  ') : ''}`); }
process.exit(checks.some(c => c.failures.length) ? 1 : 0);
