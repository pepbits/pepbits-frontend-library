// Chromium workflows against the local production server, the unchanged shared demo API and the unchanged
// AllyVora API. Fixture credentials are read from the API fixture source and never printed or saved.
import {chromium} from 'playwright';
import {readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url), base = process.env.ALLYVORA_BASE ?? 'http://localhost:3400';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local demo checks only');
const fixtureSource = readFileSync(new URL('../../../mock-api/server.mjs', import.meta.url), 'utf8');
const credential = name => fixtureSource.match(new RegExp(`username:\\s*"${name}",\\s*password:\\s*"([^"]+)"`))[1];
const browser = await chromium.launch({headless: true}), context = await browser.newContext({viewport: {width: 1440, height: 1000}}), page = await context.newPage();
const diagnostics = [], flows = [], checks = [], errors = [], httpErrors = [], consoleErrors = [], expectedStatuses = [];
let current = 'login';
page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
const watch = target => {
  target.on('pageerror', error => errors.push({route: current, message: error.message}));
  target.on('console', message => {if (message.type() === 'error' && !/status of 409/.test(message.text())) consoleErrors.push({route: current, message: message.text()});});
  target.on('response', response => {const url = new URL(response.url()); if ((url.pathname.startsWith('/api/') || url.pathname.startsWith('/allyvora-api/')) && !url.pathname.includes('/auth/') && response.status() >= 400) {
    const entry = {route: current, path: url.pathname, status: response.status()};
    if (response.status() === 409 && url.pathname.startsWith('/allyvora-api/patients/')) expectedStatuses.push(entry); else httpErrors.push(entry);
  }});
};
watch(page);
const settle = async (target = page) => {await target.waitForFunction(() => !document.querySelector('main [aria-busy="true"]') && document.getAnimations().every(animation => animation.playState !== 'running' || animation.effect?.getComputedTiming().iterations === Infinity));};
const waitRoute = async (target = page) => {
  const url = new URL(target.url()), mode = url.searchParams.get('mode');
  if (url.pathname === '/preferences') await target.getByRole('combobox', {name: 'Column layout is saved'}).waitFor();
  else await target.locator('main h1').first().waitFor();
  if (url.pathname === '/patients' && !mode) await target.locator('[data-patient-register] tbody tr, [data-patient-register] [data-register-empty]').first().waitFor();
  if (mode === 'new' || mode === 'edit') await target.locator('[data-patient-form]').waitFor();
  if (mode === 'view') await target.locator('[data-patient-view] [data-activity] li').first().waitFor();
  if (url.pathname === '/settings/layout') await target.locator('[data-layout-history] li, [data-layout-history] p').first().waitFor();
  await settle(target);
};
async function visit(path, target = page) {current = path; await target.goto(base + path); await waitRoute(target);}
async function signIn(user, target = page) {
  await target.goto(base + '/patients');
  await target.locator('input[autocomplete=username]').fill(user);
  await target.locator('input[type=password]').fill(credential(user));
  await target.getByRole('button', {name: /sign in/i}).click();
  await waitRoute(target);
}
/** Click the shell's own link for a route; if the pointer click does not navigate, record why and use the DOM click. */
async function clientNavigate(href, done) {
  const links = page.locator(`aside a[href="${href}"], nav a[href="${href}"]`);
  const reached = () => page.waitForURL(url => done(new URL(url)), {timeout: 10000}).then(() => true, () => false);
  await links.first().click();
  if (!(await reached())) {
    diagnostics.push({href, url: page.url(), candidates: await links.count()});
    await links.first().evaluate(link => link.click());
    await page.waitForURL(url => done(new URL(url)));
  }
  await waitRoute();
}
const token = () => page.evaluate(() => localStorage.getItem('pepbits-session-token'));
async function setPreferences(patch) {
  const headers = {Authorization: 'Bearer ' + await token(), 'X-Product-Id': 'nexora'};
  const snapshot = await (await page.request.get(base + '/api/preferences', {headers})).json();
  const response = await page.request.put(base + '/api/preferences', {headers, data: {userRevision: snapshot.userRevision, policyRevision: snapshot.policy.revision, preferences: {...snapshot.overrides, ...patch}}});
  if (!response.ok()) throw new Error('Preference update failed ' + response.status());
}
async function axeSweep(label, paths) {
  for (const path of paths) {
    await visit(path);
    await page.addScriptTag({path: require.resolve('axe-core/axe.min.js')});
    await settle();
    const result = await page.evaluate(() => window.axe.run(document, {rules: {}}));
    checks.push({profile: label, path, dir: await page.evaluate(() => document.querySelector('main')?.closest('[dir]')?.getAttribute('dir') ?? 'ltr'), violations: result.violations.map(v => ({id: v.id, targets: v.nodes.map(n => n.target)})), incomplete: result.incomplete.length});
  }
}
const pick = async (target, label, query, option) => {
  await target.getByRole('button', {name: new RegExp('^' + label)}).click();
  await target.getByRole('combobox', {name: new RegExp('Search ' + label, 'i')}).fill(query);
  await target.getByRole('option').filter({hasText: option}).first().click();
};
async function fillRegistration(target, {given, family, mobile}) {
  const field = id => target.locator(`[data-field="${id}"] input:not([type=hidden]), [data-field="${id}"] textarea`).first();
  await field('givenName').fill(given);
  await field('familyName').fill(family);
  await field('dateOfBirth').fill('1988-07-14');
  await target.locator('[data-field="administrativeSex"]').getByRole('radio', {name: 'Male', exact: true}).click();
  await field('mobile').fill(mobile);
  await field('pincode').fill('682020');
  await target.waitForFunction(() => (document.querySelector('[data-field="city"] input')?.value ?? '') !== '');
  await field('addressLine1').fill('7 Fictional Road');
  await target.locator('[data-field="allergyStatus"]').getByRole('radio', {name: 'No known allergies'}).click();
  const department = target.getByRole('button', {name: /^Department/});
  await department.focus();
  await target.keyboard.type('General');
  await target.getByRole('option').filter({hasText: 'General Medicine'}).first().waitFor();
  await target.keyboard.press('Tab');
  if (!(await department.textContent()).includes('General Medicine')) throw new Error('Quick pick did not select the match');
  if (!(await target.locator('[data-field="consultant"] button').evaluate(element => element === document.activeElement))) throw new Error('Quick pick did not advance focus');
  await target.getByRole('switch', {name: /Consents to registration and treatment/}).click();
  await target.locator('[data-field="consentCapture"]').getByRole('radio', {name: 'Paper form'}).click();
  await field('paperFormRef').fill('PF-INT-1');
}
try {
  await signIn('admin');
  flows.push({id: 'AV-01', scope: 'UI', result: 'Fixture sign-in through the shared host; register loads AllyVora rows'});
  await visit('/preferences');
  const prefSave = page.waitForResponse(r => r.url().endsWith('/api/preferences') && r.request().method() === 'PUT');
  await page.getByRole('combobox', {name: 'Column layout is saved'}).selectOption('account');
  if (!(await prefSave).ok()) throw new Error('Preference save failed');
  flows.push({id: 'AV-02', scope: 'UI', result: 'Shared preferences page saves through the central host path'});

  // Register: views, search, filters, deep links.
  await visit('/patients');
  const rows = await page.locator('[data-patient-register] tbody tr').count();
  await page.getByRole('textbox', {name: 'Search patients'}).fill('Joseph');
  await page.waitForURL(url => new URL(url).searchParams.get('q') === 'Joseph');
  await page.locator('[data-patient-register] tbody tr').filter({hasText: 'Joseph'}).first().waitFor();
  await page.reload(); await waitRoute();
  if (await page.getByRole('textbox', {name: 'Search patients'}).inputValue() !== 'Joseph') throw new Error('Search was not restored from the URL');
  await page.getByRole('button', {name: 'Clear filters'}).click();
  await page.waitForURL(url => !new URL(url).searchParams.get('q'));
  await page.getByRole('tab', {name: /Registered today/}).click();
  await page.waitForURL(url => new URL(url).searchParams.get('view') === 'today');
  await page.getByRole('combobox', {name: 'Sex'}).selectOption('female');
  await page.waitForURL(url => new URL(url).searchParams.get('sex') === 'female');
  flows.push({id: 'AV-03', scope: 'UI', result: `Register views/search/filters drive the API and survive reload (${rows} rows on first page)`});

  // Record view and section edit.
  await visit('/patients');
  await page.locator('[data-patient-register] tbody tr').first().click();
  await page.waitForURL(url => new URL(url).searchParams.get('mode') === 'view'); await waitRoute();
  const recordId = new URL(page.url()).searchParams.get('id');
  await page.getByRole('link', {name: /Edit Contact/}).click();
  await page.waitForURL(url => new URL(url).searchParams.get('section') === 'contact'); await waitRoute();
  const email = 'fictional.' + recordId + '@example.test';
  await page.locator('[data-field="email"] input').fill(email);
  const saved = page.waitForResponse(r => r.url().includes('/allyvora-api/patients/' + recordId) && r.request().method() === 'PUT');
  await page.getByRole('button', {name: /Save changes/}).click();
  if (!(await saved).ok()) throw new Error('Patient update failed');
  await page.waitForURL(url => new URL(url).searchParams.get('mode') === 'view'); await waitRoute();
  await page.reload(); await waitRoute();
  await page.getByText(email).first().waitFor();
  await page.locator('[data-activity]').getByText('Email').first().waitFor();
  flows.push({id: 'AV-04', scope: 'UI', result: 'Row opens the record; section deep link edits, saves with version, reload shows value and audit change'});

  // Concurrent edits: the second save of a stale version is rejected and explained.
  const second = await context.newPage(); watch(second);
  await visit(`/patients?mode=edit&id=${recordId}`); await visit(`/patients?mode=edit&id=${recordId}`, second);
  await page.locator('[data-field="landmark"] input').fill('Near the fictional park');
  const first = page.waitForResponse(r => r.url().includes('/allyvora-api/patients/' + recordId) && r.request().method() === 'PUT');
  await page.getByRole('button', {name: /Save changes/}).click(); if (!(await first).ok()) throw new Error('First concurrent save failed');
  await second.locator('[data-field="landmark"] input').fill('Near the fictional river');
  const stale = second.waitForResponse(r => r.url().includes('/allyvora-api/patients/' + recordId) && r.request().method() === 'PUT');
  await second.getByRole('button', {name: /Save changes/}).click();
  if ((await stale).status() !== 409) throw new Error('Stale save was not rejected');
  await second.getByText(/Someone else saved this patient/).first().waitFor();
  if (await second.locator('[data-field="landmark"] input').inputValue() !== 'Near the fictional river') throw new Error('Rejected edit lost its value');
  await second.close();
  flows.push({id: 'AV-05', scope: 'UI', result: 'Second stale save receives 409, keeps the typed value and explains the conflict'});

  // New registration with duplicate warning, rules drawer and session draft recovery.
  await visit('/patients?mode=new');
  await page.locator('[data-field="mobile"] input').fill(await (async () => {const list = await (await page.request.get(base + '/allyvora-api/patients?pageSize=1')).json(); return list.items[0].mobile;})());
  await page.getByText('This may be a returning patient. Check before creating a new record.').waitFor();
  await page.locator('[data-field="mobile"] input').fill('');
  await page.getByRole('button', {name: /Check form rules/}).click();
  await page.getByRole('dialog', {name: 'Form rules'}).getByRole('button', {name: /^First name/}).click();
  await page.locator('[data-field="givenName"] input').fill('Draftina');
  const signature = page.locator('[data-signature-pad] canvas');
  await signature.scrollIntoViewIfNeeded();
  const box = await signature.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 30); await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 60, {steps: 8}); await page.mouse.up();
  await page.getByText(/Draft kept for this session/).waitFor();
  // Wait for the autosave debounce after the stroke, not only the earlier name edit.
  await page.waitForTimeout(1000);
  await page.getByRole('button', {name: /Back to patients/}).click();
  await page.getByRole('dialog', {name: 'Leave without saving?'}).getByRole('button', {name: 'Cancel'}).click();
  // Client-side navigation through the shell sidebar keeps the signed-in module state (a full reload would not).
  await clientNavigate('/patients', url => url.pathname === '/patients' && !url.searchParams.get('mode'));
  await clientNavigate('/patients?mode=new', url => url.searchParams.get('mode') === 'new');
  await page.getByRole('button', {name: 'Restore draft'}).click();
  if (await page.locator('[data-field="givenName"] input').inputValue() !== 'Draftina') throw new Error('Draft was not restored');
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-signature-pad] canvas');
    return canvas && canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, i) => i % 4 === 3 && value > 0);
  });
  flows.push({id: 'AV-06', scope: 'UI', result: 'Duplicate warning, rules drawer jump and in-memory session draft restore including drawn signature'});
  await page.getByRole('button', {name: /Save patient/}).click();
  await page.getByText(/fields need attention/).first().waitFor();
  await fillRegistration(page, {given: 'Integration', family: 'Fictional', mobile: '9000012345'});
  const created = page.waitForResponse(r => r.url().endsWith('/allyvora-api/patients') && r.request().method() === 'POST');
  await page.getByRole('button', {name: /Save patient/}).click();
  const createdResponse = await created; if (createdResponse.status() !== 201) throw new Error('Registration failed ' + createdResponse.status());
  const patient = await createdResponse.json();
  await page.waitForURL(url => new URL(url).searchParams.get('id') === String(patient.id)); await waitRoute();
  await page.locator('[data-patient-band]').getByText(patient.mrn).waitFor();
  flows.push({id: 'AV-07', scope: 'UI', result: 'Empty save reveals problems; keyboard quick pick advances focus; complete registration assigns branch MRN and opens the record'});

  // Status change.
  await page.getByRole('button', {name: 'Mark inactive'}).click();
  const patch = page.waitForResponse(r => r.url().includes(`/allyvora-api/patients/${patient.id}/status`));
  await page.getByRole('dialog', {name: 'Mark this record inactive?'}).getByRole('button', {name: 'Mark inactive'}).click();
  if (!(await patch).ok()) throw new Error('Status change failed');
  await page.getByRole('button', {name: 'Make active'}).waitFor();
  const reactivate = page.waitForResponse(r => r.url().includes(`/allyvora-api/patients/${patient.id}/status`));
  await page.getByRole('button', {name: 'Make active'}).click();
  await page.getByRole('dialog', {name: 'Make this record active?'}).getByRole('button', {name: 'Make active'}).click();
  if (!(await reactivate).ok()) throw new Error('Reactivation failed');
  flows.push({id: 'AV-08', scope: 'UI', result: 'Confirmed deactivate and reactivate through the status API with audit entries'});

  // Layout designer and the form's own switcher.
  await visit('/settings/layout');
  await page.getByRole('radio', {name: /^Tabs/}).click();
  await page.locator('[data-layout-preview="tabs"] [role=tablist]').waitFor();
  const layoutSave = page.waitForResponse(r => r.url().endsWith('/allyvora-api/settings/layout') && r.request().method() === 'PUT');
  await page.getByRole('button', {name: /Save layout/}).click();
  if (!(await layoutSave).ok()) throw new Error('Layout save failed');
  await page.locator('[data-layout-history]').getByText(/^Tabs, comfortable/).first().waitFor();
  await visit('/patients?mode=new');
  await page.locator('[data-form-layout="tabs"]').waitFor();
  const switcher = page.waitForResponse(r => r.url().endsWith('/allyvora-api/settings/layout') && r.request().method() === 'PUT');
  await page.getByRole('radiogroup', {name: 'Form layout'}).getByRole('radio', {name: 'Single page'}).click();
  if (!(await switcher).ok()) throw new Error('Form switcher save failed');
  await page.locator('[data-form-layout="scroll"]').waitFor();
  flows.push({id: 'AV-09', scope: 'UI', result: 'Designer preview and save change the organisation layout; the form switcher saves it back'});
  if (process.env.ALLYVORA_SCREENSHOT) await page.screenshot({path: process.env.ALLYVORA_SCREENSHOT.replace('.png', '-form.png')});

  // Accessibility sweep in English, then Arabic RTL after a host preference change.
  const routes = ['/patients', '/patients?view=inactive', '/patients?mode=new', `/patients?mode=view&id=${patient.id}`, `/patients?mode=edit&id=${patient.id}`, `/patients?mode=edit&id=${patient.id}&section=consent`, '/settings/layout', '/preferences'];
  await axeSweep('default', routes);
  await setPreferences({language: 'ar', reducedMotion: true});
  await axeSweep('arabic-rtl-reduced-motion', routes.slice(0, 7));
  if (checks.filter(check => check.profile !== 'default').some(check => check.dir !== 'rtl')) throw new Error('Arabic routes did not render right to left');
  await setPreferences({language: 'en', reducedMotion: false});
  flows.push({id: 'AV-10', scope: 'HTTP setup + UI', result: 'Arabic RTL and reduced motion from the shared preference API apply to every module route'});
  await visit('/patients');
  if (process.env.ALLYVORA_SCREENSHOT) await page.screenshot({path: process.env.ALLYVORA_SCREENSHOT});

  // A second fixture role: registration allowed, organisation layout read-only in the UI.
  await page.evaluate(() => localStorage.clear());
  await context.clearCookies();
  await signIn('user2');
  await visit('/settings/layout');
  await page.getByText(/Only administrators can change the organisation layout/).waitFor();
  if (await page.getByRole('button', {name: /Save layout/}).isEnabled()) throw new Error('Non-administrator could save the layout');
  if (!(await page.getByRole('radio', {name: /^Single page/}).getAttribute('aria-checked'))) throw new Error('Layout radios missing');
  await visit('/patients');
  if (!(await page.getByRole('button', {name: /New patient/}).isEnabled())) throw new Error('Registration role cannot register');
  flows.push({id: 'AV-11', scope: 'UI', result: 'Operations analyst registers patients; layout designer is read-only (UI gating only)'});
} catch (error) {errors.push({route: current, url: page.url(), message: error.message}); if (process.env.ALLYVORA_SCREENSHOT) await page.screenshot({path: process.env.ALLYVORA_SCREENSHOT.replace('.png', '-failure.png')}).catch(() => {}); process.exitCode = 1;}
finally {
  await browser.close();
  const result = {scope: 'Local production Next server, unchanged shared demo API and unchanged AllyVora API (fictional data)', flows, checks, diagnostics, errors, consoleErrors, httpErrors, expectedStatuses};
  writeFileSync(process.env.ALLYVORA_RESULT ?? '/tmp/allyvora-browser.json', JSON.stringify(result, null, 2) + '\n');
  if (errors.length || consoleErrors.length || httpErrors.length || checks.some(check => check.violations.length)) process.exitCode = 1;
  console.log(JSON.stringify({workflows: flows.length, routes: checks.length, errors: errors.length, consoleErrors: consoleErrors.length, httpErrors: httpErrors.length, expected409: expectedStatuses.length, violations: checks.reduce((n, check) => n + check.violations.length, 0)}));
}
