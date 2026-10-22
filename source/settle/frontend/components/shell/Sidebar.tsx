'use client';

import clsx from 'clsx';
import {
  BadgeCheck, ChartColumnBig, History, LayoutDashboard, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings2, Users, Vault, Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/lib/session';

type Item = { href: string; label: string; icon: React.ElementType; badge?: number; tone?: 'due' | 'info'; right?: string };

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname();
  const { meta, can } = useSession();
  const [hover, setHover] = useState(false);
  const [clicked, setClicked] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const expanded = hover || clicked;

  // Every navigation (and the first load) starts with the rail collapsed.
  useEffect(() => { setClicked(false); setHover(false); onMobileClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups: { label: string; items: Item[] }[] = [
    { label: 'Work', items: [
      { href: '/', label: 'Desk', icon: LayoutDashboard },
      { href: '/bills', label: 'Bills', icon: ReceiptText, badge: meta?.badges.overpaid, tone: 'info' },
      { href: '/patients', label: 'Patient accounts', icon: Users },
    ] },
    { label: 'Money', items: [
      { href: '/receipts', label: 'Receipts', icon: Wallet, badge: meta?.badges.unrealized, tone: 'info' },
      { href: '/day-close', label: 'Day close', icon: Vault },
    ] },
    { label: 'Control', items: [
      { href: '/approvals', label: 'Approvals', icon: BadgeCheck, badge: meta?.badges.approvals, tone: 'due' },
      ...(can('view_reports') ? [{ href: '/reports', label: 'Reports', icon: ChartColumnBig }] : []),
      ...(can('view_audit') ? [{ href: '/audit', label: 'Audit trail', icon: History }] : []),
    ] },
    { label: 'Admin', items: [{ href: '/settings', label: 'Settings', icon: Settings2 }] },
  ];

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const showLabels = expanded || mobileOpen;

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={onMobileClose} aria-hidden />}
      <nav
        aria-label="Main"
        onMouseEnter={() => { clearTimeout(leaveTimer.current); setHover(true); }}
        onMouseLeave={() => { leaveTimer.current = setTimeout(() => setHover(false), 120); }}
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-ink text-white transition-[width,transform,box-shadow] duration-200 ease-out',
          'w-[var(--sidebar-expanded)] lg:translate-x-0',
          mobileOpen ? 'translate-x-0 shadow-pop' : '-translate-x-full',
          expanded ? 'lg:w-[var(--sidebar-expanded)] lg:shadow-pop' : 'lg:w-[var(--sidebar-collapsed)]',
        )}
      >
        <div className="flex h-[var(--header-h)] shrink-0 items-center gap-3 overflow-hidden px-[18px]">
          <Mark />
          <div className={clsx('min-w-0 transition-opacity duration-150', showLabels ? 'opacity-100' : 'opacity-0')}>
            <p className="text-[16px] font-semibold leading-tight tracking-[-0.01em]">Settle</p>
            <p className="truncate text-[11.5px] text-white/55">{meta?.hospital.name || 'Patient billing'}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3">
          {groups.map((g) => (
            <div key={g.label} className="mt-3 first:mt-1">
              <p className={clsx('h-6 px-2 text-[11.5px] font-medium text-white/40 transition-opacity', showLabels ? 'opacity-100' : 'opacity-0')}>{g.label}</p>
              <ul className="flex flex-col gap-0.5">
                {g.items.map((it) => {
                  const active = isActive(it.href);
                  const Icon = it.icon;
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        title={showLabels ? undefined : it.label}
                        aria-current={active ? 'page' : undefined}
                        className={clsx(
                          'relative flex h-10 items-center gap-3 rounded-lg px-[11px] text-[14px] transition-colors',
                          active ? 'bg-white/[0.09] text-white' : 'text-white/70 hover:bg-white/[0.05] hover:text-white',
                        )}
                      >
                        {active && <span className="absolute -left-3 top-2 h-6 w-[3px] rounded-r bg-marigold-500" aria-hidden />}
                        <Icon className="h-[19px] w-[19px] shrink-0" strokeWidth={1.8} />
                        <span className={clsx('flex-1 truncate transition-opacity', showLabels ? 'opacity-100' : 'opacity-0')}>{it.label}</span>
                        {!!it.badge && (
                          <span className={clsx(
                            'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold transition-all',
                            it.tone === 'due' ? 'bg-marigold-500 text-ink' : 'bg-white/15 text-white',
                            !showLabels && 'absolute right-1 top-1 h-4 min-w-4 px-1 text-[10px]',
                          )}>{it.badge}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="hidden shrink-0 border-t border-white/10 p-3 lg:block">
          <button
            type="button"
            onClick={() => setClicked((c) => !c)}
            aria-label={clicked ? 'Collapse menu' : 'Expand menu'}
            aria-expanded={expanded}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-[11px] text-[13px] text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            {clicked ? <PanelLeftClose className="h-[19px] w-[19px] shrink-0" strokeWidth={1.8} /> : <PanelLeftOpen className="h-[19px] w-[19px] shrink-0" strokeWidth={1.8} />}
            <span className={clsx('truncate transition-opacity', showLabels ? 'opacity-100' : 'opacity-0')}>{clicked ? 'Collapse' : 'Keep open'}</span>
          </button>
        </div>
      </nav>
    </>
  );
}

/** Brand mark: a balanced ledger line — two strokes meeting at zero. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={clsx('h-8 w-8 shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#0F6B5E" />
      <path d="M8 12h16" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8 20h10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".55" />
      <circle cx="23" cy="20" r="2.6" fill="#E9A100" />
    </svg>
  );
}

