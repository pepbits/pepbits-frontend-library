import {chromium} from 'playwright';
import {readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
// Real local HTTP check: production Next server + unchanged demo API + Chromium. Fixture credentials are read, never printed.
const require = createRequire(import.meta.url), base = process.env.ONBOARDING_BASE ?? 'http://localhost:3370';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local demo checks only');
const fixtureSource = readFileSync(new URL('../../../mock-api/server.mjs', import.meta.url), 'utf8');
const credential = fixtureSource.match(/username:\s*"admin",\s*password:\s*"([^"]+)"/)[1];
const browser = await chromium.launch({headless: true}), page = await browser.newPage({viewport: {width: 1440, height: 1000}});
const flows = [], checks = [], errors = [], httpErrors = [], consoleErrors = [];
page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
let current = 'login';
page.on('pageerror', error => errors.push({route: current, message: error.message}));
page.on('console', message => {if (message.type() === 'error') consoleErrors.push({route: current, message: message.text()});});
page.on('response', response => {const url = new URL(response.url()); if (url.pathname.startsWith('/api/') && !url.pathname.includes('/auth/') && response.status() >= 400) httpErrors.push({route: current, path: url.pathname, status: response.status()});});
const settle = () => page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running' || animation.effect?.getComputedTiming().iterations === Infinity));
async function waitPage() {
  await page.locator('[data-page-id], .orvia').first().waitFor();
  if (new URL(page.url()).pathname === '/preferences') await page.getByRole('tab').first().waitFor();
  else await page.locator('.orvia h1').first().waitFor();
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]'));
}
async function visit(path) {current = path; await page.goto(base + path); await waitPage();}
async function axe(path, profile) {
  await visit(path); await page.waitForTimeout(400);
  await page.addScriptTag({path: require.resolve('axe-core/axe.min.js')}); await settle();
  const result = await page.evaluate(() => window.axe.run(document));
  checks.push({path, profile, violations: result.violations.map(v => ({id: v.id, targets: v.nodes.map(n => n.target)})), incomplete: result.incomplete.length});
}
const flow = (id, result, scope = 'UI') => flows.push({id, scope, result});
const strong = ['Fictional', 'Strong', 'Pass', '42'].join('-');
try {
  current = '/'; await page.goto(base + '/');
  await page.locator('input[autocomplete=username]').fill('admin'); await page.locator('input[type=password]').fill(credential);
  await page.getByRole('button', {name: /sign in/i}).click(); await waitPage();
  if (!(await page.getByRole('heading', {name: 'One record of care, from front desk to final claim.'}).isVisible())) throw new Error('Landing did not render after sign-in');
  flow('ONB-01', 'Fixture sign-in, API preferences and catalog, shell with Orvia navigation');

  // Landing: care pathway keyboard, facility explorer and registration deep link.
  await page.getByRole('radio', {name: /Registration/}).focus(); await page.keyboard.press('ArrowRight');
  if (await page.getByRole('radio', {name: /Triage/}).getAttribute('aria-checked') !== 'true') throw new Error('Care pathway keyboard failed');
  await page.getByRole('tab', {name: /Pharmacy/}).click(); await page.getByRole('tabpanel').getByText('Controlled substances').waitFor();
  await page.getByRole('link', {name: 'Register as a pharmacy'}).click(); await page.waitForURL(base + '/register?type=pharmacy', {waitUntil: 'commit'}); current = '/register?type=pharmacy'; await waitPage();
  await page.getByRole('button', {name: /^Pharmacy/, pressed: true}).waitFor();
  flow('ONB-landing', 'Care pathway arrows, facility explorer tabs and ?type= registration deep link');

  // Workspace finder: address lookup and email lookup.
  await visit('/'); await page.getByRole('link', {name: 'Sign in to your workspace'}).click(); await page.waitForURL(base + '/workspace', {waitUntil: 'commit'}); current = '/workspace'; await waitPage();
  await page.getByRole('textbox', {name: 'Workspace address'}).fill('stmarys');
  await page.getByText('Hospital network, 6 facilities').waitFor();
  await page.getByRole('button', {name: 'Continue to sign in'}).click(); await page.waitForURL(base + '/sign-in?ws=stmarys', {waitUntil: 'commit'}); current = '/sign-in?ws=stmarys'; await waitPage();
  flow('ONB-workspace-address', 'Live address lookup continues to the workspace sign-in URL');
  await visit('/workspace'); await page.getByRole('radio', {name: 'Work email'}).click();
  await page.getByRole('textbox', {name: 'Work email'}).fill('pharmacist@cityrx.co.uk'); await page.getByRole('button', {name: 'Find workspaces'}).click();
  await page.getByText('1 workspace for cityrx.co.uk').waitFor();
  await page.getByText('Recently used on this device').waitFor();
  flow('ONB-workspace-email', 'Work-email lookup lists matching workspaces; recent workspaces are remembered on this device');

  // Sign-in with MFA and password reset.
  await visit('/login?ws=stmarys');
  await page.getByRole('button', {name: 'Sign in', exact: true}).click(); await page.getByText('Enter the email you use for this workspace').waitFor();
  await page.getByRole('textbox', {name: 'Email'}).fill('nurse@stmarys.org'); await page.locator('#login-password').fill(strong);
  await page.getByRole('button', {name: 'Sign in', exact: true}).click(); await page.getByRole('heading', {name: 'Enter your sign-in code'}).waitFor();
  await page.getByRole('textbox', {name: 'Digit 1 of 6'}).focus(); await page.keyboard.type('123456');
  await page.getByRole('heading', {name: "Signed in to St. Mary's Medical Center"}).waitFor();
  flow('ONB-sign-in', 'Source /login alias, credential validation and 6-digit code completion (fictional adapter)');
  await page.getByRole('button', {name: 'Sign out'}).click(); await page.getByRole('button', {name: 'Forgot password?'}).click();
  await page.getByRole('button', {name: 'Send reset link'}).click(); await page.getByRole('heading', {name: 'Check your email'}).waitFor();
  flow('ONB-reset', 'Password reset request confirmation');

  // Registration: complete a single hospital, check discoverability and the draft.
  await visit('/register');
  await page.getByRole('button', {name: /^Single facility/}).click(); await page.getByRole('button', {name: /^Hospital/}).click();
  await page.getByRole('button', {name: 'Continue'}).click(); await page.getByRole('heading', {name: 'Organization details'}).waitFor();
  await page.getByRole('textbox', {name: /Legal name/}).fill('Fictional Harbour Hospital');
  await page.getByRole('textbox', {name: /License number/}).fill('DEMO-HH-1'); await page.getByRole('spinbutton', {name: /Licensed beds/}).fill('80');
  await page.getByRole('combobox', {name: /Country/}).selectOption('GB'); await page.getByRole('textbox', {name: /^City/}).fill('London');
  await page.getByRole('textbox', {name: /Street address/}).fill('3 Fictional Quay'); await page.getByRole('textbox', {name: /Main phone/}).fill('20 7946 0000');
  await page.getByText(/Draft saved at/).waitFor();
  await page.reload(); await waitPage(); await page.getByText('We restored your draft from this device.').waitFor();
  if (await page.getByRole('textbox', {name: /Legal name/}).inputValue() !== 'Fictional Harbour Hospital') throw new Error('Draft was not restored');
  flow('ONB-register-draft', 'Device draft autosave and restore after reload (form fields only)');
  for (const heading of ['Clinical scope', 'Modules and standards', 'Workspace and administrator']) {await page.getByRole('button', {name: 'Continue'}).click(); await page.getByRole('heading', {name: heading}).waitFor();}
  if (await page.getByRole('textbox', {name: /Workspace address/}).inputValue() !== 'fictional-harbour-hospital') throw new Error('Workspace address was not suggested');
  await page.getByText(/is available/).waitFor();
  await page.getByRole('textbox', {name: /Full name/}).fill('Fictional Administrator'); await page.getByRole('combobox', {name: /^Role/}).selectOption('Medical director');
  await page.getByRole('textbox', {name: /Work email/}).fill('admin@harbour.test'); await page.getByRole('textbox', {name: /Mobile number/}).fill('7700 900000');
  await page.locator('#workspace\\.password').fill(strong);
  await page.getByRole('button', {name: 'Continue'}).click(); await page.getByRole('heading', {name: 'Review and submit'}).waitFor();
  await page.getByRole('button', {name: 'Submit registration'}).click(); await page.getByText('Accept the terms of service to continue').waitFor();
  for (const name of [/terms of service/, /business associate agreement/, /data processing agreement/]) await page.getByRole('checkbox', {name}).check({force: true});
  await page.getByRole('button', {name: 'Submit registration'}).click(); await page.getByRole('heading', {name: 'Registration submitted'}).waitFor();
  const reference = await page.locator('[data-reference]').textContent();
  if (!/^ORV-\d{2}-\d{5}$/.test(reference ?? '')) throw new Error('No registration reference');
  if (process.env.ONBOARDING_SCREENSHOT) {await settle(); await page.screenshot({path: process.env.ONBOARDING_SCREENSHOT.replace('.png', '-registered.png')});}
  await page.getByRole('link', {name: 'Go to workspace sign-in'}).click(); await page.waitForURL(base + '/sign-in?ws=fictional-harbour-hospital', {waitUntil: 'commit'}); current = '/sign-in?ws=fictional-harbour-hospital'; await waitPage();
  await page.getByText(/pending license review/).waitFor();
  flow('ONB-register-submit', 'Single-hospital registration, agreements, reference, pending workspace sign-in');

  await visit('/register?structure=network');
  await page.getByText('Step 1 of 7').waitFor(); await page.getByRole('button', {name: /^Clinic or polyclinic/}).click();
  await page.getByRole('button', {name: 'Continue'}).click(); await page.getByRole('heading', {name: 'Organization details'}).waitFor();
  await page.getByRole('textbox', {name: /Legal name/}).fill('Fictional Network Group'); await page.getByRole('textbox', {name: /License number/}).fill('DEMO-NG-1');
  await page.getByRole('combobox', {name: /Country/}).selectOption('IN'); await page.getByRole('textbox', {name: /^City/}).fill('Mumbai');
  await page.getByRole('textbox', {name: /Street address/}).fill('4 Fictional Road'); await page.getByRole('textbox', {name: /Main phone/}).fill('22 5555 0000');
  await page.getByRole('button', {name: 'Continue'}).click(); await page.getByRole('heading', {name: 'Facilities'}).waitFor();
  await page.getByRole('textbox', {name: 'Facility name'}).nth(1).fill('Fictional North Clinic'); await page.getByRole('button', {name: 'Add facility'}).click();
  await page.getByRole('textbox', {name: 'Facility name'}).nth(2).fill('Fictional South Clinic');
  await page.getByRole('button', {name: 'Continue'}).click(); await page.getByRole('heading', {name: 'Clinical scope'}).waitFor();
  await page.getByRole('button', {name: /Facilities \(completed\)/}).click(); await page.getByRole('heading', {name: 'Facilities'}).waitFor();
  if (await page.getByRole('textbox', {name: 'Facility name'}).count() !== 3) throw new Error('Facility rows were lost');
  if (process.env.ONBOARDING_SCREENSHOT) {await settle(); await page.screenshot({path: process.env.ONBOARDING_SCREENSHOT.replace('.png', '-facilities.png')});}
  flow('ONB-register-network', 'Network structure adds the facilities step; rows persist across stepper navigation');

  // Preferences through the shared page, then route accessibility under default, Arabic RTL and reduced motion.
  await visit('/preferences');
  const saved = page.waitForResponse(response => response.url().endsWith('/preferences') && response.request().method() === 'PUT');
  await page.getByRole('tab').nth(5).click(); await page.getByRole('combobox', {name: 'Language'}).selectOption('ar');
  if (!(await saved).ok()) throw new Error('Preference update failed');
  await page.waitForFunction(() => document.documentElement.dir === 'rtl');
  flow('ONB-preferences', 'Accepted host preference switches the whole app to Arabic RTL');
  const routes = ['/', '/workspace', '/sign-in?ws=alnoor', '/login?ws=cityrx', '/sign-in', '/sign-in?ws=unknown-workspace', '/register', '/register?type=pharmacy', '/register?structure=network', '/legal/terms', '/preferences'];
  for (const path of routes) await axe(path, 'Arabic RTL');
  await visit('/workspace');
  if (await page.locator('.orvia').first().getAttribute('dir') !== 'rtl') throw new Error('Orvia surface did not follow RTL');
  await visit('/preferences');
  const english = page.waitForResponse(response => response.url().endsWith('/preferences') && response.request().method() === 'PUT');
  await page.getByRole('tab').nth(5).click(); await page.locator('[data-tour=prefs-lang] select').first().selectOption('en'); if (!(await english).ok()) throw new Error('Language reset failed');
  await page.waitForFunction(() => document.documentElement.dir !== 'rtl');
  for (const path of routes) await axe(path, 'default');
  await visit('/preferences');
  const motion = page.waitForResponse(response => response.url().endsWith('/preferences') && response.request().method() === 'PUT');
  await page.getByRole('tab').nth(5).click(); await page.getByRole('radiogroup', {name: 'Animations'}).getByRole('radio', {name: 'Off'}).click(); if (!(await motion).ok()) throw new Error('Reduced motion update failed');
  await visit('/'); if (await page.locator('.orvia').getAttribute('data-reduced-motion') !== 'true') throw new Error('Reduced motion did not reach the Orvia surface');
  for (const path of routes) await axe(path, 'reduced motion');
  flow('ONB-reduced-motion', 'Accepted reduced-motion preference reaches the Orvia surface');

  // Only this launcher's isolated API storage is changed. Use the real admin policy endpoint,
  // then verify the mounted host replaces the conflicting accepted user preference.
  await page.evaluate(async () => {
    const headers = {'Content-Type': 'application/json', 'X-Product-Id': 'nexora', Authorization: 'Bearer ' + localStorage.getItem('pepbits-session-token')};
    const snapshot = await fetch('/api/preferences', {headers}).then(response => response.json());
    const saved = await fetch('/api/preferences', {method: 'PUT', headers, body: JSON.stringify({preferences: {...snapshot.preferences, density: 'spacious', reducedMotion: false}, userRevision: snapshot.userRevision, policyRevision: snapshot.policy.revision})});
    if (!saved.ok) throw new Error('Locked-profile preference setup failed');
    const {policy} = await fetch('/api/preference-policy', {headers}).then(response => response.json());
    const locked = await fetch('/api/preference-policy', {method: 'PUT', headers, body: JSON.stringify({revision: policy.revision, rules: {...policy.rules, density: {value: 'compact', locked: true}}})});
    if (!locked.ok) throw new Error('Tenant lock setup failed');
    window.dispatchEvent(new Event('pepbits-preference-policy-changed'));
  });
  await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--row-py') === '6px');
  flow('ONB-tenant-policy', 'Real admin policy endpoint overrides spacious with locked compact density in the mounted host', 'HTTP + UI');
  for (const path of routes) await axe(path, 'locked preference');
  await visit('/workspace');
  if (process.env.ONBOARDING_SCREENSHOT) {await settle(); await page.screenshot({path: process.env.ONBOARDING_SCREENSHOT});}
} catch (error) {errors.push({route: current, message: error.message}); process.exitCode = 1;}
finally {
  await browser.close();
  const result = {scope: 'Local production Next server and unchanged fictional HTTP API; Orvia directory/registration/sign-in are fictional browser adapters', flows, checks, errors, consoleErrors, httpErrors};
  writeFileSync(process.env.ONBOARDING_RESULT ?? '/tmp/onboarding-browser.json', JSON.stringify(result, null, 2) + '\n');
  if (errors.length || consoleErrors.length || httpErrors.length || checks.some(check => check.violations.length)) process.exitCode = 1;
  console.log(JSON.stringify({workflows: flows.length, routes: checks.length, errors: errors.length, consoleErrors: consoleErrors.length, httpErrors: httpErrors.length, violations: checks.reduce((n, check) => n + check.violations.length, 0)}));
}
