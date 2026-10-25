import {act, waitFor} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import axe from 'axe-core';
import {renderSettle} from './test/host';
import {hrefFor, targetFromPath} from './navigation';

/** Every Settle route (and each report/print variant) under default preferences, Arabic RTL, reduced
 * motion and a tenant-locked preference; axe-core must report no violations. Colour contrast is
 * checked in Chromium by the integration script (jsdom has no layout/colour computation). */
export const ROUTES: [string, string][] = [
  ['/', 'Needs your attention'],
  ['/bills', 'Every bill across visits'],
  ['/bills/BL002001', 'BL002001'],
  ['/bills/BN001002', 'BN001002'],
  ['/patients', 'Patient accounts'],
  ['/patients/MR240107', 'Deposit balance'],
  ['/receipts', 'Receipts'],
  ['/receipts?unrealized=1&kind=deposit', 'Receipts'],
  ['/approvals', 'Approvals'],
  ['/day-close', 'Day close'],
  ...(['collections', 'payment-consolidated', 'patient-dues', 'sponsor-dues', 'outstanding-deposits', 'reward-points', 'finance-postings'].map(r => ['/reports?r=' + r, 'Reports'] as [string, string])),
  ['/audit', 'Audit trail'],
  ['/settings', 'Settings'],
  ...(['counters', 'number-series', 'discount-categories', 'rate-plans', 'users', 'preferences'].map(section => ['/settings?s=' + section, 'Settings'] as [string, string])),
  ['/print/bill/BL002001', 'Interim bill'],
  ['/print/bill/BL002001?detail=1', 'Itemized statement'],
  ['/print/receipt/RC000001', 'Number'],
  ['/preferences', ''],
];
const PROFILES = [
  ['default', {}, {}],
  ['Arabic RTL', {language: 'ar'}, {}],
  ['reduced motion', {reducedMotion: true}, {}],
  ['locked density', {density: 'spacious'}, {density: {value: 'compact', locked: true}}],
] as const;

describe.each(PROFILES)('%s', (profile, overrides, rules) => {
  it.each(ROUTES)('%s renders', async (path, text) => {
    const {container} = renderSettle(path, {overrides, rules});
    await waitFor(() => expect(container.querySelector('[data-page-id]')).toBeTruthy());
    if (text && (profile !== 'Arabic RTL' || /\d/.test(text))) await waitFor(() => expect(container.textContent).toContain(text));
    await waitFor(() => expect(container.querySelector('[data-skeleton],[aria-busy="true"]')).toBeNull());
    if (path !== '/preferences') await waitFor(() => expect(container.textContent).toContain('Priya Nair'));
    if (profile === 'Arabic RTL') await waitFor(() => expect(container.querySelector('.settle-app,[dir="rtl"]')?.closest('[dir="rtl"]')).toBeTruthy());
    if (profile === 'locked density' && path !== '/preferences' && container.querySelector('table.tbl')) expect(container.querySelector('table.tbl')!.getAttribute('data-density')).toBe('compact');
    const [p, q] = path.split('?');
    expect(hrefFor(targetFromPath(p!, q ?? ''))).toBe(path);
    await act(async () => {expect((await axe.run(container, {rules: {'color-contrast': {enabled: false}}})).violations.map(v => v.id + ' ' + v.nodes.map(n => n.target.join(' ')).join(' | '))).toEqual([]);});
  });
});

it('unknown and malformed paths are not found', () => {
  for (const path of ['/nope', '/bills/a/b', '/bills/%2F', '/print/bill', '/patients/%E0%A4%A']) expect(targetFromPath(path).pageId).toBe('not-found');
});
