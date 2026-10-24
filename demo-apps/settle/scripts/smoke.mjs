// Chromium workflows against the production Next server, the unchanged host demo API and the
// unchanged Settle API (started by scripts/integration.mjs). No response is intercepted or mocked.
import {chromium} from 'playwright';
import {readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url), base = process.env.SETTLE_BASE ?? 'http://localhost:3380', directApi = process.env.SETTLE_DIRECT_API;
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local demo checks only');
// The fixture sign-in is read from the unchanged API source and never printed or stored.
const fixtureSource = readFileSync(new URL('../../../dummy-api/server.mjs', import.meta.url), 'utf8');
const credential = fixtureSource.match(/username:\s*"admin",\s*password:\s*"([^"]+)"/)[1];
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
const page = await context.newPage();
const flows = [], checks = [], errors = [], httpErrors = [], consoleErrors = [];
let current = 'login';
page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
page.on('pageerror', e => errors.push({route: current, message: e.message}));
page.on('console', e => {if (e.type() === 'error') consoleErrors.push({route: current, message: e.text().slice(0, 300)});});
const expected4xx = new Set();
page.on('response', r => {const u = new URL(r.url()); if ((u.pathname.startsWith('/api/') || u.pathname.startsWith('/settle-api/')) && !u.pathname.includes('/auth/') && r.status() >= 400 && !expected4xx.has(u.pathname)) httpErrors.push({route: current, path: u.pathname, status: r.status()});});
const settled = async () => {
  await page.locator('[data-page-id]').first().waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-skeleton],main [aria-busy="true"]'));
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity));
};
let deskUser = 'Priya Nair';
async function visit(path) {current = path; await page.goto(base + path); await settled(); if (path !== '/preferences') await page.getByText(deskUser, {exact: true}).first().waitFor();}
const response = (pattern, method) => page.waitForResponse(r => pattern.test(new URL(r.url()).pathname) && r.request().method() === method);
async function expectOk(promise, label) {const r = await promise; if (!r.ok()) throw new Error(label + ' failed with ' + r.status()); return r;}
let payBody = null;
async function step(name, fn) {try {await fn();} catch (error) {errors.push({route: current, step: name, message: error.message}); process.exitCode = 1; await page.keyboard.press('Escape').catch(() => {});}}
const flow = (id, result, extra = {}) => {flows.push({id, scope: 'UI', result, ...extra}); console.log(JSON.stringify({flow: id}));};

try {
  // Sign in through the shared host login against the demo API.
  await page.goto(base + '/');
  await page.locator('input[autocomplete=username]').fill('admin');
  await page.locator('input[type=password]').fill(credential);
  await page.getByRole('button', {name: /sign in/i}).click();
  await settled(); await page.getByText('Needs your attention').waitFor();
  flow('SET-01', 'Fixture sign-in, shared provider chain and the Settle desk against both APIs');

  // Host preference through the single update path.
  await visit('/preferences');
  const prefSave = response(/\/api\/preferences$/, 'PUT');
  await page.getByRole('combobox', {name: 'Column layout is saved'}).selectOption('account');
  await expectOk(prefSave, 'Preference update');
  flow('SET-02', 'Host preference saved through the shared preferences page');

  await step('desk', async () => {
    // Desk queue and figures as filters.
    await visit('/');
    await page.getByRole('link', {name: /approvals? waiting/}).click(); await page.waitForURL(/\/approvals/); await settled();
    await visit('/bills');
    await page.getByRole('button', {name: /Overpaid, needs action/}).click(); await page.waitForURL(/due=overpaid/); await settled();
    await page.locator('tbody tr').first().waitFor();
    await page.getByRole('textbox', {name: 'Search bills'}).fill('BL002001'); await page.waitForURL(/q=BL002001/); await settled();
    await page.getByRole('link', {name: 'BL002001'}).click(); await page.waitForURL(/\/bills\/BL002001$/); await settled();
    flow('SET-03', 'Desk queue link, bills figure filter, search and row deep link');

  });
  await step('bill', async () => {
    // BL002001: pending lab result blocks finalize; mark ready, finalize; excess becomes a deposit.
    if (await page.getByRole('button', {name: /Finalize/}).isEnabled()) throw new Error('Finalize should be blocked by the pending result');
    await page.getByRole('button', {name: 'Edit Blood culture & sensitivity'}).click();
    const ready = response(/\/settle-api\/charges\/\d+\/result-ready$/, 'POST');
    await page.getByRole('button', {name: 'Mark result ready'}).click(); await expectOk(ready, 'Result ready');
    const finalize = page.getByRole('button', {name: /Finalize/});
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => /Finalize/.test(b.textContent ?? '') && !b.disabled));
    const finalized = response(/\/settle-api\/bills\/BL002001\/finalize$/, 'POST');
    await finalize.click();
    const finalBody = await (await expectOk(finalized, 'Finalize')).json();
    if (!finalBody.result?.overpayment?.deposit) throw new Error('Overpayment was not moved to a deposit');
    await page.getByText('Finalized', {exact: true}).first().waitFor();
    flow('SET-04', 'Pending result gate, mark result ready and finalize; overpayment moved to deposit', {deposit: finalBody.result.overpayment.deposit});
    await visit('/print/bill/BL002001'); await page.getByText('Final bill (insured)').first().waitFor();
    flow('SET-05', 'Final insured bill print preview');

  });
  await step('billnow', async () => {
    // BN001002: A shortcut, type a test, Enter; collect and close.
    await visit('/bills/BN001002');
    await page.keyboard.press('a');
    const add = page.getByRole('combobox', {name: 'Add a charge'});
    await add.fill('Lipid'); await page.getByRole('option', {name: /Lipid profile/}).waitFor();
    const charged = response(/\/settle-api\/bills\/BN001002\/charges$/, 'POST');
    await add.press('Enter'); await expectOk(charged, 'Add charge');
    await page.getByText('Lipid profile').first().waitFor();
    const paid = response(/\/settle-api\/bills\/BN001002\/payments$/, 'POST');
    await page.getByRole('button', {name: /and close bill/}).click();
    payBody = await (await expectOk(paid, 'Collect and close')).json();
    if (payBody.bill.status !== 'C') throw new Error('Bill Now bill did not close');
    await page.getByText(/Receipt .* recorded/).waitFor();
    flow('SET-06', 'Keyboard charge entry and collect-and-close on a Bill Now bill', {receipt: payBody.result?.receipts?.[0]});
    const [receiptTab] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', {name: 'Print receipt'}).click()]);
    await receiptTab.waitForLoadState(); await receiptTab.getByText('Payment receipt').first().waitFor(); await receiptTab.close();
    flow('SET-07', 'Receipt print opens in a new browser context with the same session');

  });
  await step('card', async () => {
    // Card deposit through the demo terminal on patient MR240107.
    await visit('/patients/MR240107');
    await page.getByRole('button', {name: 'Collect deposit'}).first().click();
    const dialog = page.getByRole('dialog', {name: 'Collect deposit'});
    await dialog.getByRole('textbox', {name: 'Amount'}).fill('2500');
    await dialog.getByRole('button', {name: /Credit card/}).click();
    const deposit = response(/\/settle-api\/patients\/MR240107\/deposits$/, 'POST');
    await dialog.getByRole('button', {name: /^Collect /}).click();
    const depositBody = await (await expectOk(deposit, 'Card deposit')).json();
    if (!depositBody.cardTxn) throw new Error('Card deposit did not wait for the terminal');
    const terminal = page.getByRole('dialog', {name: /Card terminal/});
    const approved = response(/\/settle-api\/card-txns\/[^/]+\/approve$/, 'POST');
    await terminal.getByRole('button', {name: 'Simulate approval'}).click(); await expectOk(approved, 'Terminal approval');
    await page.getByText(/recorded$/).first().waitFor();
    flow('SET-08', 'Card deposit waits for the terminal; approval records the deposit');

  });
  await step('approvals', async () => {
    // Approvals: approve the write-off and the bill closes.
    await visit('/approvals');
    await page.getByRole('button', {name: /Write-off/}).first().click(); await settled();
    const decided = response(/\/settle-api\/approvals\/\d+\/decide$/, 'POST');
    await page.getByRole('button', {name: 'Approve', exact: true}).click(); await expectOk(decided, 'Approve write-off');
    flow('SET-09', 'Write-off approved through the approvals queue');

  });
  await step('receipts', async () => {
    // Receipts: realize a cheque, open a receipt drawer.
    await visit('/receipts?unrealized=1&kind=deposit');
    await page.getByRole('checkbox', {name: /^Select (?!all)/}).first().check();
    const realized = response(/\/settle-api\/deposits\/realize$/, 'POST');
    await page.getByRole('button', {name: 'Realize', exact: true}).click(); await expectOk(realized, 'Realize cheque');
    await visit('/receipts');
    await page.locator('tbody tr').first().click(); await page.getByRole('dialog').first().waitFor();
    flow('SET-10', 'Cheque realization and receipt detail drawer');

  });
  await step('dayclose', async () => {
    // Day close: count the OPD counter and close it.
    await visit('/day-close');
    await page.getByRole('button', {name: /OPD counter/}).first().click();
    const expectedText = await page.getByText('Expected cash').first().locator('xpath=following-sibling::dd').textContent();
    const expectedCash = Number((expectedText ?? '').replace(/[^0-9.]/g, ''));
    await page.getByRole('textbox', {name: 'Coins total'}).fill(String(expectedCash));
    const closed = response(/\/settle-api\/daybook\/close$/, 'POST');
    await page.getByRole('button', {name: 'Close OPD counter'}).click(); await expectOk(closed, 'Close counter');
    flow('SET-11', 'Cash count matching expected cash closes the counter');

  });
  await step('reports', async () => {
    // Reports, audit, settings.
    await visit('/reports?r=finance-postings'); await page.locator('tbody tr').first().waitFor();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', {name: /^(CSV|XLSX)$/}).click()]);
    if (!/finance-postings-.*\.(csv|xlsx)$/.test(download.suggestedFilename())) throw new Error('Report export name');
    flow('SET-12', 'Finance postings report and export in the effective format');
    await visit('/audit'); await page.getByRole('textbox', {name: 'Search audit'}).fill('BL002001');
    await page.waitForResponse(r => r.url().includes('/settle-api/audit') && r.url().includes('q=BL002001')); await settled();
    flow('SET-13', 'Audit trail server search');
    await visit('/settings?s=preferences');
    await page.getByRole('switch', {name: 'Allow insurance on Bill Now bills'}).click();
    const settingsSaved = response(/\/settle-api\/settings\/preferences$/, 'PATCH');
    await page.getByRole('button', {name: 'Save preferences'}).click(); await expectOk(settingsSaved, 'Settle settings');
    flow('SET-14', 'Settle billing setting saved through the Settle API');

  });
  await step('newbill', async () => {
    // New bill from the desk bar.
    await visit('/patients');
    await page.getByRole('button', {name: 'New bill'}).first().click();
    const newBill = page.getByRole('dialog', {name: 'New bill'});
    await newBill.getByRole('textbox', {name: 'Find patient'}).fill('MR240107');
    await newBill.getByRole('button', {name: /MR240107/}).click();
    await newBill.getByRole('button', {name: /Bill Later/}).click();
    const created = response(/\/settle-api\/bills$/, 'POST');
    await newBill.getByRole('button', {name: 'Create bill'}).click();
    const createdBody = await (await expectOk(created, 'Create bill')).json();
    await page.waitForURL(new RegExp('/bills/' + createdBody.bill.bill_no + '$')); await settled();
    flow('SET-15', 'New bill for an existing patient and visit opens its workspace', {bill: createdBody.bill.bill_no});
    const billNo = createdBody.bill.bill_no;
    await page.getByRole('radio', {name: 'Advance', exact: true}).click();
    await page.getByRole('textbox', {name: 'Payment amount'}).fill('250');
    const advance = response(/\/settle-api\/bills\/[^/]+\/payments$/, 'POST');
    await page.getByRole('button', {name: /^Collect /}).click();
    const advanceBody = await (await expectOk(advance, 'Advance')).json();
    const advanceNo = advanceBody.result.receipts[0];
    if (advanceBody.bill.advance_balance !== 250) throw new Error('Advance balance was not recorded');
    await page.getByText('Receipt ' + advanceNo + ' recorded').waitFor();
    flow('SET-17', 'Collect an advance on the new Bill Later bill', {receipt: advanceNo});

    await page.getByRole('radio', {name: 'Refund', exact: true}).click();
    await page.getByRole('textbox', {name: 'Refund amount'}).fill('50');
    const refund = response(/\/settle-api\/bills\/[^/]+\/payments$/, 'POST');
    await page.getByRole('button', {name: /^Refund /}).click();
    const refundBody = await (await expectOk(refund, 'Advance refund')).json();
    if (refundBody.bill.advance_balance !== 200) throw new Error('Refund did not reduce the advance balance');
    await page.getByText('Receipt ' + refundBody.result.receipts[0] + ' recorded').waitFor();
    flow('SET-18', 'Refund part of an advance and refresh the bill balance');

    await visit('/receipts?open=' + advanceNo);
    const receipt = page.getByRole('dialog', {name: advanceNo});
    await receipt.getByRole('button', {name: 'Edit', exact: true}).click();
    await receipt.getByRole('textbox', {name: 'Remarks'}).fill('Fictional advance edit');
    const edited = response(/\/settle-api\/receipts\/[^/]+$/, 'PATCH');
    const receiptReloaded = response(/\/settle-api\/receipts\/[^/]+$/, 'GET');
    await receipt.getByRole('button', {name: 'Save changes'}).click();
    await expectOk(edited, 'Edit advance receipt');
    const editedReceipt = await (await expectOk(receiptReloaded, 'Reload edited receipt')).json();
    if (editedReceipt.raw.recpt_type !== 'U') throw new Error('Receipt edit changed advance classification');
    await receipt.getByText('Fictional advance edit', {exact: true}).waitFor();
    flow('SET-19', 'Edit the advance receipt without changing its advance classification');

    await visit('/bills/' + billNo);
    const charge = page.getByRole('combobox', {name: 'Add a charge'});
    await charge.fill('Lipid'); await page.getByRole('option', {name: /Lipid profile/}).waitFor();
    const charged = response(/\/settle-api\/bills\/[^/]+\/charges$/, 'POST');
    await charge.press('Enter'); await expectOk(charged, 'Charge before set-off');
    await page.getByRole('textbox', {name: 'Deposit set-off amount'}).fill('100');
    const setoff = response(/\/settle-api\/bills\/[^/]+\/deposit-setoff$/, 'POST');
    await page.getByRole('button', {name: 'Set off', exact: true}).click();
    await expectOk(setoff, 'Deposit set-off');
    const remove = page.getByRole('button', {name: /^Remove set-off from/}).first();
    await remove.waitFor();
    const released = response(/\/settle-api\/bills\/[^/]+\/deposit-setoff\/\d+$/, 'DELETE');
    await remove.click(); await expectOk(released, 'Release deposit set-off');
    flow('SET-20', 'Apply a patient deposit to the bill and release the allocation');


  });
  await step('rights', async () => {
    // Rights: the desk user switch narrows the UI and the Settle server enforces the same right.
    await page.getByRole('button', {name: /Desk user/}).click();
    await page.getByRole('menuitem', {name: /Anita Das/}).click();
    deskUser = 'Anita Das';
    await page.getByText('Anita Das', {exact: true}).first().waitFor();
    await visit('/settings'); await page.getByText(/Changing them needs the “Manage settings” right/).waitFor();
    if (directApi) {
      const denied = await fetch(directApi + '/settings/preferences', {method: 'PATCH', headers: {'content-type': 'application/json', 'x-user-id': '3'}, body: JSON.stringify({allow_bill_now_insurance: true})});
      if (denied.status !== 403) throw new Error('Settle server did not deny the cashier settings change');
      flows.push({id: 'SET-16', scope: 'direct HTTP', result: 'Cashier desk user is read-only in the UI and the Settle API returns 403 for the same change', status: denied.status});
    }
    await page.getByRole('button', {name: /Desk user/}).click(); await page.getByRole('menuitem', {name: /Priya Nair/}).click();
    deskUser = 'Priya Nair';
    await page.getByText('Priya Nair', {exact: true}).first().waitFor();

  });
  await step('axe', async () => {
    // Every route: browser axe with every rule (including colour contrast).
    const routes = ['/', '/bills', '/bills/BL002001', '/bills/BN001003', '/patients', '/patients/MR240107', '/receipts', '/receipts?unrealized=1&kind=deposit', '/approvals', '/day-close',
      ...['collections', 'payment-consolidated', 'patient-dues', 'sponsor-dues', 'outstanding-deposits', 'reward-points', 'finance-postings'].map(r => '/reports?r=' + r),
      '/audit', ...['payment-modes', 'counters', 'number-series', 'discount-categories', 'rate-plans', 'users', 'preferences'].map(s => '/settings?s=' + s),
      '/print/bill/BL002001', '/print/bill/BL002001?detail=1', '/print/receipt/' + (payBody?.result?.receipts?.[0] ?? 'RC010013'), '/preferences'];
    for (const path of routes) await step('axe ' + path, async () => {
      await visit(path);
      await page.addScriptTag({path: require.resolve('axe-core/axe.min.js')});
      const axe = await page.evaluate(() => window.axe.run(document, {rules: {}}));
      checks.push({path, violations: axe.violations.map(v => ({id: v.id, targets: v.nodes.map(n => n.target), summary: v.nodes[0]?.failureSummary?.slice(0, 300)})), incomplete: axe.incomplete.length});
    });
  });
  if (process.env.SETTLE_SCREENSHOT) await step('screenshot', async () => {await visit('/bills/BL002001'); await page.screenshot({path: process.env.SETTLE_SCREENSHOT, fullPage: false});});
} catch (error) {
  errors.push({route: current, message: error.message}); process.exitCode = 1;
} finally {
  await browser.close();
  const result = {scope: 'Local production Next server, unchanged host demo API and unchanged Settle API', flows, checks, errors, consoleErrors, httpErrors};
  writeFileSync(process.env.SETTLE_RESULT ?? '/tmp/settle-browser.json', JSON.stringify(result, null, 2) + '\n');
  if (errors.length || consoleErrors.length || httpErrors.length || checks.some(c => c.violations.length)) process.exitCode = 1;
  console.log(JSON.stringify({workflows: flows.length, routes: checks.length, errors: errors.length, consoleErrors: consoleErrors.length, httpErrors: httpErrors.length, violations: checks.reduce((n, c) => n + c.violations.length, 0)}));
}
