import {
  Activity, BadgeCheck, Boxes, Building2, CalendarClock, CalendarDays, CalendarX2, ClipboardList, FileSignature, FileText,
  Handshake, Hospital, LayoutDashboard, Layers, Network, Pill, ReceiptText, ShieldCheck, Stethoscope, Tags, UserRound, Users, Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavLink { href: string; label: string; icon: LucideIcon }
export interface NavGroup { key: string; label: string; icon: LucideIcon; links: NavLink[] }

export const NAV: NavGroup[] = [
  {
    key: 'front', label: 'Front office', icon: Activity, links: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/appointments', label: 'Appointments', icon: CalendarDays },
      { href: '/patients', label: 'Patients', icon: Users },
      { href: '/encounters', label: 'Encounters', icon: Stethoscope },
      { href: '/approvals', label: 'Approvals & eRx', icon: BadgeCheck },
    ],
  },
  {
    key: 'billing', label: 'Billing', icon: ReceiptText, links: [
      { href: '/billing/hospital', label: 'Hospital billing', icon: Hospital },
      { href: '/billing/pharmacy', label: 'Pharmacy billing', icon: Pill },
      { href: '/billing/invoices', label: 'Invoices', icon: FileText },
    ],
  },
  {
    key: 'insurance', label: 'Insurance & pricing', icon: ShieldCheck, links: [
      { href: '/masters/payers', label: 'Payers', icon: ShieldCheck },
      { href: '/masters/tpas', label: 'TPAs', icon: Handshake },
      { href: '/masters/insurance-plans', label: 'Plans', icon: Layers },
      { href: '/masters/networks', label: 'Networks', icon: Network },
      { href: '/masters/price-lists', label: 'Contracts', icon: FileSignature },
      { href: '/contracts', label: 'Contract pricing', icon: Tags },
    ],
  },
  {
    key: 'catalog', label: 'Catalog', icon: Boxes, links: [
      { href: '/masters/items', label: 'Items (stock)', icon: Boxes },
      { href: '/masters/services', label: 'Services', icon: ClipboardList },
    ],
  },
  {
    key: 'org', label: 'Organization', icon: Building2, links: [
      { href: '/masters/facilities', label: 'Facilities', icon: Building2 },
      { href: '/masters/departments', label: 'Departments', icon: Hospital },
      { href: '/masters/specialties', label: 'Specialties', icon: Stethoscope },
      { href: '/masters/providers', label: 'Providers & staff', icon: UserRound },
    ],
  },
  {
    key: 'scheduling', label: 'Scheduling setup', icon: CalendarClock, links: [
      { href: '/masters/resources', label: 'Resources', icon: Wrench },
      { href: '/masters/resource-schedules', label: 'Availability', icon: CalendarClock },
      { href: '/masters/resource-blocks', label: 'Blocks & leave', icon: CalendarX2 },
    ],
  },
];

export const isActive = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
