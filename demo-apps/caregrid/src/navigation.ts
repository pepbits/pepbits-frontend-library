import {BarChart3, Boxes, CalendarPlus, CalendarRange, CalendarX2, ConciergeBell, LayoutDashboard, LibraryBig, LifeBuoy, Pill, Users, type IconComponent} from '@pepbits/icons';
import {defineProduct, type ShellNavigation} from '@pepbits/shell';
import type {PageDefinition} from '@pepbits/page-engines/types';
import type {NavigationTarget} from '@pepbits/platform/navigation';
import {API_PRODUCT} from './adapters/http';

export type CaregridTarget = NavigationTarget & {query?: string};
interface Destination {id: string; path: string; title: string; subtitle: string; section: string; icon: IconComponent}
/** The eleven source screens, at their original paths. */
export const DESTINATIONS: readonly Destination[] = [
  {id: 'caregrid-dashboard', path: '/', title: 'Command center', subtitle: 'Today across every department', section: 'Today', icon: LayoutDashboard},
  {id: 'caregrid-book', path: '/book', title: 'Book', subtitle: 'Patient, service, time', section: 'Today', icon: CalendarPlus},
  {id: 'caregrid-schedule', path: '/schedule', title: 'Schedule board', subtitle: 'Every resource as a timeline', section: 'Today', icon: CalendarRange},
  {id: 'caregrid-frontdesk', path: '/frontdesk', title: 'Front desk', subtitle: 'Patient flow, waitlist and reminders', section: 'Today', icon: ConciergeBell},
  {id: 'caregrid-exceptions', path: '/exceptions', title: 'Availability and blocks', subtitle: 'Leave, maintenance and the reschedule queue', section: 'Planning', icon: CalendarX2},
  {id: 'caregrid-resources', path: '/resources', title: 'Resources', subtitle: 'Directory and weekly working hours', section: 'Planning', icon: Boxes},
  {id: 'caregrid-catalog', path: '/catalog', title: 'Service catalog', subtitle: 'Services, resource segments and rules', section: 'Planning', icon: LibraryBig},
  {id: 'caregrid-patients', path: '/patients', title: 'Patients', subtitle: 'Fictional demo records', section: 'Records', icon: Users},
  {id: 'caregrid-pharmacy', path: '/pharmacy', title: 'Pharmacy desk', subtitle: 'Pickups, refills and deliveries', section: 'Records', icon: Pill},
  {id: 'caregrid-insights', path: '/insights', title: 'Insights', subtitle: 'Slot-length advice and utilization', section: 'Analysis', icon: BarChart3},
  {id: 'caregrid-help', path: '/help', title: 'Help center', subtitle: 'Concepts, screen guides and shortcuts', section: 'Support', icon: LifeBuoy},
];
export const pages: PageDefinition[] = [
  ...DESTINATIONS.map(d => ({id: d.id, title: d.title, subtitle: d.subtitle, kind: 'caregrid', module: 'caregrid', icon: d.icon, ai: {enabled: false, useCases: []}})),
  {id: 'preferences', title: 'Preferences', subtitle: '', kind: 'preferences', module: 'shared'},
];
const sections = [...new Set(DESTINATIONS.map(d => d.section))];
const navigation: ShellNavigation = {
  defaultModule: 'caregrid', pages: Object.fromEntries(pages.map(p => [p.id, p])),
  modules: {caregrid: {id: 'caregrid', label: 'CareGrid', shortLabel: 'CareGrid', description: 'Fictional scheduling and resource planning', icon: CalendarRange, accent: 'var(--primary)',
    navigation: sections.map(section => ({id: 'caregrid-' + section.toLowerCase(), label: section, items: DESTINATIONS.filter(d => d.section === section).map(d => ({id: d.id, pageId: d.id, label: d.title, icon: d.icon}))}))}},
};
/**
 * The shell gates the session; these action grants only shape the UI. The unchanged scheduling
 * API has no authorization of its own, so write controls are presentation gating, not security.
 */
export const WRITE_ROLES = ['admin', 'enterprise-admin', 'operations', 'operations-analyst', 'medslot-admin', 'medslot-scheduler'];
export const product = defineProduct({id: API_PRODUCT, name: 'CareGrid', tagline: 'Fictional scheduling demonstration', navigation, defaultModule: 'caregrid', enabledModules: ['caregrid'],
  access: {actions: {create: WRITE_ROLES, edit: WRITE_ROLES, delete: WRITE_ROLES, export: WRITE_ROLES}}});
export const caregridProductForRole = (_role: string) => product;

export function targetFromPath(pathname: string, query = ''): CaregridTarget {
  if (pathname === '/preferences') return {pageId: 'preferences'};
  const path = pathname === '/login' ? '/' : pathname.replace(/\/$/, '') || '/';
  const destination = DESTINATIONS.find(d => d.path === path);
  return destination ? {pageId: destination.id, ...(query ? {query} : {})} : {pageId: 'not-found'};
}
export function hrefFor(target: CaregridTarget): string {
  if (target.pageId === 'preferences') return '/preferences';
  const destination = DESTINATIONS.find(d => d.id === target.pageId);
  if (!destination) return '/not-found';
  return destination.path + (target.query ? '?' + target.query : '');
}
/** Open a destination with source query parameters (empty values are dropped). */
export function to(pageId: string, params: Record<string, string | number | null | undefined> = {}): CaregridTarget {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])).toString();
  return {pageId, ...(query ? {query} : {})};
}
