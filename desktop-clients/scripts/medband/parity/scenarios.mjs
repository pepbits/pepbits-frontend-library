/**
 * Interaction scenarios for the parity measurement: each opens a real state of the module (popover, dialog, palette, validation,
 * toast, filled controls) so the controls in it are measured against the original stylesheet, not only the resting page.
 */
export const SCENARIOS = [
  {name: 'command palette', route: '/', run: async page => { await page.getByRole('button', {name: /Search patient/i}).first().click(); await page.getByRole('dialog').waitFor(); await page.keyboard.type('Asha'); await page.waitForTimeout(250); }},
  {name: 'registration: validation, filled controls, segments, checkbox', route: '/patients/new', run: async page => {
    await page.getByLabel(/First name/).fill('Synthetic'); await page.getByRole('radio').nth(1).click(); await page.getByRole('button', {name: 'Next', exact: true}).click(); await page.waitForTimeout(250);
    const vip = page.getByRole('checkbox').first(); if (await vip.count()) await vip.check({force: true});
  }},
  {name: 'registration: error toast from a failed write', route: '/patients/new', run: async page => {
    await page.getByLabel(/First name/).fill('Synthetic'); await page.getByLabel(/Last name/).fill('Toast'); await page.getByLabel(/Date of birth/).fill('1992-02-03');
    await page.getByRole('button', {name: 'Next', exact: true}).click(); await page.getByLabel(/Mobile phone/).fill('+971500000001');
    await page.getByRole('button', {name: 'Next', exact: true}).click(); await page.getByRole('radio', {name: 'Self pay', exact: true}).click();
    await page.getByRole('button', {name: 'Next', exact: true}).click(); await page.getByRole('button', {name: /Save patient/}).click(); await page.getByRole('alert').first().waitFor({timeout: 4000}).catch(() => {});
  }},
  {name: 'patient search: insurance multiselect open with filter', route: '/patients', run: async page => {
    await page.getByRole('radio').nth(1).click(); await page.waitForTimeout(150);
    await page.getByRole('button', {name: 'Insurers'}).click(); await page.waitForTimeout(150); await page.keyboard.type('Pay');
  }},
  {name: 'patient search: care section chips', route: '/patients', run: async page => { await page.getByRole('radio').nth(2).click(); await page.waitForTimeout(150); const chip = page.locator('button.rounded-full').first(); if (await chip.count()) await chip.click(); }},
  {name: 'patient record: new-episode dialog', route: '/patients/pat-1', run: async page => { await page.getByRole('button', {name: /New episode/}).click(); await page.getByRole('dialog').waitFor(); }},
  {name: 'patient record: coverage dialog', route: '/patients/pat-1', run: async page => { await page.getByRole('button', {name: 'Manage'}).click(); await page.getByRole('dialog').waitFor(); }},
  {name: 'admissions: pending tab', route: '/admissions', run: async page => { await page.getByRole('radio', {name: /Pending/}).click(); await page.waitForTimeout(200); }},
];
