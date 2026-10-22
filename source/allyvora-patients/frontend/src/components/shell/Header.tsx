'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, ChevronRight, LogOut, Menu, Monitor, Moon, Search, Sun } from 'lucide-react';
import { useApp, type ThemePref } from '@/lib/app-context';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Misc';

function useCrumbs(): { label: string; href?: string }[] {
  const pathname = usePathname();
  const params = useSearchParams();
  if (pathname.startsWith('/settings')) return [{ label: 'Configuration' }, { label: 'Form layout' }];
  const mode = params.get('mode');
  const base = { label: 'Patients', href: '/patients' };
  if (mode === 'new') return [base, { label: 'New patient' }];
  if (mode === 'edit') return [base, { label: 'Edit patient' }];
  if (mode === 'view') return [base, { label: 'Patient record' }];
  return [{ label: 'Patients' }, { label: 'Patient register' }];
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

function BranchMenu() {
  const { session, branchId, setBranchId } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  if (!session) return null;
  const current = session.branches.find((b) => b.id === branchId);
  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 max-w-[280px] items-center gap-2 rounded-lg px-2.5 text-left hover:bg-sunken"
      >
        <Building2 className="size-4 shrink-0 text-ink-3" aria-hidden />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium leading-4 text-ink">{current?.name ?? 'Choose branch'}</span>
          <span className="block truncate text-2xs leading-4 text-ink-3">{session.organization.name}</span>
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-ink-3" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-72 animate-pop-in rounded-xl border border-line bg-surface p-1.5 shadow-pop">
          <p className="px-2.5 pb-1 pt-1.5 text-2xs text-ink-3">New registrations use this branch</p>
          {session.branches.map((b) => (
            <button
              key={b.id}
              role="menuitemradio"
              aria-checked={b.id === branchId}
              onClick={() => {
                setBranchId(b.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-sunken"
            >
              <span className="tabular w-9 rounded bg-sunken py-0.5 text-center text-2xs font-semibold text-ink-2">{b.code}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">{b.name}</span>
                <span className="block text-2xs text-ink-3">{b.city}</span>
              </span>
              {b.id === branchId && <Check className="size-4 text-brand" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const THEMES: { id: ThemePref; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'Match device', icon: Monitor },
];

function UserMenu() {
  const { session, theme, setTheme } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  if (!session) return <div className="size-9 rounded-full bg-sunken" aria-hidden />;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-1 hover:bg-sunken xl:pr-2.5"
      >
        <span className="relative flex size-8 items-center justify-center rounded-full bg-rail text-xs font-semibold text-white">
          {session.user.initials}
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-ok" aria-hidden />
        </span>
        <span className="hidden text-left xl:block">
          <span className="block text-[13px] font-medium leading-4 text-ink">{session.user.name}</span>
          <span className="block text-2xs leading-4 text-ink-3">{session.user.role}</span>
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-64 animate-pop-in rounded-xl border border-line bg-surface p-1.5 shadow-pop">
          <div className="px-2.5 py-2">
            <p className="font-medium text-ink">{session.user.name}</p>
            <p className="truncate text-xs text-ink-3">{session.user.email}</p>
          </div>
          <div className="my-1 border-t border-line" />
          <p className="px-2.5 pb-1 pt-1 text-2xs text-ink-3">Appearance</p>
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="menuitemradio"
              aria-checked={theme === t.id}
              onClick={() => setTheme(t.id)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-ink hover:bg-sunken"
            >
              <t.icon className="size-4 text-ink-3" aria-hidden />
              <span className="flex-1 text-left">{t.label}</span>
              {theme === t.id && <Check className="size-4 text-brand" aria-hidden />}
            </button>
          ))}
          <div className="my-1 border-t border-line" />
          <button
            disabled
            title="Sign-in is simulated in this environment"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-ink-3"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Header({ onOpenMenu, onOpenSearch }: { onOpenMenu: () => void; onOpenSearch: () => void }) {
  const crumbs = useCrumbs();
  return (
    <header className="print-hide sticky top-0 z-40 flex h-[var(--header-h)] items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 sm:px-4 lg:px-6">
      <IconButton label="Open navigation" onClick={onOpenMenu} className="lg:hidden">
        <Menu className="size-5" />
      </IconButton>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={c.label} className={cn('flex min-w-0 items-center gap-1.5', !last && 'hidden sm:flex')}>
                {c.href && !last ? (
                  <Link href={c.href} className="truncate text-ink-2 hover:text-ink">
                    {c.label}
                  </Link>
                ) : (
                  <span className={cn('truncate', last ? 'font-semibold text-ink' : 'text-ink-2')} aria-current={last ? 'page' : undefined}>
                    {c.label}
                  </span>
                )}
                {!last && <ChevronRight className="size-3.5 shrink-0 text-ink-3" aria-hidden />}
              </li>
            );
          })}
        </ol>
      </nav>

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-9 items-center gap-2 rounded-lg border border-line bg-bg px-2.5 text-[13px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2 sm:w-64 xl:w-80"
        aria-label="Search patients and actions"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="hidden flex-1 text-left sm:block">Search name, MRN or mobile</span>
        <Kbd className="hidden sm:inline">⌘K</Kbd>
      </button>

      <BranchMenu />
      <UserMenu />
    </header>
  );
}
