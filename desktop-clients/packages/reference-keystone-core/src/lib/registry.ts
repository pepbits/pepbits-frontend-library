/*
 * Registry helpers shared by every Keystone variant. They take a PageDef and never hold
 * page data; each ERP package owns its own PAGES and supplies it through
 * KeystoneVariantProvider.
 */
import type { PageDef } from './types';

export const pagePath = (p: PageDef) => `/${p.section}/${p.slug}`;
export const recordPath = (p: PageDef, id: string, edit = false) => `${pagePath(p)}/${id}${edit ? '/edit' : ''}`;
export const newPath = (p: PageDef, query?: Record<string, string>) => `${pagePath(p)}/new${query ? `?${new URLSearchParams(query).toString()}` : ''}`;
/** "Customer master" -> "customer", "Sales orders" -> "sales order" */
export const nounOf = (def: PageDef) => def.title.replace(/ master$/i, '').replace(/s$/, '').replace(/ie$/, 'y').toLowerCase();
/** Small lookup masters are edited in a dialog over the list instead of a full page (ERP2). */
export const usesDialog = (def: PageDef) => ['grid', 'dependent', 'rate'].includes(def.template);
export const primaryField = (def: PageDef) => def.fields.find((x) => x.primary) ?? def.fields.find((x) => x.key === 'name') ?? def.fields[0];
export const listFields = (def: PageDef) => def.fields.filter((x) => x.list !== false && x.type !== 'textarea');
/** Columns shown the first time a wide list opens; the rest stay one click away in the column chooser. */
export const defaultHidden = (def: PageDef): string[] => {
  const all = listFields(def);
  if (all.length <= 9) return [];
  const keep = new Set<string>();
  const add = (f?: { key: string }) => f && keep.size < 9 && keep.add(f.key);
  add(all.find((f) => f.type === 'code'));
  add(all.find((f) => f.primary));
  add(all.find((f) => f.secondary));
  all.filter((f) => f.filter && (f.type === 'select' || f.type === 'city') && !f.secondary).slice(0, 2).forEach(add);
  add(all.find((f) => f.type === 'person' && !f.primary));
  all.filter((f) => f.type === 'currency' || f.type === 'percent').slice(0, 2).forEach(add);
  const status = all.find((f) => f.type === 'status');
  if (status) keep.add(status.key);
  return all.filter((f) => !keep.has(f.key)).map((f) => f.key);
};
export const findPageIn = (pages: readonly PageDef[], section?: string, slug?: string) => pages.find((p) => p.section === section && p.slug === slug);
export const ownerDefIn = (pages: readonly PageDef[], entity: string) => pages.find((p) => p.entity === entity && !p.view);
/** Approver shown against approval step `step` (1-based after the requester), from server lookups. */
export const approverAt = (def: PageDef, step: number): string => {
  const list = def.approvers ?? [];
  return list.length ? list[(step - 1) % list.length] : '';
};
