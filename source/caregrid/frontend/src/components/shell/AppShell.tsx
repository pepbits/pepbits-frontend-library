'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOctagon, BarChart3, Bell, Boxes, CalendarPlus, CalendarRange, CalendarX2, CheckCircle2, ConciergeBell, CornerDownLeft, Info, LayoutDashboard,
  LibraryBig, LifeBuoy, Pill, Search, ShieldAlert, Users, X, Pin, PinOff, ArrowUpRight, Keyboard,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Notice, Toast, useApi, useLive } from '@/lib/live';
import { ago, niceDate, nowLocal } from '@/lib/time';
import { CatIcon, KindIcon } from '@/components/ui/primitives';
import { HELP } from './helpContent';

export const NAV = [
  { href: '/', label: 'Command center', icon: LayoutDashboard },
  { href: '/book', label: 'Book', icon: CalendarPlus, key: 'B' },
  { href: '/schedule', label: 'Schedule board', icon: CalendarRange },
  { href: '/frontdesk', label: 'Front desk', icon: ConciergeBell },
  { href: '/exceptions', label: 'Availability and blocks', icon: CalendarX2, badge: 'queue' },
  { href: '/resources', label: 'Resources', icon: Boxes },
  { href: '/catalog', label: 'Service catalog', icon: LibraryBig },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/pharmacy', label: 'Pharmacy desk', icon: Pill },
  { href: '/insights', label: 'Insights', icon: BarChart3 },
  { href: '/help', label: 'Help center', icon: LifeBuoy },
];

function useClock() {
  const [now, setNow] = useState<string>('');
  useEffect(() => { const t = () => setNow(nowLocal()); t(); const i = setInterval(t, 15000); return () => clearInterval(i); }, []);
  return now;
}

function Sidebar() {
  const pathname = usePathname();
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || pinned;
  const { data: q } = useApi<any[]>('/queue');
  const queueCount = q?.length ?? 0;
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const collapse = () => { setHover(false); setPinned(false); };
  return (
    <nav
      aria-label="Main"
      onMouseEnter={() => { clearTimeout(leaveTimer.current); setHover(true); }}
      onMouseLeave={() => { leaveTimer.current = setTimeout(() => setHover(false), 120); }}
      className={clsx('fixed bottom-8 left-0 top-14 z-40 flex flex-col bg-ink text-ink-200 transition-[width,box-shadow] duration-200 ease-out',
        open ? 'w-60 shadow-pop' : 'w-16')}
    >
      <button onClick={() => setPinned(p => !p)} className="mx-2 mt-2 flex h-9 items-center gap-3 rounded-lg px-3 text-ink-300 hover:bg-ink-800 hover:text-white"
        aria-label={pinned ? 'Unpin menu' : 'Keep menu open'} title={pinned ? 'Unpin menu' : 'Keep menu open'}>
        {pinned ? <PinOff className="h-4 w-4 shrink-0" /> : <Pin className="h-4 w-4 shrink-0" />}
        <span className={clsx('text-xs transition-opacity', open ? 'opacity-100' : 'opacity-0')}>{pinned ? 'Unpin menu' : 'Keep menu open'}</span>
      </button>
      <ul className="mt-1 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2 pb-3">
        {NAV.map(item => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          const badge = item.badge === 'queue' && queueCount ? queueCount : 0;
          return (
            <li key={item.href}>
              <Link href={item.href} onClick={collapse} title={open ? undefined : item.label}
                className={clsx('relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                  active ? 'bg-teal-600 text-white' : 'hover:bg-ink-800 hover:text-white')}>
                {active && <span className="absolute -left-2 top-2 bottom-2 w-1 rounded-r bg-marigold-500" />}
                <Icon className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={1.8} />
                <span className={clsx('flex-1 truncate transition-opacity duration-150', open ? 'opacity-100' : 'opacity-0')}>{item.label}</span>
                {badge > 0 && (
                  <span className={clsx('grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-marigold-500 px-1 text-[0.65rem] font-bold text-ink',
                    !open && 'absolute right-1.5 top-1 h-4 min-w-[1rem] text-[0.6rem]')}>{badge}</span>
                )}
                {item.key && open && <span className="kbd border-ink-600 bg-ink-800 text-ink-200">{item.key}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const LEVEL = {
  success: { icon: CheckCircle2, bar: 'bg-teal-500', tint: 'text-teal-600', ring: 'ring-teal-100' },
  info: { icon: Info, bar: 'bg-[#3D7BD9]', tint: 'text-[#3D7BD9]', ring: 'ring-[#DCE7F8]' },
  warning: { icon: ShieldAlert, bar: 'bg-marigold-500', tint: 'text-marigold-600', ring: 'ring-marigold-100' },
  critical: { icon: AlertOctagon, bar: 'bg-crimson-500', tint: 'text-crimson-600', ring: 'ring-crimson-100' },
};

function ToastCard({ t, onClose }: { t: Toast; onClose: () => void }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const ms = t.level === 'critical' ? 10000 : 6500;
  const L = LEVEL[t.level];
  const Icon = L.icon;
  useEffect(() => {
    if (paused) return;
    const id = setTimeout(onClose, ms);
    return () => clearTimeout(id);
  }, [paused, ms, onClose]);
  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      className={clsx('pointer-events-auto relative w-[22rem] overflow-hidden rounded-xl bg-white shadow-pop ring-1 animate-slide-in', L.ring)} role="status">
      <div className="flex gap-3 p-3.5 pr-9">
        <div className={clsx('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-canvas', L.tint)}><Icon className="h-[1.1rem] w-[1.1rem]" /></div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">{t.title}</div>
          {t.body && <div className="mt-0.5 text-[0.8rem] leading-snug text-muted">{t.body}</div>}
          <div className="mt-2 flex gap-2">
            {t.link && <button className="btn-outline btn-xs" onClick={() => { router.push(t.link!); onClose(); }}>Open <ArrowUpRight className="h-3 w-3" /></button>}
            {t.action && <button className="btn-primary btn-xs" onClick={() => { t.action!.onClick(); onClose(); }}>{t.action.label}</button>}
          </div>
        </div>
      </div>
      <button className="absolute right-2 top-2 rounded p-1 text-ink-400 hover:bg-canvas hover:text-ink" onClick={onClose} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
      <div className={clsx('absolute bottom-0 left-0 h-[3px] w-full origin-left animate-drain', L.bar)} style={{ animationDuration: `${ms}ms`, animationPlayState: paused ? 'paused' : 'running' }} />
    </div>
  );
}

function Toaster() {
  const { toasts, dismiss } = useLive();
  return (
    <div className="pointer-events-none fixed right-3 top-16 z-[60] flex flex-col gap-2" aria-live="polite">
      {toasts.map(t => <ToastCard key={t.key} t={t} onClose={() => dismiss(t.key)} />)}
    </div>
  );
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { notices, markAllRead, markRead } = useLive();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'action'>('all');
  const now = nowLocal();
  const list = notices.filter(n => filter === 'all' || n.level === 'warning' || n.level === 'critical');
  const groups: [string, Notice[]][] = [['Today', list.filter(n => n.created_at.slice(0, 10) === now.slice(0, 10))], ['Earlier', list.filter(n => n.created_at.slice(0, 10) !== now.slice(0, 10))]];
  return (
    <div className="absolute right-0 top-12 z-50 w-[24rem] overflow-hidden rounded-2xl border border-line bg-white shadow-pop animate-rise">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="font-semibold text-ink">Notifications</div>
        <div className="flex items-center gap-2">
          <div className="seg"><button data-on={filter === 'all'} onClick={() => setFilter('all')}>All</button><button data-on={filter === 'action'} onClick={() => setFilter('action')}>Needs action</button></div>
          <button className="btn-ghost btn-xs" onClick={markAllRead}>Mark all read</button>
        </div>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {groups.map(([g, items]) => items.length > 0 && (
          <div key={g}>
            <div className="bg-canvas px-4 py-1.5 text-[0.7rem] font-semibold text-muted">{g}</div>
            {items.map(n => {
              const L = LEVEL[n.level]; const I = L.icon;
              return (
                <button key={n.id} onClick={() => { markRead(n.id); if (n.link) { router.push(n.link); onClose(); } }}
                  className={clsx('flex w-full gap-3 border-b border-line/70 px-4 py-3 text-left hover:bg-canvas', !n.read && 'bg-teal-50/40')}>
                  <I className={clsx('mt-0.5 h-4 w-4 shrink-0', L.tint)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink">{n.title}</span>
                      <span className="shrink-0 text-[0.68rem] text-muted">{ago(n.created_at, now)}</span>
                    </div>
                    {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</div>}
                  </div>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-marigold-500" />}
                </button>
              );
            })}
          </div>
        ))}
        {!list.length && <div className="p-8 text-center text-sm text-muted">You are all caught up.</div>}
      </div>
    </div>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<any>({ patients: [], types: [], resources: [] });
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 10); } }, [open]);
  useEffect(() => {
    if (q.trim().length < 1) { setRes({ patients: [], types: [], resources: [] }); return; }
    const t = setTimeout(() => api(`/search?q=${encodeURIComponent(q)}`).then(setRes).catch(() => {}), 140);
    return () => clearTimeout(t);
  }, [q]);
  const items = useMemo(() => {
    const pages = NAV.filter(n => !q || n.label.toLowerCase().includes(q.toLowerCase())).map(n => ({ group: 'Go to', label: n.label, hint: '', icon: <n.icon className="h-4 w-4 text-ink-600" />, go: n.href }));
    return [
      ...res.patients.map((p: any) => ({ group: 'Patients', label: p.full_name, hint: p.mrn, icon: <Users className="h-4 w-4 text-ink-600" />, go: `/patients?id=${p.id}` })),
      ...res.types.map((t: any) => ({ group: 'Book a service', label: t.name, hint: t.category, icon: <CatIcon name={t.icon} className="h-4 w-4 text-teal-600" />, go: `/book?type=${t.id}` })),
      ...res.resources.map((r: any) => ({ group: 'Resources', label: r.name, hint: r.role_label, icon: <KindIcon kind={r.kind} />, go: `/resources?id=${r.id}` })),
      ...pages,
    ];
  }, [res, q]);
  if (!open) return null;
  const run = (i: number) => { const it = items[i]; if (it) { router.push(it.go); onClose(); } };
  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-ink-900/40 animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-pop animate-rise">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 text-ink-400" />
          <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setIdx(0); }} placeholder="Search patients, services, resources or pages"
            className="h-12 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-ink-400"
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(items.length - 1, i + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
              if (e.key === 'Enter') run(idx);
              if (e.key === 'Escape') onClose();
            }} />
          <span className="kbd">Esc</span>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? (lastGroup = it.group) : null;
            return (
              <div key={i}>
                {head && <div className="px-4 pb-1 pt-2.5 text-[0.7rem] font-semibold text-muted">{head}</div>}
                <button onMouseEnter={() => setIdx(i)} onClick={() => run(i)}
                  className={clsx('flex w-full items-center gap-3 px-4 py-2 text-left text-sm', i === idx ? 'bg-teal-50 text-ink' : 'text-text')}>
                  {it.icon}<span className="flex-1 truncate">{it.label}</span><span className="text-xs text-muted">{it.hint}</span>
                  {i === idx && <CornerDownLeft className="h-3.5 w-3.5 text-teal-600" />}
                </button>
              </div>
            );
          })}
          {!items.length && <div className="p-6 text-center text-sm text-muted">No matches for “{q}”. Try a patient name, MRN, or a service like “MRI”.</div>}
        </div>
      </div>
    </div>
  );
}

function HelpDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const key = NAV.find(n => (n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)))?.href ?? '/';
  const h = HELP[key] ?? HELP['/'];
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[55]">
      <div className="absolute inset-0 bg-ink-900/20 animate-fade-in" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-white shadow-pop animate-drawer-in">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2 font-semibold text-ink"><LifeBuoy className="h-4 w-4 text-teal-600" /> Help for this page</div>
          <button className="btn-ghost h-8 w-8 p-0" onClick={onClose} aria-label="Close help"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
          <div>
            <div className="text-base font-semibold text-ink">{h.title}</div>
            <p className="mt-1 leading-relaxed text-muted">{h.intro}</p>
          </div>
          <ol className="space-y-3">
            {h.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700">{i + 1}</span>
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
          {h.tips && <div className="rounded-xl bg-marigold-50 p-3 text-[0.82rem] leading-relaxed text-marigold-700">{h.tips}</div>}
          <div>
            <div className="mb-2 flex items-center gap-2 font-medium text-ink"><Keyboard className="h-4 w-4" /> Shortcuts</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[0.82rem]">
              <span><span className="kbd">Ctrl</span> <span className="kbd">K</span></span><span>Search anything</span>
              <span className="kbd">B</span><span>Book an appointment</span>
              <span className="kbd">?</span><span>Open this help</span>
              <span className="kbd">Esc</span><span>Close panels</span>
            </div>
          </div>
          <Link href="/help" onClick={onClose} className="btn-outline w-full">Open the full help center</Link>
        </div>
      </aside>
    </div>
  );
}

function Header({ onPalette, onHelp }: { onPalette: () => void; onHelp: () => void }) {
  const { meta, unread, ring } = useLive();
  const [bell, setBell] = useState(false);
  const now = useClock();
  const bellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bell) return;
    const h = (e: MouseEvent) => { if (!bellRef.current?.contains(e.target as Node)) setBell(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [bell]);
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-3 border-b border-ink-800 bg-ink px-3 text-white">
      <Link href="/" className="flex w-[13rem] shrink-0 items-center gap-2.5 pl-1.5">
        <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden>
          <rect x="1" y="1" width="26" height="26" rx="7" fill="#1F7A6D" />
          <path d="M7 10h14M7 14h14M7 18h14" stroke="#CFE8E2" strokeWidth="1.4" strokeLinecap="round" opacity=".55" />
          <rect x="9" y="8.6" width="6" height="2.8" rx="1.4" fill="#fff" />
          <rect x="12" y="12.6" width="8" height="2.8" rx="1.4" fill="#E8A33D" />
          <rect x="7" y="16.6" width="5" height="2.8" rx="1.4" fill="#fff" />
        </svg>
        <div className="leading-none">
          <div className="text-[1.05rem] font-semibold tracking-tight">CareGrid</div>
          <div className="mt-0.5 text-[0.65rem] text-ink-300">Scheduling and resources</div>
        </div>
      </Link>
      <button onClick={onPalette} className="hidden h-9 max-w-md flex-1 items-center gap-2 rounded-lg bg-ink-800 px-3 text-sm text-ink-300 ring-1 ring-ink-700 hover:bg-ink-700 md:flex">
        <Search className="h-4 w-4" /><span className="flex-1 text-left">Search patients, services, resources</span>
        <span className="kbd border-ink-600 bg-ink-900 text-ink-300">Ctrl K</span>
      </button>
      <button onClick={onPalette} className="btn-ghost h-9 w-9 p-0 text-white hover:bg-ink-800 md:hidden" aria-label="Search"><Search className="h-4 w-4" /></button>
      <div className="ml-auto hidden items-center gap-2 text-right lg:flex">
        <div className="leading-tight">
          <div className="text-sm font-medium tabnum">{now ? now.slice(11, 16) : '--:--'}</div>
          <div className="text-[0.68rem] text-ink-300">{meta ? niceDate(now.slice(0, 10) || meta.today) : ''}</div>
        </div>
      </div>
      <Link href="/book" className="btn-primary ml-2 h-9 bg-teal-500 hover:bg-teal-600"><CalendarPlus className="h-4 w-4" /><span className="hidden sm:inline">Book</span></Link>
      <div className="relative" ref={bellRef}>
        <button onClick={() => setBell(b => !b)} className="relative grid h-9 w-9 place-items-center rounded-lg hover:bg-ink-800" aria-label={`Notifications, ${unread} unread`}>
          <Bell key={ring} className={clsx('h-[1.15rem] w-[1.15rem]', ring > 0 && 'animate-ring')} />
          {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-marigold-500 px-1 text-[0.6rem] font-bold text-ink">{unread > 99 ? '99+' : unread}</span>}
        </button>
        {bell && <NotificationPanel onClose={() => setBell(false)} />}
      </div>
      <button onClick={onHelp} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-ink-800" aria-label="Help"><LifeBuoy className="h-[1.1rem] w-[1.1rem]" /></button>
      <div className="hidden items-center gap-2 border-l border-ink-700 pl-3 xl:flex">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-marigold-500 text-xs font-bold text-ink">FO</span>
        <div className="leading-tight"><div className="text-sm">Front office</div><div className="text-[0.68rem] text-ink-300">Main campus</div></div>
      </div>
    </header>
  );
}

function Footer() {
  const { status, lastSync } = useLive();
  const dot = status === 'live' ? 'bg-teal-500 animate-pulse-dot' : status === 'connecting' ? 'bg-marigold-500' : 'bg-crimson-500';
  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 flex h-8 items-center gap-4 border-t border-line bg-white pl-[4.75rem] pr-3 text-[0.72rem] text-muted">
      <span className="flex items-center gap-1.5"><span className={clsx('h-2 w-2 rounded-full', dot)} />
        {status === 'live' ? 'Live updates on' : status === 'connecting' ? 'Connecting to scheduling server' : 'Offline: changes from others will appear when the connection returns'}</span>
      {lastSync && <span className="hidden md:inline">Last sync {lastSync.slice(11, 16)}</span>}
      <span className="ml-auto hidden items-center gap-1.5 md:flex"><span className="kbd">Ctrl K</span> search <span className="kbd ml-2">B</span> book <span className="kbd ml-2">?</span> help</span>
      <span>CareGrid 1.0</span>
    </footer>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const onKey = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '?') { e.preventDefault(); setHelp(h => !h); }
    if (e.key.toLowerCase() === 'b') { e.preventDefault(); router.push('/book'); }
    if (e.key === '/') { e.preventDefault(); setPalette(true); }
  }, [router]);
  useEffect(() => { window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onKey]);
  return (
    <>
      <Header onPalette={() => setPalette(true)} onHelp={() => setHelp(true)} />
      <Sidebar />
      <main className="min-h-screen pb-10 pl-16 pt-14">
        <div className="w-full px-2.5 py-2.5 lg:px-3 lg:py-3">{children}</div>
      </main>
      <Footer />
      <Toaster />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <HelpDrawer open={help} onClose={() => setHelp(false)} />
    </>
  );
}
