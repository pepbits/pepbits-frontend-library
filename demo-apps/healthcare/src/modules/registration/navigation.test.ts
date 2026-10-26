import {canProductAction, productForRole} from '@pepbits/shell';
import {expect, test} from 'vitest';
import {PAGE, MODULE_ID} from './routes';
import {hrefFor, pages, product, targetFromPath} from '../../navigation';

test.each([
  ['/allyvora-patients/patients', '', {pageId: PAGE.register}],
  ['/allyvora-patients/patients', 'mode=new', {pageId: PAGE.create, mode: 'new'}],
  ['/allyvora-patients/patients', 'mode=new&section=consent', {pageId: PAGE.create, mode: 'new', section: 'consent'}],
  ['/allyvora-patients/patients', 'mode=edit&id=12', {pageId: PAGE.register, mode: 'edit', recordId: '12'}],
  ['/allyvora-patients/patients', 'mode=edit&id=12&section=contact', {pageId: PAGE.register, mode: 'edit', recordId: '12', section: 'contact'}],
  ['/allyvora-patients/patients', 'mode=view&id=12', {pageId: PAGE.register, mode: 'view', recordId: '12'}],
  ['/allyvora-patients/patients', 'view=inactive&q=meera&page=2', {pageId: PAGE.register, query: 'view=inactive&q=meera&page=2'}],
  ['/allyvora-patients/settings/layout', '', {pageId: PAGE.layout}],
  ['/preferences', '', {pageId: PAGE.preferences, query: ''}],
] as const)('source URL %s?%s resolves and round-trips', (path, query, expected) => {
  const target = targetFromPath(path, query);
  expect(target).toEqual(expected);
  const href = hrefFor(target), [hrefPath, hrefQuery = ''] = href.split('?');
  expect(targetFromPath(hrefPath!, hrefQuery)).toEqual(expected);
});

test('malformed ids, sections and unknown paths do not open a record', () => {
  expect(targetFromPath('/allyvora-patients/patients', 'mode=view&id=0')).toEqual({pageId: PAGE.register});
  expect(targetFromPath('/allyvora-patients/patients', 'mode=edit&id=1e3')).toEqual({pageId: PAGE.register});
  expect(targetFromPath('/allyvora-patients/patients', 'mode=edit&id=-4')).toEqual({pageId: PAGE.register});
  expect(targetFromPath('/allyvora-patients/patients', 'mode=edit&id=5&section=unknown')).toEqual({pageId: PAGE.register, mode: 'edit', recordId: '5'});
  expect(targetFromPath('/allyvora-patients/patients', 'tracking=1&view=today')).toEqual({pageId: PAGE.register, query: 'view=today'});
  expect(targetFromPath('/allyvora-patients/patients/12', '')).toEqual({pageId: 'not-found'});
  expect(targetFromPath('/allyvora-patients/settings', '')).toEqual({pageId: 'not-found'});
  
  expect(targetFromPath('/allyvora-patients', '')).toEqual({pageId: PAGE.register});
});


test('healthcare adds exactly one app with three destinations and leaves suite routes intact', () => {
  expect(Object.keys(product.modules)).toHaveLength(14);
  const module = product.modules[MODULE_ID]!;
  expect(module.label).toBe('AllyVora Patients');
  expect(module.shortLabel).toBe('Patients');
  expect(module.navigation.flatMap(section => section.items.map(item => item.pageId))).toEqual([PAGE.register, PAGE.create, PAGE.layout]);
  expect(new Set(pages.map(page => page.id)).size).toBe(pages.length);
  expect(targetFromPath('/suite/patients').pageId).toBe('suite-patients');
  expect(hrefFor({pageId: 'suite-patients'})).toBe('/suite/patients');
});

test.each(['enterprise-admin','admin','operations-analyst','finance-manager','viewer'])('registration actions retain standalone UI grants for %s on the single host', role => {
  const resolved = productForRole(product, role);
  for(const action of ['allyvora-create','allyvora-edit','allyvora-archive'])expect(canProductAction(resolved, action)).toBe(role !== 'viewer');
  expect(canProductAction(resolved, 'allyvora-configure-layout')).toBe(['enterprise-admin','admin'].includes(role));
  if(role === 'finance-manager')expect(canProductAction(resolved, 'create')).toBe(false);
});
