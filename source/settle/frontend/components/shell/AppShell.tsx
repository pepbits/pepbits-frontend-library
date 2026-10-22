'use client';

import clsx from 'clsx';
import { AlertTriangle, Check, ChevronDown, Keyboard, Menu as MenuIcon, MonitorSmartphone, Plus, Search } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { roleLabel } from '@/lib/format';
import { useHotkey } from '@/lib/hotkeys';
import { useSession } from '@/lib/session';
import { Dialog, Menu, MenuItem, useErrorToast, useToast } from '../ui/overlay';
import { Button, Kbd } from '../ui/primitives';
import { CommandPalette } from './CommandPalette';
import { NewBillDialog } from './NewBillDialog';
import { Mark, Sidebar } from './Sidebar';

interface ShellCtx { openNewBill: (mrNo?: string) => void; openSearch: () => void }
const Ctx = createContext<ShellCtx>({ openNewBill: () => {}, openSearch: () => {} });
export const useShell = () => useContext(Ctx);

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);
  const [newBill, setNewBill] = useState<{ open: boolean; mr?: string }>({ open: false });
  const [help, setHelp] = useState(false);

  // Pages are data-driven on the client; render them after mount so dates and times never mismatch the server render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const openNewBill = useCallback((mr?: string) => setNewBill({ open: true, mr }), []);
  const openSearch = useCallback(() => setPalette(true), []);

  useHotkey('mod+k', () => setPalette((p) => !p));
  useHotkey('/', () => setPalette(true));
  useHotkey('n', () => openNewBill());
  useHotkey('shift+?', () => setHelp(true));

  return (
    <Ctx.Provider value={{ openNewBill, openSearch }}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <Sidebar mobileOpen={mobileNav} onMobileClose={() => setMobileNav(false)} />
      <div className="flex min-h-dvh flex-col lg:pl-[var(--sidebar-collapsed)]">
        <Header onMenu={() => setMobileNav(true)} onSearch={openSearch} onNewBill={() => openNewBill()} />
        <main id="main" className="w-full flex-1 px-3 py-4 sm:px-5 lg:px-6">{mounted ? children : <ShellSkeleton />}</main>
        <Footer onHelp={() => setHelp(true)} />
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} onNewBill={() => openNewBill()} />
      <NewBillDialog open={newBill.open} initialMr={newBill.mr} onClose={() => setNewBill({ open: false })} />
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
    </Ctx.Provider>
  );
}

function ShellSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-64 animate-pulse rounded-md bg-mist-2" />
      <div className="h-24 animate-pulse rounded-panel bg-mist-2" />
      <div className="h-80 animate-pulse rounded-panel bg-mist-2" />
    </div>
  );
}

function Header({ onMenu, onSearch, onNewBill }: { onMenu: () => void; onSearch: () => void; onNewBill: () => void }) {
  const { meta, switchUser, setCounter, can } = useSession();
  const toast = useToast();
  const fail = useErrorToast();
  const me = meta?.me;
  const counters = meta?.counters.filter((c) => !c.is_system) || [];

  return (
    <header className="sticky top-0 z-30 flex h-[var(--header-h)] items-center gap-2 border-b border-line bg-white/90 px-3 backdrop-blur sm:gap-3 sm:px-5 lg:px-6">
      <button type="button" onClick={onMenu} aria-label="Open menu" className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-mist lg:hidden">
        <MenuIcon className="h-5 w-5" />
      </button>
      <Mark className="h-7 w-7 lg:hidden" />

      <button type="button" onClick={onSearch}
        className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-line bg-mist/70 px-3 text-left text-[14px] text-ink-mute transition-colors hover:border-line-strong md:max-w-[440px]">
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search bills, patients, receipts</span>
        <span className="ml-auto hidden items-center gap-1 sm:flex"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
      </button>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <Menu
          trigger={({ toggle, open }) => (
            <button type="button" onClick={toggle} aria-expanded={open}
              className={clsx('hidden h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-colors sm:inline-flex',
                me?.counter_id ? 'border-line text-ink hover:border-line-strong' : 'border-marigold-300 bg-marigold-50 text-marigold-800')}>
              {me?.counter_id ? <MonitorSmartphone className="h-4 w-4 text-pine-600" /> : <AlertTriangle className="h-4 w-4" />}
              <span className="max-w-[140px] truncate">{me?.counter_name || 'No counter'}</span>
              <ChevronDown className="h-3.5 w-3.5 text-ink-mute" />
            </button>
          )}
        >
          {(close) => (
            <>
              <p className="px-2.5 pb-1 pt-1.5 text-[12px] text-ink-mute">Payments are recorded against this counter</p>
              {counters.map((c) => (
                <MenuItem key={c.id} active={me?.counter_id === c.id} hint={c.card_terminal || undefined}
                  icon={me?.counter_id === c.id ? <Check className="h-4 w-4 text-pine-600" /> : <span className="inline-block w-4" />}
                  onClick={async () => { close(); try { await setCounter(c.id); toast({ tone: 'success', title: `Working at ${c.name}` }); } catch (e) { fail(e); } }}>
                  {c.name}
                </MenuItem>
              ))}
              {me?.counter_id && (
                <MenuItem icon={<span className="inline-block w-4" />} onClick={async () => { close(); try { await setCounter(null); } catch (e) { fail(e); } }}>Leave counter</MenuItem>
              )}
            </>
          )}
        </Menu>

        {can('edit_bill') && (
          <Button variant="primary" onClick={onNewBill} icon={<Plus className="h-4 w-4" />} className="px-2.5 sm:px-3.5" aria-label="New bill">
            <span className="hidden sm:inline">New bill</span>
          </Button>
        )}

        <Menu
          trigger={({ toggle, open }) => (
            <button type="button" onClick={toggle} aria-expanded={open} aria-label="Account" className="flex items-center gap-2 rounded-full p-0.5 pr-1 hover:bg-mist sm:pr-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-white">{me?.initials || '…'}</span>
              <span className="hidden text-left leading-tight xl:block">
                <span className="block text-[13px] font-medium">{me?.name}</span>
                <span className="block text-[11.5px] text-ink-mute">{me && roleLabel(me.role)}</span>
              </span>
            </button>
          )}
        >
          {(close) => (
            <>
              <p className="px-2.5 pb-1 pt-1.5 text-[12px] text-ink-mute">Demo: switch user to see how rights change the screens</p>
              {meta?.users.map((u) => (
                <MenuItem key={u.id} active={me?.id === u.id} onClick={() => { close(); switchUser(u.id); toast({ tone: 'info', title: `Signed in as ${u.name}`, body: roleLabel(u.role) }); }}
                  icon={<span className="flex h-6 w-6 items-center justify-center rounded-full bg-mist-2 text-[10px] font-semibold text-ink-soft">{u.initials}</span>}
                  hint={roleLabel(u.role)}>
                  {u.name}
                </MenuItem>
              ))}
            </>
          )}
        </Menu>
      </div>
    </header>
  );
}

function Footer({ onHelp }: { onHelp: () => void }) {
  const { meta, error } = useSession();
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const ping = () => fetch('/api/health', { cache: 'no-store' }).then((r) => alive && setOnline(r.ok)).catch(() => alive && setOnline(false));
    ping();
    const t = setInterval(ping, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const ok = online && !error;
  return (
    <footer className="flex h-[var(--footer-h)] items-center gap-4 border-t border-line bg-white px-3 text-[12px] text-ink-mute sm:px-5 lg:px-6">
      <span className="flex items-center gap-1.5">
        <span className={clsx('h-2 w-2 rounded-full', online === null ? 'bg-line-strong' : ok ? 'bg-pine-500' : 'animate-pulse2 bg-rose-500')} aria-hidden />
        {online === null ? 'Connecting' : ok ? 'Connected' : 'Billing server unreachable'}
      </span>
      <span className="hidden truncate sm:inline">{meta?.hospital.name}</span>
      <button type="button" onClick={onHelp} className="ml-auto hidden items-center gap-1.5 hover:text-ink md:inline-flex">
        <Keyboard className="h-3.5 w-3.5" /> Shortcuts <Kbd>?</Kbd>
      </button>
      <span>Settle 1.0</span>
    </footer>
  );
}

function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows: [string, string[]][] = [
    ['Search anything', ['⌘', 'K']], ['Search (quick)', ['/']], ['New bill', ['N']], ['Show shortcuts', ['?']],
    ['On a bill: add a charge', ['A']], ['On a bill: take payment', ['P']], ['On a bill: finalize', ['F']], ['On a bill: print', ['⌘', 'P']],
  ];
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" size="sm">
      <ul className="divide-y divide-line">
        {rows.map(([label, keys]) => (
          <li key={label} className="flex items-center justify-between py-2.5 text-[14px]">
            <span>{label}</span>
            <span className="flex gap-1">{keys.map((k) => <kbd key={k} className="rounded border border-line bg-mist px-1.5 text-[12px]">{k}</kbd>)}</span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
