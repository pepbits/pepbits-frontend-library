/** Interaction scenarios: each opens a real state (palette, scope menu, detail, dialogs, drawer, combobox, board panel) so its controls are measured too. */
export const SCENARIOS = [
  {name: 'command palette', route: '/', run: async page => { await page.getByRole('button', {name: /Jump anywhere/}).click(); await page.getByRole('dialog', {includeHidden: true}).waitFor(); await page.keyboard.type('inv'); await page.waitForTimeout(250); }},
  {name: 'scope menu', route: '/', run: async page => { await page.getByRole('button', {name: /Scope:/}).click(); await page.getByRole('menu').waitFor(); }},
  {name: 'ledger with invoice detail (document, figures, status path, actions)', route: '/w/invoices?open=7', run: async page => { await page.getByRole('button', {name: 'Issue invoice'}).waitFor(); }},
  {name: 'invoice detail: details and activity tabs', route: '/w/invoices?open=7', run: async page => { await page.getByRole('tab', {name: 'Details'}).click(); await page.getByRole('tab', {name: /Activity/}).click(); await page.waitForTimeout(150); }},
  {name: 'invoice edit form (filled inputs, selects, lines editor)', route: '/w/invoices?open=7', run: async page => { await page.getByRole('button', {name: /Edit/}).click(); await page.getByRole('tab', {name: 'Details'}).click(); await page.waitForTimeout(250); }},
  {name: 'action dialog with required reason (modal, textarea, disabled confirm)', route: '/w/coverages?open=21', run: async page => { await page.getByRole('button', {name: 'Reject coverage'}).click(); await page.getByRole('dialog').waitFor(); }},
  {name: 'action dialog with typed reason', route: '/w/coverages?open=21', run: async page => { await page.getByRole('button', {name: 'Reject coverage'}).click(); const d = page.getByRole('dialog'); await d.getByLabel(/Reason/).fill('Card expired'); await page.waitForTimeout(150); }},
  {name: 'new coverage drawer: validation, select, uppercase text, combobox open', route: '/w/coverages?new=1', run: async page => { const d = page.getByRole('dialog'); await d.getByLabel(/Member ID/).fill('ab1'); await d.getByRole('combobox', {name: /Patient/}).click(); await page.waitForTimeout(400); }},
  {name: 'new invoice drawer: money, date, lines editor', route: '/w/invoices?new=1', run: async page => { const d = page.getByRole('dialog'); await d.getByRole('button', {name: 'Add row'}).click(); await page.waitForTimeout(200); }},
  {name: 'board with open card', route: '/w/claims', run: async page => { await page.locator('[data-rcm-board] button').first().click(); await page.waitForTimeout(300); }},
  {name: 'queue worklist filters: chips, overdue, search typed', route: '/w/coverages', run: async page => { await page.getByLabel('Search').fill('abc'); await page.waitForTimeout(350); }},
  {name: 'approvals: waiting tab', route: '/approvals', run: async page => { await page.getByRole('tab', {name: /Waiting/}).click(); await page.waitForTimeout(150); }},
];
