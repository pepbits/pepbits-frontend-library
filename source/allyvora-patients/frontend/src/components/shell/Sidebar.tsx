'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Clock3, LayoutPanelLeft, PanelLeftClose, PanelLeftOpen, UserPlus, Users } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { cn } from '@/lib/cn';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  hint?: string;
}

function useNav(): { groups: { label: string; items: NavItem[] }[] } {
  const pathname = usePathname();
  const params = useSearchParams();
  const mode = params.get('mode');
  const onPatients = pathname.startsWith('/patients');
  return {
    groups: [
      {
        label: 'Patients',
        items: [
          { href: '/patients', label: 'Patient register', icon: <Users className="size-[18px]" />, active: onPatients && mode !== 'new' },
          { href: '/patients?mode=new', label: 'New patient', icon: <UserPlus className="size-[18px]" />, active: onPatients && mode === 'new', hint: 'N' },
        ],
      },
      {
        label: 'Configuration',
        items: [
          { href: '/settings/layout', label: 'Form layout', icon: <LayoutPanelLeft className="size-[18px]" />, active: pathname.startsWith('/settings/layout') },
        ],
      },
    ],
  };
}

function Brand({ expanded }: { expanded: boolean }) {
  return (
    <Link href="/patients" className="flex h-[var(--header-h)] shrink-0 items-center gap-3 px-[14px]" aria-label="AllyVora home">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
          <path d="M4 12h4l2-5 4 10 2-5h4" />
        </svg>
      </span>
      <span className={cn('min-w-0 transition-opacity duration-150', expanded ? 'opacity-100' : 'opacity-0')}>
        <span className="block font-cond text-[17px] font-semibold leading-5 tracking-tight text-white">AllyVora</span>
        <span className="block text-2xs text-rail-ink/60">Healthcare workspace</span>
      </span>
    </Link>
  );
}

function NavLink({ item, expanded, onNavigate }: { item: NavItem; expanded: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={item.active ? 'page' : undefined}
      title={expanded ? undefined : item.label}
      className={cn(
        'group relative flex h-10 items-center gap-3 rounded-lg px-[11px] text-[13.5px] font-medium transition-colors',
        item.active ? 'bg-rail-2 text-white' : 'text-rail-ink/75 hover:bg-rail-2/70 hover:text-white',
      )}
    >
      {item.active && <span className="absolute -left-2 top-2 h-6 w-[3px] rounded-r bg-brand" aria-hidden />}
      <span className={cn('shrink-0', item.active && 'text-brand-strong')}>{item.icon}</span>
      <span className={cn('flex-1 truncate transition-opacity duration-150', expanded ? 'opacity-100' : 'opacity-0')}>{item.label}</span>
      {item.hint && expanded && <kbd className="rounded bg-white/10 px-1.5 text-2xs text-rail-ink/70">{item.hint}</kbd>}
    </Link>
  );
}

function SidebarBody({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) {
  const { groups } = useNav();
  const { recent } = useApp();
  return (
    <nav className="no-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-3" aria-label="Main">
      {groups.map((g) => (
        <div key={g.label}>
          <p className={cn('mb-1 h-5 px-[11px] text-2xs font-medium text-rail-ink/45 transition-opacity', expanded ? 'opacity-100' : 'opacity-0')}>
            {g.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {g.items.map((i) => (
              <NavLink key={i.href} item={i} expanded={expanded} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
      {recent.length > 0 && (
        <div>
          <p className={cn('mb-1 flex h-5 items-center gap-2 px-[11px] text-2xs font-medium text-rail-ink/45')}>
            <Clock3 className={cn('size-3.5 shrink-0', expanded && 'hidden')} aria-hidden />
            <span className={cn('transition-opacity', expanded ? 'opacity-100' : 'opacity-0')}>Recently opened</span>
          </p>
          <div className={cn('flex flex-col gap-0.5 transition-opacity', expanded ? 'opacity-100' : 'pointer-events-none opacity-0')}>
            {recent.map((r) => (
              <Link
                key={r.id}
                href={`/patients?mode=view&id=${r.id}`}
                onClick={onNavigate}
                tabIndex={expanded ? 0 : -1}
                className="flex flex-col rounded-lg px-[11px] py-1.5 text-rail-ink/75 hover:bg-rail-2/70 hover:text-white"
              >
                <span className="truncate text-[13px]">{r.name}</span>
                <span className="tabular truncate text-2xs text-rail-ink/45">{r.mrn}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const expanded = hover || pinned;

  // Collapse again whenever a page finishes loading.
  const routeKey = `${pathname}?${params.toString()}`;
  useEffect(() => {
    setPinned(false);
    setHover(false);
    onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPinned(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPinned(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  return (
    <>
      {/* Desktop rail: overlays content when expanded so nothing reflows. */}
      <aside
        ref={ref}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPinned(true);
        }}
        data-expanded={expanded}
        className={cn(
          'print-hide fixed inset-y-0 left-0 z-50 hidden flex-col bg-rail transition-[width,box-shadow] duration-200 ease-out lg:flex',
          expanded ? 'w-[248px] shadow-pop' : 'w-[var(--rail-w)]',
        )}
      >
        <Brand expanded={expanded} />
        <SidebarBody expanded={expanded} />
        <div className="border-t border-white/5 p-3">
          <button
            type="button"
            onClick={() => setPinned((p) => !p)}
            aria-pressed={pinned}
            aria-label={pinned ? 'Collapse sidebar' : 'Keep sidebar open'}
            title={pinned ? 'Collapse sidebar' : 'Keep sidebar open'}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-[11px] text-[13px] text-rail-ink/70 hover:bg-rail-2/70 hover:text-white"
          >
            {pinned ? <PanelLeftClose className="size-[18px] shrink-0" /> : <PanelLeftOpen className="size-[18px] shrink-0" />}
            <span className={cn('truncate transition-opacity', expanded ? 'opacity-100' : 'opacity-0')}>
              {pinned ? 'Collapse' : 'Keep open'}
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-rail/50" onClick={onMobileClose} aria-hidden />
          <aside className="relative flex h-full w-[272px] flex-col bg-rail shadow-pop" aria-label="Navigation">
            <Brand expanded />
            <SidebarBody expanded onNavigate={onMobileClose} />
          </aside>
        </div>
      )}
    </>
  );
}
