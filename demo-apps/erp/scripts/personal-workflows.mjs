import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
/** Uses the caller's single owned browser, production Next server and real demo HTTP. */
export async function personalWorkflows({page, visit, flows, checks, capture, screenshot}) {
  const write = key => page.waitForResponse(response => response.url().includes('/api/view-state') && response.request().method() === 'PUT' && response.request().postDataJSON()?.key === key);
  for (const variant of ['erp1', 'erp2']) {
    await visit('/' + variant + '/masters/customers');
    if (variant === 'erp1') {const saved = write('keystone.mode.customers');await page.getByRole('radio', {name: 'Full table', exact: true}).click();assert.ok((await saved).ok());await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});}
    await page.locator('tbody tr').first().waitFor();
    const original = await page.locator('thead th').count();
    await page.locator('[data-tour=columns]').click();let dialog = page.getByRole('dialog');const hidden = dialog.locator('button[aria-pressed=true]').last();
    const columnsSaved = write('keystone.cols.customers');await hidden.click();const columnResponse = await columnsSaved;assert.ok(columnResponse.ok());assert.ok((await columnResponse.json()).value.length > 0);
    await dialog.getByRole('button', {name: 'Done', exact: true}).click();
    await page.locator('thead').getByRole('button', {name: 'Customer', exact: true}).click();
    await page.getByRole('textbox', {name: 'Search', exact: true}).fill('Fictional');
    await page.getByRole('combobox', {name: 'Status', exact: true}).selectOption('Active');
    await page.locator('[data-erp-advanced-filters]').click();await page.getByRole('spinbutton', {name: 'Credit limit min', exact: true}).fill('0');await page.getByRole('spinbutton', {name: 'Credit limit max', exact: true}).fill('10000000');
    await page.locator('[data-erp-saved-views]').click();dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', {name: 'View name'}).fill('Fictional personal customers');
    let saved = write('keystone.views.customers');await dialog.getByRole('button', {name: 'Save current view', exact: true}).click();let response = await saved;assert.ok(response.ok());
    const snapshot = (await response.json()).value.find(view => view.name === 'Fictional personal customers');assert.equal(snapshot.q, 'Fictional');assert.deepEqual(snapshot.filters.status, ['Active']);assert.deepEqual(snapshot.snapshot.sort, {key: 'name', direction: 'asc'});assert.deepEqual(snapshot.snapshot.criteria.creditLimit, {min: 0, max: 10000000});
    await dialog.getByRole('button', {name: 'Apply Fictional personal customers', exact: true}).click();
    await page.reload();if (variant === 'erp1') {await page.waitForFunction(() => document.querySelector('[data-erp-profile] [data-value=table]')?.getAttribute('aria-checked') === 'true');const back = page.getByRole('button', {name: 'Back', exact: true});if (await back.isVisible()) await back.click();}await page.locator('[data-erp-saved-views]').click();dialog = page.getByRole('dialog');
    await dialog.getByRole('button', {name: 'Apply Fictional personal customers', exact: true}).click();
    assert.equal(await page.getByRole('textbox', {name: 'Search', exact: true}).inputValue(), 'Fictional');
    // Applying a view refetches rows; an old row can disappear before the header assertion.
    // Wait for the unchanged column expectation on the completed render.
    await page.waitForFunction(expected => !document.querySelector('main [aria-busy="true"]') &&
      document.querySelectorAll('thead th').length === expected && document.querySelector('tbody tr'), original - 1);
    await page.locator('[data-erp-saved-views]').click();dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', {name: 'View name'}).fill('Fictional column set');saved = write('keystone.views.customers');await dialog.getByRole('button', {name: 'Save column set', exact: true}).click();response = await saved;assert.ok(response.ok());assert.equal((await response.json()).value.find(view => view.name === 'Fictional column set').snapshot.kind, 'columns');
    await dialog.getByRole('button', {name: 'Apply Fictional column set', exact: true}).click();await page.getByRole('button', {name: 'Reset filters', exact: true}).click();
    await page.locator('[data-erp-saved-views]').click();dialog = page.getByRole('dialog');await dialog.getByRole('button', {name: 'Apply Fictional column set', exact: true}).click();assert.equal(await page.getByRole('textbox', {name: 'Search', exact: true}).inputValue(), '');
    await page.locator('[data-erp-advanced-filters]').click();await page.addScriptTag({path: require.resolve('axe-core/axe.min.js')});
    let audit = await page.evaluate(() => window.axe.run(document));checks.push({path: new URL(page.url()).pathname, state: variant + '-advanced-filters', violations: audit.violations.map(item => ({id: item.id, targets: item.nodes.map(node => node.target)})), incomplete: audit.incomplete.length});
    await page.locator('[data-erp-saved-views]').click();dialog = page.getByRole('dialog');
    audit = await page.evaluate(() => window.axe.run(document));checks.push({path: new URL(page.url()).pathname, state: variant + '-personal-views', violations: audit.violations.map(item => ({id: item.id, targets: item.nodes.map(node => node.target)})), incomplete: audit.incomplete.length});
    if (screenshot) await capture(screenshot.replace('.png', '-' + variant + '-personal-views.png'));
    for (const name of ['Fictional personal customers', 'Fictional column set']) {saved = write('keystone.views.customers');await dialog.getByRole('button', {name: 'Delete ' + name, exact: true}).click();assert.ok((await saved).ok());}
    await page.keyboard.press('Escape');await page.locator('[data-tour=columns]').click();dialog = page.getByRole('dialog');saved = write('keystone.cols.customers');await dialog.getByRole('button', {name: 'Reset', exact: true}).click();assert.ok((await saved).ok());await dialog.getByRole('button', {name: 'Done', exact: true}).click();
    flows.push({id: variant + '-personal-views', scope: 'UI', result: 'Save account status/numeric-range/search/sort/columns, reload and apply, save/apply a column-only set without changing search, delete both snapshots; real HTTP accepted every write'});
  }
}
