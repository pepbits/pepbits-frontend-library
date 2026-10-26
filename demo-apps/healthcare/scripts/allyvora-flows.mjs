// Adapted from standalone allyvora-patients/scripts/smoke.mjs at b3cc2e3.
// Uses the healthcare browser/session and real same-origin data proxy; no intercepted business responses.
import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
const require = createRequire(import.meta.url);
export async function allyvoraFlows({page, base, flows, checks}) {
  let current;
  await page.locator('header [data-tour=module] button').first().click();
  const options = page.getByRole('listbox').getByRole('option');
  if (await options.count() !== 14) throw new Error('Healthcare header must have fourteen apps for admin');
  await page.getByRole('listbox').getByRole('option', {name: /^Patients(?:\s|$)/}).click();
  await page.waitForURL(base + '/allyvora-patients/patients');
  await page.locator('[data-patient-register] tbody tr').first().waitFor();
  flows.push({id: 'HCD-AV-01', scope: 'UI', result: 'Fourteenth header app opens the patient register within the healthcare shell'});
const settle = async (target = page) => {await target.waitForFunction(() => !document.querySelector('main [aria-busy="true"]') && document.getAnimations().every(animation => animation.playState !== 'running' || animation.effect?.getComputedTiming().iterations === Infinity));};
/** Patient page and record id of a URL: dedicated `/patients/new`, `/patients/<id>`, `/patients/<id>/edit`, or a former `?mode=` link. */
const patientRoute = (href) => {
  const url = new URL(href), record = /^\/allyvora-patients\/patients\/(new|[0-9]+)(\/edit)?$/.exec(url.pathname);
  if (record) return record[1] === 'new' ? {mode: 'new'} : {mode: record[2] ? 'edit' : 'view', id: record[1]};
  return url.pathname === '/allyvora-patients/patients' ? {mode: url.searchParams.get('mode'), id: url.searchParams.get('id')} : {};
};
const waitRoute = async (target = page) => {
  const url = new URL(target.url()), {mode} = patientRoute(target.url());
  if (url.pathname === '/preferences') await target.locator('[data-preference=columnLayoutScope] select').waitFor();
  else await target.locator('main h1').first().waitFor();
  if (url.pathname === '/allyvora-patients/patients' && !mode) await target.locator('[data-patient-register] tbody tr, [data-patient-register] [data-register-empty]').first().waitFor();
  if (mode === 'new' || mode === 'edit') await target.locator('[data-record-form]').waitFor();
  if (mode === 'view') await target.locator('[data-patient-view] [data-activity] li').first().waitFor();
  await settle(target);
};
async function visit(path, target = page) {current = path; await target.goto(base + path); await waitRoute(target);}
/** Use the healthcare sidebar's explicit keyboard toggle before following its real link. */
async function clientNavigate(href, done) {
  const sidebar = page.locator('aside[data-tour=sidebar]');
  const toggle = sidebar.locator('button[aria-expanded]').first();
  await page.mouse.move(700, 70);
  if (await toggle.getAttribute('aria-expanded') === 'false') {
    await toggle.focus();
    await toggle.press('Enter');
  }
  await sidebar.locator(`a[href="${href}"]`).click();
  await page.waitForURL(url => done(new URL(url)));
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
    if(path==='/preferences'){await page.evaluate(()=>window.dispatchEvent(new CustomEvent('pepbits:tour-reveal',{detail:{target:'prefs-forms'}})));await page.locator('[data-tour=prefs-forms]').waitFor();}
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
  // Register: views, search, filters, deep links.
  await visit('/allyvora-patients/patients');
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
  flows.push({id: 'HCD-AV-03', scope: 'UI', result: `Register views/search/filters drive the API and survive reload (${rows} rows on first page)`});

  // Record view and section edit.
  await visit('/allyvora-patients/patients');
  await page.locator('[data-patient-register] tbody tr').first().click();
  await page.waitForURL(url => new URL(url).pathname !== '/allyvora-patients/patients' && patientRoute(url).mode === 'view'); await waitRoute();
  const recordId = patientRoute(page.url()).id;
  await page.getByRole('link', {name: /Edit Contact/}).click();
  await page.waitForURL(url => patientRoute(url).mode === 'edit' && new URL(url).searchParams.get('section') === 'contact'); await waitRoute();
  const email = 'fictional.' + recordId + '@example.test';
  await page.locator('[data-field="email"] input').fill(email);
  const saved = page.waitForResponse(r => r.url().includes('/allyvora-api/patients/' + recordId) && r.request().method() === 'PUT');
  await page.getByRole('button', {name: /Save changes/}).click();
  if (!(await saved).ok()) throw new Error('Patient update failed');
  await page.waitForURL(url => patientRoute(url).mode === 'view'); await waitRoute();
  await page.reload(); await waitRoute();
  await page.getByText(email).first().waitFor();
  await page.locator('[data-activity]').getByText('Email').first().waitFor();
  flows.push({id: 'HCD-AV-04', scope: 'UI', result: 'Row opens the record; section deep link edits, saves with version, reload shows value and audit change'});

  // New registration with duplicate warning, rules drawer and session draft recovery.
  await visit('/allyvora-patients/patients/new');
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
  await clientNavigate('/allyvora-patients/patients', url => url.pathname === '/allyvora-patients/patients' && !url.searchParams.get('mode'));
  await clientNavigate('/allyvora-patients/patients/new', url => url.pathname === '/allyvora-patients/patients/new');
  await page.getByRole('button', {name: 'Restore draft'}).click();
  if (await page.locator('[data-field="givenName"] input').inputValue() !== 'Draftina') throw new Error('Draft was not restored');
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-signature-pad] canvas');
    return canvas && canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, i) => i % 4 === 3 && value > 0);
  });
  flows.push({id: 'HCD-AV-06', scope: 'UI', result: 'Duplicate warning, rules drawer jump and in-memory session draft restore including drawn signature'});
  await page.getByRole('button', {name: /Save patient/}).click();
  await page.getByText(/fields need attention/).first().waitFor();
  await fillRegistration(page, {given: 'Integration', family: 'Fictional', mobile: '9000012345'});
  const created = page.waitForResponse(r => r.url().endsWith('/allyvora-api/patients') && r.request().method() === 'POST');
  await page.getByRole('button', {name: /Save patient/}).click();
  const createdResponse = await created; if (createdResponse.status() !== 201) throw new Error('Registration failed ' + createdResponse.status());
  const patient = await createdResponse.json();
  await page.waitForURL(url => new URL(url).pathname === `/allyvora-patients/patients/${patient.id}`); await waitRoute();
  await page.locator('[data-record-summary]').getByText(patient.mrn).waitFor();
  flows.push({id: 'HCD-AV-07', scope: 'UI', result: 'Empty save reveals problems; keyboard quick pick advances focus; complete registration assigns branch MRN and opens the record'});

  // Continue the same newly created record through edit before changing its status.
  await page.getByRole('button', {name: 'Edit', exact: true}).click();
  await page.waitForURL(url => url.pathname === `/allyvora-patients/patients/${patient.id}/edit`);
  await waitRoute();
  await page.locator('[data-field="email"] input').fill('registered.patient@example.test');
  const newRecordSave = page.waitForResponse(r => r.url().endsWith(`/allyvora-api/patients/${patient.id}`) && r.request().method() === 'PUT');
  await page.getByRole('button', {name: /Save changes/}).click();
  if (!(await newRecordSave).ok()) throw new Error('New patient edit failed');
  await page.waitForURL(url => url.pathname === `/allyvora-patients/patients/${patient.id}`);
  await waitRoute();
  await page.reload(); await waitRoute();
  await page.getByText('registered.patient@example.test', {exact: true}).first().waitFor();
  flows.push({id: 'HCD-AV-07-edit', scope: 'UI', result: 'The newly registered patient is viewed, edited, saved and reloaded before its status changes'});

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
  flows.push({id: 'HCD-AV-08', scope: 'UI', result: 'Confirmed deactivate and reactivate through the status API with audit entries'});

  // Shared Forms controls persist through the healthcare preference service.
  await visit('/preferences');
  await page.getByRole('tab', {name:'Forms',exact:true}).click();
  await page.getByRole('heading', {name:'Forms',exact:true}).waitFor();
  for(const layout of ['scroll','tabs','wizard','stepper','accordion']) {
    const saved=page.waitForResponse(r=>r.url().endsWith('/api/preferences') && r.request().method()==='PUT');
    await page.getByRole('combobox',{name:'Record form style',exact:true}).selectOption(layout==='scroll'?'tabs':layout);
    if(!(await saved).ok()) throw new Error('Form preference save failed');
    if(layout==='scroll') await setPreferences({formNavigation:'scroll'});
    for(const mode of ['new','edit','view']) {
      await visit(mode==='new'?'/allyvora-patients/patients/new':`/allyvora-patients/patients/${patient.id}${mode==='edit'?'/edit':''}`);
      await page.locator(`[data-record-form="${mode}"] [data-layout="${layout}"]`).waitFor();
      if(mode==='new' && layout==='scroll') {
        const band=await page.locator('[data-record-summary]').boundingBox(),header=await page.locator('header').first().boundingBox();
        const topGap=band.y-header.y-header.height;
        if(band.height<65||band.height>73||Math.abs(topGap-8)>1)throw new Error(`Compact editor geometry changed: band ${band.height}px, top gap ${topGap}px`);
        flows.push({id:'HCD-AV-COMPACT',scope:'Chromium geometry',result:'Compact summary and editor top gap retained',bandHeight:band.height,topGap});
      }
      if(process.env.HEALTHCARE_SCREENSHOTS_DIR){mkdirSync(process.env.HEALTHCARE_SCREENSHOTS_DIR,{recursive:true});await page.screenshot({path:`${process.env.HEALTHCARE_SCREENSHOTS_DIR}/record-${mode}-${layout}.png`});}
      if(mode==='view' && await page.locator('[data-form-actions]').getByRole('button',{name:/^Save/}).count()) throw new Error('Read-only record exposes save');
    }
    await visit('/preferences');
    await page.getByRole('tab',{name:'Forms',exact:true}).click();
  }
  const headers={Authorization:'Bearer '+await token(),'X-Product-Id':'nexora'};
  const original=await (await page.request.get(base+'/api/preference-policy',{headers})).json();
  const locked=await page.request.put(base+'/api/preference-policy',{headers,data:{...original.policy,rules:{...original.policy.rules,formNavigation:{value:'stepper',locked:true}}}});
  if(!locked.ok())throw new Error('Tenant layout lock failed');
  try {
    await visit('/preferences');
    await page.getByRole('tab',{name:'Forms',exact:true}).click();
    if(!await page.getByRole('combobox',{name:'Record form style',exact:true}).isDisabled())throw new Error('Managed layout control is editable');
    await visit('/allyvora-patients/patients/new');
    await page.locator('[data-layout="stepper"]').waitFor();
  } finally {
    const current=await (await page.request.get(base+'/api/preference-policy',{headers})).json();
    const restored=await page.request.put(base+'/api/preference-policy',{headers,data:{...original.policy,revision:current.policy.revision}});
    if(!restored.ok())throw new Error('Policy restore failed');
  }
  await setPreferences({formNavigation:'scroll'});
  flows.push({id:'HCD-AV-09',scope:'UI + authenticated HTTP',result:'Preferences Forms, all five layouts in new/edit/view, read-only actions and an enforced tenant layout lock'});

  // Accessibility sweep in English, then Arabic RTL after a host preference change.
  const routes = ['/allyvora-patients/patients', '/allyvora-patients/patients?view=inactive', '/allyvora-patients/patients/new', `/allyvora-patients/patients/${patient.id}`, `/allyvora-patients/patients/${patient.id}/edit`, `/allyvora-patients/patients/${patient.id}/edit?section=consent`, '/preferences'];
  await axeSweep('default', routes);
  await setPreferences({language: 'ar', reducedMotion: true});
  await axeSweep('arabic-rtl-reduced-motion', routes.slice(0, 7));
  if (checks.filter(check => check.profile !== 'default').some(check => check.dir !== 'rtl')) throw new Error('Arabic routes did not render right to left');
  await setPreferences({language: 'en', reducedMotion: false});
  flows.push({id: 'HCD-AV-10', scope: 'HTTP setup + UI', result: 'Arabic RTL and reduced motion from the shared preference API apply to every module route'});

  // Former `?mode=` links still open the matching dedicated page.
  for (const [legacy, ready] of [['?mode=new', '[data-record-form="new"]'], [`?mode=view&id=${patient.id}`, '[data-patient-view]'], [`?mode=edit&id=${patient.id}&section=consent`, '[data-record-form="edit"] [data-section="consent"]']]) {
    await visit('/allyvora-patients/patients' + legacy);
    await page.locator(ready).first().waitFor();
  }
  flows.push({id: 'HCD-AV-11', scope: 'UI', result: 'Legacy ?mode=new|view|edit patient links open the dedicated create, record and edit pages'});
  await visit('/allyvora-patients/patients');



}
