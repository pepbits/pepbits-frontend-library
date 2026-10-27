import {canProductAction, productForRole} from '@pepbits/shell';
import {expect, test} from 'vitest';
import {PAGE, MODULE_ID} from './routes';
import {hrefFor, pages, product, targetFromPath} from '../../navigation';

test.each([
  ['/allyvora-patients/patients', '', {pageId: PAGE.register}],
  ['/allyvora-patients/patients', 'mode=new', {pageId: PAGE.create, mode: 'new'}],
  ['/allyvora-patients/patients', 'mode=new&section=consent', {pageId: PAGE.create, mode: 'new', section: 'consent'}],
  ['/allyvora-patients/patients', 'mode=edit&id=12', {pageId: PAGE.edit, mode: 'edit', recordId: '12'}],
  ['/allyvora-patients/patients', 'mode=edit&id=12&section=contact', {pageId: PAGE.edit, mode: 'edit', recordId: '12', section: 'contact'}],
  ['/allyvora-patients/patients', 'mode=view&id=12', {pageId: PAGE.view, mode: 'view', recordId: '12'}],
  ['/allyvora-patients/patients/new', '', {pageId: PAGE.create, mode: 'new'}],
  ['/allyvora-patients/patients/new', 'section=consent', {pageId: PAGE.create, mode: 'new', section: 'consent'}],
  ['/allyvora-patients/patients/12', '', {pageId: PAGE.view, mode: 'view', recordId: '12'}],
  ['/allyvora-patients/patients/12/edit', '', {pageId: PAGE.edit, mode: 'edit', recordId: '12'}],
  ['/allyvora-patients/patients/12/edit', 'section=contact', {pageId: PAGE.edit, mode: 'edit', recordId: '12', section: 'contact'}],
  ['/allyvora-patients/patients', 'view=inactive&q=meera&page=2', {pageId: PAGE.register, query: 'view=inactive&q=meera&page=2'}],
  ['/preferences', '', {pageId: PAGE.preferences, query: ''}],
  ['/allyvora-patients/visits/new', '', {pageId: PAGE.startVisit}],
  ['/allyvora-patients/visits/new', 'patient=12', {pageId: PAGE.startVisit, recordId: '12'}],
  ['/allyvora-patients/emergency', '', {pageId: PAGE.emergency}],
] as const)('URL %s?%s resolves and round-trips', (path, query, expected) => {
  const target = targetFromPath(path, query);
  expect(target).toEqual(expected);
  const href = hrefFor(target), [hrefPath, hrefQuery = ''] = href.split('?');
  expect(targetFromPath(hrefPath!, hrefQuery)).toEqual(expected);
});

test('malformed ids, sections and removed layout setup do not open a record', () => {
  expect(targetFromPath('/allyvora-patients/settings/layout')).toEqual({pageId:'not-found'});
  expect(targetFromPath('/allyvora-patients/patients', 'mode=view&id=0')).toEqual({pageId: PAGE.register});
  expect(targetFromPath('/allyvora-patients/patients', 'mode=edit&id=1e3')).toEqual({pageId: PAGE.register});
  expect(targetFromPath('/allyvora-patients/patients', 'mode=edit&id=-4')).toEqual({pageId: PAGE.register});
  expect(targetFromPath('/allyvora-patients/patients', 'mode=edit&id=5&section=unknown')).toEqual({pageId: PAGE.edit, mode: 'edit', recordId: '5'});
  expect(targetFromPath('/allyvora-patients/patients', 'tracking=1&view=today')).toEqual({pageId: PAGE.register, query: 'view=today'});
  for (const path of ['/allyvora-patients/patients/abc', '/allyvora-patients/patients/0', '/allyvora-patients/patients/0/edit', '/allyvora-patients/patients/1e3/edit', '/allyvora-patients/patients/-4', '/allyvora-patients/patients/12/extra', '/allyvora-patients/patients/12/edit/more', '/allyvora-patients/patients/new/edit'])
    expect(targetFromPath(path, '')).toEqual({pageId: 'not-found'});
  expect(targetFromPath('/allyvora-patients/patients/12/edit', 'section=unknown')).toEqual({pageId: PAGE.edit, mode: 'edit', recordId: '12'});
  expect(targetFromPath('/allyvora-patients/settings', '')).toEqual({pageId: 'not-found'});
  
  expect(targetFromPath('/allyvora-patients', '')).toEqual({pageId: PAGE.register});
});

test('legacy ?mode= links resolve to the dedicated pages and are rewritten to their URLs', () => {
  const legacy = (query: string) => hrefFor(targetFromPath('/allyvora-patients/patients', query));
  expect(legacy('mode=new')).toBe('/allyvora-patients/patients/new');
  expect(legacy('mode=new&section=consent')).toBe('/allyvora-patients/patients/new?section=consent');
  expect(legacy('mode=view&id=12')).toBe('/allyvora-patients/patients/12');
  expect(legacy('mode=edit&id=12')).toBe('/allyvora-patients/patients/12/edit');
  expect(legacy('mode=edit&id=12&section=contact')).toBe('/allyvora-patients/patients/12/edit?section=contact');
  expect(hrefFor({pageId: PAGE.view})).toBe('/allyvora-patients/patients/[id]');
  expect(hrefFor({pageId: PAGE.edit})).toBe('/allyvora-patients/patients/[id]/edit');
});


test('healthcare adds exactly one app with five destinations and leaves suite routes intact', () => {
  // 14 modules plus AllyVora Outpatient and AllyVora Emergency (modules/outpatient and modules/emergency, their own routes and tests).
  expect(Object.keys(product.modules)).toHaveLength(16);
  expect(product.modules['reference-allyvora-outpatient']?.label).toBe('AllyVora Outpatient');
  expect(product.modules['reference-allyvora-emergency']?.label).toBe('AllyVora Emergency');
  const module = product.modules[MODULE_ID]!;
  expect(module.label).toBe('AllyVora Patients');
  expect(module.shortLabel).toBe('Patients');
  expect(module.navigation.flatMap(section => section.items.map(item => item.pageId))).toEqual([PAGE.register, PAGE.create, PAGE.startVisit, PAGE.emergency]);
  expect(new Set(pages.map(page => page.id)).size).toBe(pages.length);
  expect(targetFromPath('/suite/patients').pageId).toBe('suite-patients');
  expect(hrefFor({pageId: 'suite-patients'})).toBe('/suite/patients');
});

test.each(['enterprise-admin','admin','operations-analyst','finance-manager','viewer'])('registration actions retain standalone UI grants for %s on the single host', role => {
  const resolved = productForRole(product, role);
  for(const action of ['allyvora-create','allyvora-edit','allyvora-archive'])expect(canProductAction(resolved, action)).toBe(role !== 'viewer');
  if(role === 'finance-manager')expect(canProductAction(resolved, 'create')).toBe(false);
});
