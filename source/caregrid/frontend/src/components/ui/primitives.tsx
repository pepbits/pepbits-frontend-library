'use client';
import clsx from 'clsx';
import {
  Activity, AlertTriangle, Apple, Baby, Bed, BedDouble, Brain, Car, Clipboard, ClipboardList, Cpu, DoorOpen, Droplet, Footprints, HeartPulse, House,
  Leaf, Loader2, Pill, Repeat, Scan, Scissors, ShieldCheck, Siren, Smile, Stethoscope, TestTube, User, Video, X, Armchair,
} from 'lucide-react';
import { useEffect } from 'react';
import { KIND_COLOR, KIND_ONE, STATUS_LABEL, STATUS_STYLE } from '@/lib/meta';

const CAT_ICONS: Record<string, any> = {
  stethoscope: Stethoscope, 'heart-pulse': HeartPulse, 'test-tube': TestTube, scan: Scan, activity: Activity, scissors: Scissors, bed: Bed,
  smile: Smile, footprints: Footprints, brain: Brain, baby: Baby, repeat: Repeat, 'shield-check': ShieldCheck, pill: Pill, house: House,
  apple: Apple, leaf: Leaf, video: Video, siren: Siren, droplet: Droplet, 'clipboard-list': ClipboardList,
};
export function CatIcon({ name, className, style }: { name?: string; className?: string; style?: React.CSSProperties }) {
  const I = (name && CAT_ICONS[name]) || Clipboard;
  return <I className={className ?? 'h-4 w-4'} style={style} strokeWidth={1.8} />;
}

const KIND_ICONS: Record<string, any> = { person: User, machine: Cpu, room: DoorOpen, chair: Armchair, bed: BedDouble, vehicle: Car };
export function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const I = KIND_ICONS[kind] ?? User;
  return <I className={className ?? 'h-4 w-4'} style={{ color: KIND_COLOR[kind] }} strokeWidth={1.9} />;
}
export function KindTag({ kind }: { kind: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium" style={{ background: KIND_COLOR[kind] + '14', color: KIND_COLOR[kind] }}>
      <KindIcon kind={kind} className="h-3 w-3" /> {KIND_ONE[kind]}
    </span>
  );
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-semibold', STATUS_STYLE[status], className)}>{STATUS_LABEL[status] ?? status}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin text-teal-600', className ?? 'h-5 w-5')} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-lg bg-ink-100/70', className)} />;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-crimson-100 bg-crimson-50 p-3 text-sm text-crimson-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && <button className="btn-outline btn-xs" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icon && <div className="mb-1 grid h-11 w-11 place-items-center rounded-full bg-ink-100 text-ink-600">{icon}</div>}
      <div className="font-semibold text-ink">{title}</div>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, width = 'max-w-[34rem]', footer }: {
  open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; width?: string; footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink-900/30 animate-fade-in" onClick={onClose} />
      <aside role="dialog" aria-modal="true" className={clsx('absolute right-0 top-0 flex h-full w-full flex-col bg-white shadow-pop animate-drawer-in', width)}>
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="text-lg font-semibold leading-tight text-ink">{title}</div>
            {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
          </div>
          <button className="btn-ghost h-8 w-8 p-0" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-line bg-canvas/60 px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink-900/35 animate-fade-in" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl bg-white shadow-pop animate-rise">
        <div className="px-5 pt-5 text-lg font-semibold text-ink">{title}</div>
        <div className="px-5 py-3 text-sm">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 pb-5">{footer}</div>}
      </div>
    </div>
  );
}

export interface Seg { label: string; kind: string; offset: number; duration: number | null; name?: string }
/** The signature element: shows which resource is held for which minutes of an appointment. */
export function SegmentStrip({ segments, total, detailed = false, className }: { segments: Seg[]; total: number; detailed?: boolean; className?: string }) {
  const minOff = Math.min(0, ...segments.map(s => s.offset));
  const maxEnd = Math.max(total, ...segments.map(s => s.offset + (s.duration ?? total)));
  const span = Math.max(1, maxEnd - minOff);
  const pct = (m: number) => ((m - minOff) / span) * 100;
  if (!detailed) {
    return (
      <div className={clsx('relative flex h-3.5 w-full flex-col justify-center gap-[2px]', className)} title={segments.map(s => s.label).join(', ')}>
        {segments.slice(0, 6).map((s, i) => (
          <div key={i} className="relative h-[3px] w-full rounded-full bg-ink-100/60">
            <div className="absolute h-full rounded-full" style={{ left: `${pct(s.offset)}%`, width: `${Math.max(2, pct(s.offset + (s.duration ?? total)) - pct(s.offset))}%`, background: KIND_COLOR[s.kind] }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={clsx('space-y-1.5', className)}>
      {segments.map((s, i) => {
        const d = s.duration ?? total;
        return (
          <div key={i} className="grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3 text-xs">
            <div className="flex min-w-0 items-center gap-1.5">
              <KindIcon kind={s.kind} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-ink" title={s.name ?? s.label}>{s.name ?? s.label}</span>
            </div>
            <div className="relative h-5 rounded-md bg-canvas">
              {minOff < 0 && <div className="absolute inset-y-0 border-l border-dashed border-ink-300" style={{ left: `${pct(0)}%` }} />}
              <div className="absolute inset-y-0.5 flex items-center rounded px-1.5 text-[0.65rem] font-semibold text-white"
                style={{ left: `${pct(s.offset)}%`, width: `${Math.max(3, pct(s.offset + d) - pct(s.offset))}%`, background: KIND_COLOR[s.kind] }}>
                <span className="truncate">{s.offset !== 0 ? `${s.offset > 0 ? '+' : ''}${s.offset}′ ` : ''}{d}′</span>
              </div>
            </div>
          </div>
        );
      })}
      {minOff < 0 && <div className="pl-[12rem] text-[0.68rem] text-muted">Dashed line marks patient arrival; segments left of it happen before the patient arrives.</div>}
    </div>
  );
}

export function Meter({ pct, color = '#1F7A6D', className }: { pct: number; color?: string; className?: string }) {
  return (
    <div className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-ink-100', className)}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const clean = name.replace(/^Dr\.\s*/, '');
  const ini = clean.split(' ').map(x => x[0]).slice(0, 2).join('');
  let h = 0; for (const c of clean) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className={clsx('inline-grid shrink-0 place-items-center rounded-full font-semibold text-white', className ?? 'h-8 w-8 text-xs')} style={{ background: `hsl(${h} 38% 42%)` }}>
      {ini}
    </span>
  );
}
