/*
 * Port of lumen-reports src/components/shell/nav.ts as data for the HOST shell. The module renders no
 * sidebar or header of its own; a host shows these entries in its existing navigation. Visibility is a
 * convenience only: every loader and endpoint enforces the permission on the server.
 */
import {
  Blocks, CalendarClock, Database, FolderDown, Home, KeyRound, LayoutDashboard, Library, MailPlus, ScrollText, Send, Settings, ShieldCheck, Users,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from './types';

export interface ReportsNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perm?: Permission;
}

export const REPORTS_NAVIGATION: { section: string; items: ReportsNavItem[] }[] = [
  {
    section: 'Workspace',
    items: [
      { href: '/', label: 'Overview', icon: Home },
      { href: '/reports', label: 'Report library', icon: Library },
      { href: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
      { href: '/builder', label: 'Report builder', icon: Blocks, perm: 'reports.build' },
    ],
  },
  {
    section: 'Delivery',
    items: [
      { href: '/jobs', label: 'My reports', icon: FolderDown },
      { href: '/schedules', label: 'Schedules', icon: CalendarClock },
      { href: '/email-in', label: 'Email requests', icon: MailPlus },
    ],
  },
  {
    section: 'Administration',
    items: [
      { href: '/admin/access', label: 'Roles and access', icon: ShieldCheck, perm: 'admin.access' },
      { href: '/admin/users', label: 'Users', icon: Users, perm: 'admin.users' },
      { href: '/admin/sources', label: 'Data sources', icon: Database, perm: 'admin.sources' },
      { href: '/admin/settings', label: 'Settings and rules', icon: Settings, perm: 'admin.settings' },
      { href: '/admin/audit', label: 'Audit log', icon: ScrollText, perm: 'audit.view' },
      { href: '/admin/outbox', label: 'Email outbox', icon: Send, perm: 'audit.view' },
    ],
  },
  {
    section: 'Account',
    items: [{ href: '/api-keys', label: 'API keys and BI', icon: KeyRound, perm: 'api.keys' }],
  },
];

export function visibleReportsNavigation(perms: readonly Permission[], isAdmin: boolean) {
  const has = (p?: Permission) => !p || isAdmin || perms.includes(p);
  return REPORTS_NAVIGATION.map((s) => ({ ...s, items: s.items.filter((i) => has(i.perm)) })).filter((s) => s.items.length);
}
