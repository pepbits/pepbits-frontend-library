'use client';

import clsx from 'clsx';
import {AlertTriangle, BadgeCheck, Check, ChevronDown, Keyboard, Landmark, MonitorSmartphone, Plus, Search, Undo2} from '@pepbits/icons';
import {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {roleLabel} from '../../lib/format';
import {useHotkey} from '../../lib/hotkeys';
import {useSession} from '../../lib/session';
import {useApi} from '../../lib/api';
import {Link} from '../../host';
import {Dialog, Menu, MenuItem, useErrorToast, useToast} from '../ui/overlay';
import {Button, Kbd} from '../ui/primitives';
import {CommandPalette} from './CommandPalette';
import {NewBillDialog} from './NewBillDialog';

interface ShellCtx {openNewBill: (mrNo?: string) => void; openSearch: () => void}
const Ctx = createContext<ShellCtx>({openNewBill: () => {}, openSearch: () => {}});
export const useShell = () => useContext(Ctx);

/** The source header/footer chrome as a Settle desk bar inside the shared EnterpriseShell: counter
 * picker, desk-user switcher, search and New bill above every screen; connection status below.
 * The shell keeps its own sidebar, ⌘K command palette and ? page helper. */
export function AppShell({children}: {children: React.ReactNode}) {
  const [palette, setPalette] = useState(false);
  const [newBill, setNewBill] = useState<{open: boolean; mr?: string}>({open: false});
  const [help, setHelp] = useState(false);
  const {preferences} = usePreferences();
  const {direction} = useLocalization();

  const openNewBill = useCallback((mr?: string) => setNewBill({open: true, mr}), []);
  const openSearch = useCallback(() => setPalette(true), []);

  useHotkey('/', () => setPalette(true));
  useHotkey('n', () => openNewBill());

  return (
    <Ctx.Provider value={{openNewBill, openSearch}}>
      <div className="settle-app flex min-h-full flex-col" dir={direction} data-reduced-motion={String(preferences.reducedMotion)}>
        <Header onSearch={openSearch} onNewBill={() => openNewBill()} />
        <div className="w-full flex-1 px-3 py-4 sm:px-5 lg:px-6">{children}</div>
        <Footer onHelp={() => setHelp(true)} />
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} onNewBill={() => openNewBill()} />
      <NewBillDialog open={newBill.open} initialMr={newBill.mr} onClose={() => setNewBill({open: false})} />
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
    </Ctx.Provider>
  );
}

function Header({onSearch, onNewBill}: {onSearch: () => void; onNewBill: () => void}) {
  const {meta, switchUser, setCounter, can} = useSession();
  const {t} = useLocalization();
  const toast = useToast();
  const fail = useErrorToast();
  const me = meta?.me;
  const counters = meta?.counters.filter(c => !c.is_system) || [];
  const badges = meta?.badges;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-2 sm:gap-3 sm:px-5 lg:px-6" role="toolbar" aria-label={t('Billing desk')}>
      <button type="button" onClick={onSearch}
        className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-line bg-mist/70 px-3 text-start text-[length:calc(14px*var(--fs-scale,1))] text-ink-mute transition-colors hover:border-line-strong md:max-w-[440px]">
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{t('Search bills, patients, receipts')}</span>
        <span className="ms-auto hidden items-center gap-1 sm:flex"><Kbd>/</Kbd></span>
      </button>

      {badges && (badges.approvals > 0 || badges.unrealized > 0 || badges.overpaid > 0) ? (
        <nav aria-label={t('Waiting work')} className="hidden items-center gap-1.5 lg:flex">
          {badges.overpaid > 0 && <Link href="/bills?due=overpaid" className="chip bg-rose-50 text-rose-700 hover:underline"><Undo2 className="h-3.5 w-3.5" aria-hidden />{badges.overpaid} {t('overpaid')}</Link>}
          {badges.approvals > 0 && <Link href="/approvals" className="chip bg-marigold-50 text-marigold-800 hover:underline"><BadgeCheck className="h-3.5 w-3.5" aria-hidden />{badges.approvals} {t('approvals')}</Link>}
          {badges.unrealized > 0 && <Link href="/receipts?unrealized=1" className="chip bg-indigo-50 text-indigo-700 hover:underline"><Landmark className="h-3.5 w-3.5" aria-hidden />{badges.unrealized} {t('cheques')}</Link>}
        </nav>
      ) : null}

      <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
        <Menu
          trigger={({toggle, open}) => (
            <button type="button" onClick={toggle} aria-expanded={open} aria-haspopup="menu" aria-label={`${t('Counter')}: ${me?.counter_name || t('No counter')}`}
              className={clsx('inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[length:calc(13px*var(--fs-scale,1))] font-medium transition-colors',
                me?.counter_id ? 'border-line text-ink hover:border-line-strong' : 'border-marigold-300 bg-marigold-50 text-marigold-800')}>
              {me?.counter_id ? <MonitorSmartphone className="h-4 w-4 text-pine-600" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
              <span className="max-w-[140px] truncate">{me?.counter_name || t('No counter')}</span>
              <ChevronDown className="h-3.5 w-3.5 text-ink-mute" aria-hidden />
            </button>
          )}
        >
          {close => (
            <>
              <p className="px-2.5 pb-1 pt-1.5 text-[length:calc(12px*var(--fs-scale,1))] text-ink-mute">{t('Payments are recorded against this counter')}</p>
              {counters.map(c => (
                <MenuItem key={c.id} active={me?.counter_id === c.id} hint={c.card_terminal || undefined}
                  icon={me?.counter_id === c.id ? <Check className="h-4 w-4 text-pine-600" /> : <span className="inline-block w-4" />}
                  onClick={async () => {close(); try {await setCounter(c.id); toast({tone: 'success', title: 'Working at {name}'.replace('{name}', c.name)});} catch (e) {fail(e);}}}>
                  {c.name}
                </MenuItem>
              ))}
              {me?.counter_id && (
                <MenuItem icon={<span className="inline-block w-4" />} onClick={async () => {close(); try {await setCounter(null);} catch (e) {fail(e);}}}>Leave counter</MenuItem>
              )}
            </>
          )}
        </Menu>

        {can('edit_bill') && (
          <Button variant="primary" onClick={onNewBill} icon={<Plus className="h-4 w-4" />} className="px-2.5 sm:px-3.5" kbd="N">
            <span className="sr-only sm:not-sr-only">{t('New bill')}</span>
          </Button>
        )}

        <Menu
          trigger={({toggle, open}) => (
            <button type="button" onClick={toggle} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-full p-0.5 pe-1 hover:bg-mist sm:pe-2">
              <span className="sr-only">{t('Desk user')}: </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[length:calc(12px*var(--fs-scale,1))] font-semibold text-panel" aria-hidden>{me?.initials || '…'}</span>
              <span className="sr-only xl:not-sr-only xl:block xl:text-start xl:leading-tight">
                <span className="block text-[length:calc(13px*var(--fs-scale,1))] font-medium">{me?.name}</span>
                <span className="block text-[length:calc(11.5px*var(--fs-scale,1))] text-ink-mute">{me && t(roleLabel(me.role))}</span>
              </span>
            </button>
          )}
        >
          {close => (
            <>
              <p className="px-2.5 pb-1 pt-1.5 text-[length:calc(12px*var(--fs-scale,1))] text-ink-mute">{t('Demo: switch user to see how rights change the screens')}</p>
              {meta?.users.map(u => (
                <MenuItem key={u.id} active={me?.id === u.id} onClick={() => {close(); switchUser(u.id); toast({tone: 'info', title: t('Working as {name}').replace('{name}', u.name), body: t(roleLabel(u.role))});}}
                  icon={<span className="flex h-6 w-6 items-center justify-center rounded-full bg-mist-2 text-[length:calc(10px*var(--fs-scale,1))] font-semibold text-ink-soft">{u.initials}</span>}
                  hint={roleLabel(u.role)}>
                  {u.name}
                </MenuItem>
              ))}
            </>
          )}
        </Menu>
      </div>
    </div>
  );
}

function Footer({onHelp}: {onHelp: () => void}) {
  const {meta, error} = useSession();
  const {t} = useLocalization();
  // Connection status reuses the authenticated transport: the health endpoint is outside /api auth.
  const health = useApi<{ok: boolean}>('/health');
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {if (health.data) setOnline(!!health.data.ok); else if (health.error) setOnline(false);}, [health.data, health.error]);
  useEffect(() => {const id = setInterval(health.reload, 30000); return () => clearInterval(id);}, [health.reload]);
  const ok = online && !error;
  return (
    <div className="flex h-[34px] items-center gap-4 border-t border-line bg-panel px-3 text-[length:calc(12px*var(--fs-scale,1))] text-ink-mute sm:px-5 lg:px-6">
      <span className="flex items-center gap-1.5" role="status">
        <span className={clsx('h-2 w-2 rounded-full', online === null ? 'bg-line-strong' : ok ? 'bg-pine-500' : 'animate-pulse2 bg-rose-500')} aria-hidden />
        {t(online === null ? 'Connecting' : ok ? 'Connected' : 'Billing server unreachable')}
      </span>
      <span className="hidden truncate sm:inline">{meta?.hospital.name}</span>
      <button type="button" onClick={onHelp} className="ms-auto inline-flex items-center gap-1.5 hover:text-ink">
        <Keyboard className="h-3.5 w-3.5" aria-hidden /> {t('Shortcuts')}
      </button>
      <span>Settle 1.0</span>
    </div>
  );
}

function ShortcutsDialog({open, onClose}: {open: boolean; onClose: () => void}) {
  const {t} = useLocalization();
  const {preferences} = usePreferences();
  const rows: [string, string[]][] = [
    ['Search anything', ['⌘', 'K']], ['Search (quick)', ['/']], ['New bill', ['N']], ['Show page help', ['?']],
    ['On a bill: add a charge', ['A']], ['On a bill: take payment', ['P']], ['On a bill: finalize', ['F']],
  ];
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" size="sm">
      {preferences.keyboardShortcuts === false && <p className="mb-3 rounded-lg bg-marigold-50 px-3 py-2 text-[length:calc(13px*var(--fs-scale,1))] text-marigold-800">{t('Keyboard shortcuts are turned off in your preferences. Every action is still available from its button.')}</p>}
      <ul className="divide-y divide-line">
        {rows.map(([label, keys]) => (
          <li key={label} className="flex items-center justify-between py-2.5 text-[length:calc(14px*var(--fs-scale,1))]">
            <span>{t(label)}</span>
            <span className="flex gap-1">{keys.map(k => <kbd key={k} className="rounded border border-line bg-mist px-1.5 text-[length:calc(12px*var(--fs-scale,1))]">{k}</kbd>)}</span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
