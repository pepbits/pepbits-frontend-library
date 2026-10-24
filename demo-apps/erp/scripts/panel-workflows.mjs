import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

/** Caller owns the single browser/API/Next lifecycle. These commands use real local HTTP. */
export async function panelWorkflows({page, visit, flows, checks, capture, screenshot}) {
  const acknowledged = async row => page.waitForFunction(version => document.querySelector('[data-erp-record]')?.getAttribute('data-erp-record-version') === String(version), row.version);
  const record = (id, result) => flows.push({id, scope: 'UI', result});
  const shot = async name => {if (screenshot) await capture(screenshot.replace('.png', '-' + name + '.png'));};
  const audit = async id => {
    await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]'));
    await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running' || animation.effect?.getComputedTiming().iterations === Infinity));
    await page.addScriptTag({path: require.resolve('axe-core/axe.min.js')});
    const result = await page.evaluate(() => window.axe.run(document));
    checks.push({path: new URL(page.url()).pathname, state: id, violations: result.violations.map(item => ({id: item.id, targets: item.nodes.map(node => node.target)})), incomplete: result.incomplete.length});
  };
  for (const variant of ['erp1', 'erp2']) {
    await visit('/' + variant + '/masters/customers');
    if (variant === 'erp2') await page.locator('tbody tr').first().locator('td').nth(2).click();
    await page.locator('[data-profile-summary]').waitFor();await page.getByRole('heading', {name: 'Documents', exact: true}).waitFor();
    await page.getByText('Selected on this screen only — not uploaded or saved.', {exact: true}).waitFor();
    await page.locator('input[type=file]').setInputFiles({name: 'Fictional local terms.txt', mimeType: 'text/plain', buffer: Buffer.from('Fictional local selection')});
    await page.getByRole('button', {name: 'Remove Fictional local terms.txt', exact: true}).click();
    assert.equal(await page.getByRole('list', {name: 'Selected files', exact: true}).locator('li').count(), 0);
    await audit(variant + '-profile-details');await shot(variant + '-profile-panels');
    record(variant + '-profile-panels', 'Source field groups, statistics, HTTP support metadata and explicitly local file selection/removal');

    for (const slug of ['support-tickets', 'maintenance-requests']) {
      await visit('/' + variant + '/transactions/' + slug);
      const card = page.locator('[data-board-item]').first();await card.waitFor();const id = await card.getAttribute('data-board-item');await card.getByRole('button').click();
      const comment = 'Fictional ' + variant + ' ' + slug + ' panel reply';
      await page.getByRole('textbox', {name: 'Add an update or reply', exact: true}).fill(comment);
      const saved = page.waitForResponse(response => response.url().includes('/entities/' + slug + '/' + id) && response.request().method() === 'PUT');
      await page.getByRole('button', {name: 'Post update', exact: true}).click();const response = await saved;assert.ok(response.ok());const row = await response.json();assert.equal(row.activity.at(-1).text, comment);
      await page.locator('[data-case-conversation]').getByText(comment, {exact: true}).waitFor();
      const pending = 'Fictional unsent reply retained across property saves', assignee = 'Fictional panel assignee', assigneeInput = page.getByRole('textbox', {name: slug === 'support-tickets' ? 'Assignee' : 'Technician', exact: true});
      await page.getByRole('textbox', {name: 'Add an update or reply', exact: true}).fill(pending);await assigneeInput.fill(assignee);
      const priority = page.getByRole('combobox', {name: 'Priority', exact: true});await priority.locator('option').nth(1).waitFor({state: 'attached'});const options = await priority.locator('option').evaluateAll(nodes => nodes.map(node => node.value)), next = options.find(option => option && option !== row.priority);
      assert.ok(next);const changed = page.waitForResponse(response => response.url().includes('/entities/' + slug + '/' + id) && response.request().method() === 'PUT');await priority.selectOption(next);const priorityRow = await (await changed).json();assert.equal(priorityRow.priority, next);await acknowledged(priorityRow);assert.equal(await page.getByRole('textbox', {name: 'Add an update or reply', exact: true}).inputValue(), pending);assert.equal(await assigneeInput.inputValue(), assignee);
      const assigned = page.waitForResponse(response => response.url().includes('/entities/' + slug + '/' + id) && response.request().method() === 'PUT');await page.getByRole('button', {name: 'Save assignee', exact: true}).click();const assignedRow = await (await assigned).json();assert.equal(assignedRow.assignee, assignee);await acknowledged(assignedRow);assert.equal(await page.getByRole('textbox', {name: 'Add an update or reply', exact: true}).inputValue(), pending);await page.getByRole('textbox', {name: 'Add an update or reply', exact: true}).fill('');
      await page.reload();
      if (variant === 'erp1') {await page.locator('[data-board-item="' + id + '"]').getByRole('button').click();}
      await page.locator('[data-case-conversation]').getByText(comment, {exact: true}).waitFor();
      await audit(variant + '-' + slug + '-conversation');if (slug === 'support-tickets') await shot(variant + '-conversation');
      record(variant + '-' + slug + '-conversation', 'Post update, change priority and save assignee while preserving other unsent panel inputs, then reload conversation through real HTTP');
    }

    await visit('/' + variant + '/transactions/appointments');await page.getByRole('radio', {name: 'List', exact: true}).click();await page.locator('tbody tr').first().locator('td').nth(2).click();
    await page.getByRole('heading', {name: 'Resource schedule', exact: true}).waitFor();await page.getByRole('button', {name: 'Open schedule', exact: true}).waitFor();
    await audit(variant + '-booking-context');await shot(variant + '-booking-context');
    record(variant + '-booking-context', 'Booking record shows live day/resource context and schedule navigation');

    await visit('/' + variant + '/transactions/purchase-orders');await page.locator('tbody tr').first().locator('td').nth(2).click();await page.getByRole('heading', {name: 'Summary', exact: true}).waitFor();await page.getByRole('heading', {name: 'History', exact: true}).waitFor();
    await audit(variant + '-document-context');record(variant + '-document-context', 'Document summary, support history and metadata panels loaded through HTTP');
  }
  await visit('/erp2/masters/chart-of-accounts');const name = 'Fictional erp2 child account updated';
  await page.getByRole('textbox', {name: 'Search the tree', exact: true}).fill(name);await page.locator('[data-hierarchy]').getByRole('button', {name, exact: true}).click();
  await page.getByRole('navigation', {name: 'Position in hierarchy', exact: true}).waitFor();assert.ok((await page.getByRole('navigation', {name: 'Position in hierarchy', exact: true}).getByRole('button').count()) >= 3);
  await audit('erp2-tree-record');await shot('erp2-tree-record');
  await page.getByRole('button', {name: 'Delete', exact: true}).click();const removed = page.waitForResponse(response => response.url().includes('/entities/chart-of-accounts/') && response.request().method() === 'DELETE');await page.getByRole('button', {name: 'Confirm delete', exact: true}).click();assert.ok((await removed).ok());await page.locator('[data-hierarchy]').waitFor();
  record('erp2-tree-record', 'Record breadcrumbs and child context, followed by explicitly confirmed leaf deletion through HTTP');
}
