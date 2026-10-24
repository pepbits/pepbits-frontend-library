import {chromium} from 'playwright';
import {readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url), base = process.env.REPORTS_BASE ?? 'http://localhost:3350';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local demo checks only');
// Fixture credentials stay in memory: they are read from the unchanged demo API source and never logged or written.
const fixtureSource = readFileSync(new URL('../../../dummy-api/server.mjs', import.meta.url), 'utf8');
const credential = username => fixtureSource.match(new RegExp(`username:\\s*"${username}",\\s*password:\\s*"([^"]+)"`))[1];
const routesSource = readFileSync(new URL('../src/modules/reports/routes.ts', import.meta.url), 'utf8');
const systemBlock = routesSource.slice(routesSource.indexOf('SYSTEM_REPORT_DESTINATIONS'), routesSource.indexOf('SEEDED_DASHBOARDS'));
const systemReports = [...systemBlock.matchAll(/^\s+\['([a-z0-9-]+)', '[^']+'\],$/gm)].map(match => match[1]);
if (systemReports.length !== 28) throw new Error('Expected 28 system report destinations');
const staticRoutes = ['/', '/reports', '/builder', '/dashboards', '/jobs', '/schedules', '/email-in', '/api-keys', '/admin/access', '/admin/users', '/admin/settings', '/admin/sources', '/admin/audit', '/admin/outbox', '/login'];
const exemplars = [...systemReports.map(id => '/reports/' + id), '/builder/new', '/dashboards/executive-overview', '/dashboards/finance-daily', '/dashboards/clinical-ops', '/preferences'];
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true});
const page = await context.newPage();
const flows = [], checks = [], errors = [], httpErrors = [], consoleErrors = [];
const expectedStatus = new Set();
page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
let current = 'login';
page.on('pageerror', e => errors.push({route: current, message: e.message}));
// Browsers log every 4xx resource load; only failures inside a step that expects one are excluded.
page.on('console', e => {if (e.type() === 'error' && !(expectedStatus.size && /Failed to load resource: the server responded with a status of 4\d\d/.test(e.text()))) consoleErrors.push({route: current, message: e.text().slice(0, 300)});});
page.on('response', r => {const u = new URL(r.url());if (u.pathname.startsWith('/api/') && !u.pathname.includes('/auth/') && r.status() >= 400 && !expectedStatus.has(u.pathname)) httpErrors.push({route: current, path: u.pathname.replace(/\/downloads\/[^/]+$/, '/downloads/<token>'), status: r.status()});});
const settled = () => page.waitForFunction(() => !document.querySelector('main [aria-busy="true"], main .animate-pulse') && document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity));
async function waitData() {
  await page.locator('[data-page-id]').first().waitFor();
  if (new URL(page.url()).pathname === '/preferences') await page.getByRole('heading', {level: 1}).first().waitFor();
  else await page.locator('.lumen-reports h1').first().waitFor();
  await settled();
}
async function visit(path) {current = path;await page.goto(base + path);await waitData();}
async function signIn(username) {
  await page.evaluate(() => localStorage.clear()).catch(() => {});
  await page.goto(base + '/');
  await page.locator('input[autocomplete=username]').fill(username);
  await page.locator('input[type=password]').fill(credential(username));
  await page.getByRole('button', {name: /sign in/i}).click();
  await waitData();
}
const command = (method, path) => page.waitForResponse(r => r.request().method() === method && (typeof path === 'string' ? new URL(r.url()).pathname === '/api/reference-modules/reports' + path : path.test(new URL(r.url()).pathname)));
async function ok(promise, label) {const response = await promise;if (!response.ok()) throw new Error(`${label} failed with ${response.status()}`);return response;}
async function axeCheck(path) {
  await page.addScriptTag({path: require.resolve('axe-core/axe.min.js')});
  await settled();
  const axe = await page.evaluate(() => window.axe.run(document, {rules: {}}));
  checks.push({path, violations: axe.violations.map(v => ({id: v.id, targets: v.nodes.map(n => n.target)})), incomplete: axe.incomplete.length});
}
try {
  await signIn('admin'); flows.push({id: 'RPT-01', scope: 'UI', result: 'Fixture administrator sign-in through the shared shell and API-backed provider chain'});

  // Every source page route and every fixture destination under the full shell, with axe.
  for (const path of [...staticRoutes, ...exemplars]) {
    await visit(path);
    if (path.startsWith('/reports/')) await page.locator('.lumen-reports tbody tr').first().or(page.getByText('This request is too large to show on screen')).first().waitFor();
    await axeCheck(path);
  }
  flows.push({id: 'RPT-routes', scope: 'UI', result: `${checks.length} destinations rendered API data and were scanned with axe`});

  // Preferences: one central write path.
  await visit('/preferences');
  const tabs = await page.getByRole('tab').allTextContents();
  const tabIndex = name => tabs.findIndex(text => text.trim().startsWith(name));
  await page.getByRole('tab').nth(tabIndex('Page')).click();
  const density = page.getByRole('combobox', {name: /Density/}).first();
  {const save = ok(page.waitForResponse(r => new URL(r.url()).pathname === '/api/preferences' && r.request().method() === 'PUT'), 'Preference save');await density.selectOption('compact');await save;flows.push({id: 'RPT-preferences', scope: 'UI', result: 'Density preference saved through the host update path'});}

  // Library: search and favourite.
  await visit('/reports');
  await page.getByLabel('Search reports').fill('payer');
  const favourite = ok(command('POST', '/api/favorites'), 'Favourite');
  await page.getByRole('button', {name: /Payer mix to favorites|Payer mix from favorites/}).click();await favourite;
  flows.push({id: 'RPT-library', scope: 'UI', result: 'Catalogue search and favourite toggle through HTTP'});

  // Viewer: run, sort, page, columns, saved view, export, background run, schedule, email and print.
  await visit('/reports/revenue-transactions');
  await page.locator('.lumen-reports tbody tr').first().waitFor();
  let run = ok(command('POST', '/api/reports/revenue-transactions/run'), 'Sorted run');
  await page.locator('.lumen-reports thead th button').first().click();await run;
  const next = page.getByRole('button', {name: 'Next page'});
  if (await next.isEnabled()) {run = ok(command('POST', '/api/reports/revenue-transactions/run'), 'Paged run');await next.click();await run;}
  await page.getByRole('button', {name: 'Columns'}).click();
  const columns = page.getByRole('dialog', {name: 'Columns'});
  await columns.getByRole('checkbox', {checked: false}).first().click();
  run = ok(command('POST', '/api/reports/revenue-transactions/run'), 'Column run');
  await columns.getByRole('button', {name: 'Apply columns'}).click();await run;
  flows.push({id: 'RPT-viewer-table', scope: 'UI', result: 'Sort, paging and column picker re-run the report with totals'});
  await page.getByRole('button', {name: /Views/}).click();
  await page.getByRole('button', {name: 'Save current view…'}).click();
  await page.getByRole('dialog', {name: 'Save view'}).getByLabel('View name').fill('Fictional integration view');
  const saveView = ok(command('POST', '/api/reports/revenue-transactions/views'), 'Save view');
  await page.getByRole('dialog', {name: 'Save view'}).getByRole('button', {name: 'Save view'}).click();await saveView;
  await page.getByRole('button', {name: /Views/}).click();
  const removeView = ok(command('DELETE', /\/api\/views\//), 'Delete view');
  await page.getByRole('button', {name: 'Delete view Fictional integration view'}).click();await removeView;
  flows.push({id: 'RPT-saved-views', scope: 'UI', result: 'Personal view saved and deleted'});
  await page.getByRole('button', {name: /Export/}).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name: 'CSV'}).click();
  const file = await download;if (!/\.csv$/.test(file.suggestedFilename())) throw new Error('CSV export name');
  flows.push({id: 'RPT-export', scope: 'UI', result: 'Authenticated CSV export downloaded as ' + file.suggestedFilename().replace(/[0-9]/g, '#')});
  await page.getByRole('button', {name: /Export/}).click();
  await page.getByRole('button', {name: 'Run in background…'}).click();
  const background = page.getByRole('dialog', {name: 'Run in the background'});
  await background.getByLabel('When it is ready').selectOption('download');
  const queued = ok(command('POST', '/api/jobs'), 'Background job');
  await background.getByRole('button', {name: 'Queue report'}).click();
  const job = await (await queued).json();
  await background.getByText('Queued as', {exact: false}).waitFor();await background.getByRole('button', {name: 'Close'}).last().click();
  flows.push({id: 'RPT-background', scope: 'UI', result: 'Background run queued from the viewer'});
  await page.getByRole('button', {name: 'Schedule'}).click();
  const scheduleDialog = page.getByRole('dialog', {name: 'Schedule this report'});
  await scheduleDialog.getByLabel('Schedule name').fill('Fictional integration schedule');
  const scheduled = ok(command('POST', '/api/schedules'), 'Schedule create');
  await scheduleDialog.getByRole('button', {name: 'Create schedule'}).click();await scheduled;
  flows.push({id: 'RPT-schedule-create', scope: 'UI', result: 'Schedule created from the viewer'});
  await page.getByRole('button', {name: 'Email'}).click();
  const emailDialog = page.getByRole('dialog', {name: 'Email this report'});
  const emailed = ok(command('POST', '/api/jobs'), 'Email job');
  await emailDialog.getByRole('button', {name: /Email|Send|Queue/}).last().click();await emailed;
  await emailDialog.getByRole('button', {name: 'Close'}).last().click();
  flows.push({id: 'RPT-email', scope: 'UI', result: 'Email delivery queued as a background job'});
  await page.evaluate(() => {window.__printed = 0;window.print = () => {window.__printed++;};});
  await page.getByRole('button', {name: 'Print'}).click();
  await page.waitForFunction(() => window.__printed === 1);
  flows.push({id: 'RPT-print', scope: 'UI', result: 'Print renders the isolated shared print document'});
  await visit('/reports/revenue-transactions');
  await page.getByLabel('Period', {exact: true}).selectOption('last_year');
  expectedStatus.add('/api/reference-modules/reports/api/reports/revenue-transactions/run');
  await page.getByRole('button', {name: 'Run report'}).click();
  await page.getByText('This request is too large to show on screen').waitFor();
  expectedStatus.delete('/api/reference-modules/reports/api/reports/revenue-transactions/run');
  flows.push({id: 'RPT-range-guard', scope: 'UI', result: 'On-screen range guard offers the background path (expected 4xx ASYNC_REQUIRED)'});

  // Jobs: stored result pages and download.
  await visit('/jobs/' + job.id);
  await page.waitForFunction(() => /completed/i.test(document.querySelector('.lumen-reports [data-status]')?.getAttribute('data-status') ?? ''), null, {timeout: 60000});
  await page.locator('.lumen-reports tbody tr').first().waitFor();
  const jobDownload = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Download'}).first().click();await jobDownload;
  flows.push({id: 'RPT-job-result', scope: 'UI', result: 'Background job completed, stored result page shown and file downloaded'});
  await visit('/jobs');await page.getByRole('link', {name: 'Revenue transaction detail'}).first().waitFor();

  // Builder: preview, save, open, delete.
  await visit('/builder/new');
  await page.getByLabel('Title', {exact: true}).fill('Fictional integration report');
  await page.getByLabel('Report type').selectOption('detail');
  const chips = page.getByRole('button', {name: /^\+/});await chips.nth(0).click();await chips.nth(1).click();
  const preview = ok(command('POST', '/api/builder/preview'), 'Builder preview');
  await page.getByRole('button', {name: 'Refresh preview'}).click();await preview;
  const created = ok(command('POST', '/api/definitions'), 'Builder save');
  await page.getByRole('button', {name: 'Save report'}).click();const definition = await (await created).json();
  await page.waitForURL(base + '/reports/' + definition.id);await waitData();
  await visit('/builder');
  const row = page.locator('tr', {has: page.getByRole('link', {name: 'Fictional integration report'})});
  await row.getByRole('button', {name: 'Delete'}).click();
  const deleted = ok(command('DELETE', /\/api\/definitions\//), 'Builder delete');
  await page.getByRole('dialog').getByRole('button', {name: 'Delete'}).click();await deleted;
  flows.push({id: 'RPT-builder', scope: 'UI', result: 'Custom report previewed, saved, opened and deleted'});

  // Dashboards: create, edit, delete.
  await visit('/dashboards');
  await page.getByRole('button', {name: 'New dashboard'}).click();
  await page.getByRole('dialog').getByLabel('Name', {exact: true}).fill('Fictional integration dashboard');
  const board = ok(command('POST', '/api/dashboards'), 'Dashboard create');
  await page.getByRole('dialog').getByRole('button', {name: 'Create dashboard'}).click();await board;
  await page.waitForURL(/\/dashboards\/.+/);await waitData();
  await page.getByRole('button', {name: 'Edit'}).click();
  const dashboardSave = ok(command('PUT', /\/api\/dashboards\//), 'Dashboard save');
  await page.getByRole('button', {name: 'Save dashboard'}).click();await dashboardSave;
  await page.getByRole('button', {name: 'Delete dashboard'}).click();
  const dashboardDelete = ok(command('DELETE', /\/api\/dashboards\//), 'Dashboard delete');
  await page.getByRole('dialog').getByRole('button', {name: 'Delete'}).click();await dashboardDelete;
  await page.waitForURL(base + '/dashboards');
  flows.push({id: 'RPT-dashboards', scope: 'UI', result: 'Dashboard created, saved and deleted'});

  // Schedules: run now, pause/resume, process due, delete.
  await visit('/schedules');
  const runNow = ok(command('POST', /\/api\/schedules\/[^/]+\/run$/), 'Schedule run');
  await page.getByRole('button', {name: 'Run now'}).first().click();await runNow;
  const toggled = ok(command('PATCH', /\/api\/schedules\//), 'Schedule pause');
  await page.getByRole('button', {name: /Pause|Resume/}).first().click();await toggled;
  const cron = ok(command('POST', '/api/cron'), 'Process due');
  await page.getByRole('button', {name: 'Process due schedules now'}).click();await cron;
  const row2 = page.locator('li,tr', {hasText: 'Fictional integration schedule'}).last();
  await row2.getByRole('button', {name: 'Delete'}).click();
  const scheduleDelete = ok(command('DELETE', /\/api\/schedules\//), 'Schedule delete');
  await page.getByRole('dialog').getByRole('button', {name: 'Delete'}).click();await scheduleDelete;
  flows.push({id: 'RPT-schedules', scope: 'UI', result: 'Run now, pause, due processing and delete through HTTP'});

  // Email requests.
  await visit('/email-in');
  const simulated = ok(command('POST', '/api/email-in/simulate'), 'Email-in simulate');
  await page.getByRole('button', {name: 'Send test email'}).click();await simulated;
  flows.push({id: 'RPT-email-in', scope: 'UI', result: 'Inbound email request simulated'});

  // API keys and a BI pull by key over direct HTTP (secret kept in memory only).
  await visit('/api-keys');
  await page.getByLabel('Key name').fill('Fictional integration key');
  const keyResponse = ok(command('POST', '/api/account/keys'), 'Key create');
  await page.getByRole('button', {name: 'Create key'}).click();
  const secret = (await (await keyResponse).json()).secret;
  const pull = await page.request.get(base + '/api/reference-modules/reports/api/v1/reports', {headers: {'X-Reports-Api-Key': secret}});
  if (pull.status() !== 200) throw new Error('BI catalogue pull failed ' + pull.status());
  await page.getByRole('button', {name: 'Revoke'}).first().click();
  const revoked = ok(command('DELETE', /\/api\/account\/keys\//), 'Key revoke');
  await page.getByRole('dialog').getByRole('button', {name: 'Revoke'}).click();await revoked;
  const denied = await page.request.get(base + '/api/reference-modules/reports/api/v1/reports', {headers: {'X-Reports-Api-Key': secret}});
  if (denied.status() !== 401) throw new Error('Revoked key still accepted ' + denied.status());
  flows.push({id: 'RPT-api-keys', scope: 'UI + direct HTTP', result: 'Key created, BI catalogue pulled (200), revoked and rejected (401)'});

  // Administration.
  await visit('/admin/settings');
  const settings = ok(command('PUT', '/api/admin/settings'), 'Settings save');
  await page.getByRole('button', {name: 'Save settings'}).click();await settings;
  await visit('/admin/access');
  await page.getByRole('checkbox').first().waitFor();
  await page.locator('.lumen-reports input[type=checkbox]:not([disabled])').first().click();
  const grants = ok(command('PUT', '/api/admin/grants'), 'Grants save');
  await page.getByRole('button', {name: 'Save access'}).click();await grants;
  await visit('/admin/users');
  await page.getByRole('button', {name: 'Add user'}).click();
  const userDialog = page.getByRole('dialog');
  await userDialog.getByLabel('Full name').fill('Fictional Integration Reader');
  await userDialog.getByLabel('Work email').fill('integration.reader@example.test');
  await userDialog.getByRole('button', {name: /^Roles/}).click();await userDialog.getByRole('button', {name: 'Analyst', exact: true}).click();
  await userDialog.getByLabel('Temporary password').fill('x'.repeat(12));
  const userCreate = ok(command('POST', '/api/admin/users'), 'User create');
  await userDialog.getByRole('button', {name: 'Add user'}).last().click();await userCreate;
  await visit('/admin/audit');
  await page.getByLabel('Search', {exact: true}).fill('settings');
  await page.getByRole('button', {name: 'Filter'}).click();
  await page.waitForURL(base + '/admin/audit?q=settings');await waitData();
  await visit('/admin/outbox');
  flows.push({id: 'RPT-admin', scope: 'UI', result: 'Settings, grants and directory user saved; audit filtered by deep link; outbox listed'});
  const link = page.locator('.lumen-reports a[href^="/downloads/"]').first();
  if (await link.count()) {
    await page.locator('.lumen-reports details', {has: link}).first().locator('summary').click();
    await link.click();await waitData();
    const signed = page.waitForEvent('download');
    await page.getByRole('button', {name: 'Download'}).click();await signed;
    flows.push({id: 'RPT-signed-download', scope: 'UI', result: 'Signed outbox link opened the authenticated download route'});
  }

  // Arabic direction on a report.
  await visit('/preferences');
  await page.getByRole('tab').nth(tabIndex('Language')).click();
  const language = page.locator('select:has(option[value="ar"])').first();
  {
    const toArabic = ok(page.waitForResponse(r => new URL(r.url()).pathname === '/api/preferences' && r.request().method() === 'PUT'), 'Arabic');
    await language.selectOption('ar');await toArabic;
    await visit('/reports/payer-mix');
    if (await page.evaluate(() => document.documentElement.dir) !== 'rtl') throw new Error('Arabic direction not applied');
    await axeCheck('/reports/payer-mix (ar)');
    await visit('/preferences');
    await page.getByRole('tab').nth(tabIndex('Language')).click();
    const back = ok(page.waitForResponse(r => new URL(r.url()).pathname === '/api/preferences' && r.request().method() === 'PUT'), 'English');
    await page.locator('select:has(option[value="ar"])').first().selectOption('en');await back;
    flows.push({id: 'RPT-rtl', scope: 'UI', result: 'Arabic preference applies RTL to a report and passes axe'});
  }
  if (process.env.REPORTS_SCREENSHOT) {await visit('/reports/payer-mix');await page.screenshot({path: process.env.REPORTS_SCREENSHOT, fullPage: true});}

  // Role boundaries with the finance and operations fixtures.
  await signIn('user2');
  expectedStatus.add('/api/reference-modules/reports/api/page/builder');
  current = '/builder';await page.goto(base + '/builder');
  await page.waitForURL(base + '/?denied=1');await waitData();
  expectedStatus.delete('/api/reference-modules/reports/api/page/builder');
  await page.getByText('That page needs a permission your role does not have.').waitFor();
  flows.push({id: 'RPT-denied', scope: 'UI', result: 'Operations analyst without reports.build is redirected to the denied overview'});
  await signIn('user1');
  await visit('/builder');
  const token = await page.evaluate(() => localStorage.getItem('pepbits-session-token'));
  const forbidden = await page.request.get(base + '/api/reference-modules/reports/api/page/admin/access', {headers: {Authorization: 'Bearer ' + token, 'X-Product-Id': 'nexora', 'X-Reference-Module': 'reference-reports', 'X-Reference-Branch': 'dubai'}});
  if (forbidden.status() !== 403) throw new Error('Finance read admin access: ' + forbidden.status());
  flows.push({id: 'RPT-finance', scope: 'UI + direct HTTP', result: 'Finance manager opens the builder; the API returns 403 for administration loaders', status: 403});
} catch (error) {errors.push({route: current, message: error.message});process.exitCode = 1;}
finally {
  await browser.close();
  const result = {scope: 'Local production Next server and unchanged fictional HTTP API', flows, checks, errors, consoleErrors, httpErrors};
  writeFileSync(process.env.REPORTS_RESULT ?? '/tmp/reports-browser.json', JSON.stringify(result, null, 2) + '\n');
  if (errors.length || consoleErrors.length || httpErrors.length || checks.some(c => c.violations.length)) process.exitCode = 1;
  console.log(JSON.stringify({workflows: flows.length, routes: checks.length, errors: errors.length, consoleErrors: consoleErrors.length, httpErrors: httpErrors.length, violations: checks.reduce((n, c) => n + c.violations.length, 0)}));
}
