import {describe, expect, it} from 'vitest';
import {hrefFor, pages, product, SETTLE_PAGES, targetFromPath} from './navigation';

describe('Settle navigation', () => {
  it('registers one page-engine page per source screen plus preferences', () => {
    expect(SETTLE_PAGES.map(p => p.path)).toEqual(['/', '/bills', '/patients', '/receipts', '/day-close', '/approvals', '/reports', '/audit', '/settings', '/bills/:id', '/patients/:id', '/print/bill/:id', '/print/receipt/:id']);
    expect(pages.filter(p => p.kind === 'settle')).toHaveLength(13);
    expect(pages.every(p => !p.ai?.enabled)).toBe(true);
  });
  it('keeps the source sidebar groups in the shell module', () => {
    expect(product.modules.settle!.navigation.map(s => [s.label, s.items.map(i => i.label)])).toEqual([
      ['Work', ['Desk', 'Bills', 'Patient accounts']], ['Money', ['Receipts', 'Day close']], ['Control', ['Approvals', 'Reports', 'Audit trail']], ['Admin', ['Settings']],
    ]);
  });
  it('round-trips deep links with record identity and query', () => {
    for (const path of ['/', '/bills?status=F&due=patient', '/bills/BL002001', '/patients/MR240107', '/receipts?open=RC000001', '/print/bill/BL002001?detail=1', '/print/receipt/DP000001', '/preferences']) {
      const [p, q] = path.split('?');
      expect(hrefFor(targetFromPath(p!, q ?? ''))).toBe(path);
    }
    expect(targetFromPath('/bills/BL002001')).toEqual({pageId: 'settle-bill', recordId: 'BL002001'});
    expect(targetFromPath('/login')).toEqual({pageId: 'settle-desk'});
  });
});
