import {expect, test} from 'vitest';
import {PAGE, hrefFor, pages, product, targetFromPath} from './navigation';

test.each([
  ['/patients', '', {pageId: PAGE.register}],
  ['/patients', 'mode=new', {pageId: PAGE.create, mode: 'new'}],
  ['/patients', 'mode=new&section=consent', {pageId: PAGE.create, mode: 'new', section: 'consent'}],
  ['/patients', 'mode=edit&id=12', {pageId: PAGE.register, mode: 'edit', recordId: '12'}],
  ['/patients', 'mode=edit&id=12&section=contact', {pageId: PAGE.register, mode: 'edit', recordId: '12', section: 'contact'}],
  ['/patients', 'mode=view&id=12', {pageId: PAGE.register, mode: 'view', recordId: '12'}],
  ['/patients', 'view=inactive&q=meera&page=2', {pageId: PAGE.register, query: 'view=inactive&q=meera&page=2'}],
  ['/settings/layout', '', {pageId: PAGE.layout}],
  ['/preferences', '', {pageId: PAGE.preferences}],
] as const)('source URL %s?%s resolves and round-trips', (path, query, expected) => {
  const target = targetFromPath(path, query);
  expect(target).toEqual(expected);
  const href = hrefFor(target), [hrefPath, hrefQuery = ''] = href.split('?');
  expect(targetFromPath(hrefPath!, hrefQuery)).toEqual(expected);
});

test('malformed ids, sections and unknown paths do not open a record', () => {
  expect(targetFromPath('/patients', 'mode=view&id=0')).toEqual({pageId: PAGE.register});
  expect(targetFromPath('/patients', 'mode=edit&id=1e3')).toEqual({pageId: PAGE.register});
  expect(targetFromPath('/patients', 'mode=edit&id=-4')).toEqual({pageId: PAGE.register});
  expect(targetFromPath('/patients', 'mode=edit&id=5&section=unknown')).toEqual({pageId: PAGE.register, mode: 'edit', recordId: '5'});
  expect(targetFromPath('/patients', 'tracking=1&view=today')).toEqual({pageId: PAGE.register, query: 'view=today'});
  expect(targetFromPath('/patients/12', '')).toEqual({pageId: 'not-found'});
  expect(targetFromPath('/settings', '')).toEqual({pageId: 'not-found'});
  expect(hrefFor({pageId: 'missing'})).toBe('/not-found');
  expect(targetFromPath('/', '')).toEqual({pageId: PAGE.register});
});

test('one module catalogues every page and gates actions by role', () => {
  expect(Object.keys(product.pages).sort()).toEqual(pages.map(page => page.id).sort());
  const items = product.modules['allyvora-patients']!.navigation.flatMap(section => section.items.map(item => item.pageId));
  expect(items).toEqual([PAGE.register, PAGE.create, PAGE.layout]);
  expect(product.access?.actions?.['configure-layout']).toEqual(['enterprise-admin', 'admin']);
  expect(pages.every(page => page.kind === 'preferences' || page.ai?.enabled === false)).toBe(true);
});
