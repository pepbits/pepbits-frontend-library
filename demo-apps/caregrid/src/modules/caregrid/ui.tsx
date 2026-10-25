'use client';
import React from 'react';
import {
  Activity, Apple, Armchair, Baby, Bed, BedDouble, Brain, Car, Clipboard, ClipboardList, Cpu, DoorOpen, Droplet, Footprints, HeartPulse, House,
  Leaf, Pill, Repeat, Scan, Scissors, ShieldCheck, Siren, Smile, Stethoscope, TestTube, User, Video, type IconComponent,
} from '@pepbits/icons';
import {Badge} from '@pepbits/ui';
import {Card, Pagination, RecoveryNotice, failureFromError} from '@pepbits/components';
import {CollectionView, type CollectionViewProps} from '@pepbits/components/collection-view';
import {usePreferences} from '@pepbits/preferences/react';
import {useLocalization} from '@pepbits/i18n/react';
import {KIND_ONE, KIND_TONE, STATUS_LABEL, STATUS_TONE} from './labels';

const CATEGORY_ICONS: Record<string, IconComponent> = {
  stethoscope: Stethoscope, 'heart-pulse': HeartPulse, 'test-tube': TestTube, scan: Scan, activity: Activity, scissors: Scissors, bed: Bed,
  smile: Smile, footprints: Footprints, brain: Brain, baby: Baby, repeat: Repeat, 'shield-check': ShieldCheck, pill: Pill, house: House,
  apple: Apple, leaf: Leaf, video: Video, siren: Siren, droplet: Droplet, 'clipboard-list': ClipboardList,
};
const KIND_ICONS: Record<string, IconComponent> = {person: User, machine: Cpu, room: DoorOpen, chair: Armchair, bed: BedDouble, vehicle: Car};

/** Category glyph; the department colour is API data identifying the service line. */
export function CatIcon({name, color, className = 'size-4'}: {name?: string | null; color?: string; className?: string}) {
  const Icon = (name && CATEGORY_ICONS[name]) || Clipboard;
  return <Icon aria-hidden className={className} style={color ? {color} : undefined} strokeWidth={1.8}/>;
}
export function KindIcon({kind, className = 'size-4'}: {kind: string; className?: string}) {
  const Icon = KIND_ICONS[kind] ?? User;
  return <Icon aria-hidden className={className} style={{color: KIND_TONE[kind]}} strokeWidth={1.9}/>;
}
export function KindTag({kind}: {kind: string}) {
  const {t} = useLocalization();
  return <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-xs font-medium"><KindIcon kind={kind} className="size-3"/>{t(KIND_ONE[kind] ?? kind)}</span>;
}
export function StatusPill({status}: {status: string}) {
  const {t} = useLocalization();
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'} className={status === 'cancelled' ? 'line-through' : undefined}>{t(STATUS_LABEL[status] ?? status)}</Badge>;
}
/** Decorative bar; every meter is accompanied by its visible percentage. */
export function Meter({pct, color = 'var(--primary)', className = ''}: {pct: number; color?: string; className?: string}) {
  return <div aria-hidden className={`h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)] ${className}`}><div className="h-full rounded-full" style={{width: `${Math.min(100, Math.max(0, pct))}%`, background: color}}/></div>;
}
export function Panel({title, aside, children, className = '', bodyClassName = 'px-4 pb-4', id}: {title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string; id?: string}) {
  return <Card as="section" id={id} className={`flex min-w-0 flex-col ${className}`}>
    {title || aside ? <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">{title ? <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2> : <span/>}{aside}</div> : null}
    <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
  </Card>;
}
/** Toggle chip with a pressed state, used for filters and single choices from long lists. */
export function Chip({pressed, onClick, children, label, disabled}: {pressed?: boolean; onClick: () => void; children: React.ReactNode; label?: string; disabled?: boolean}) {
  return <button type="button" className="cg-chip" aria-pressed={pressed === undefined ? undefined : pressed} aria-label={label} disabled={disabled} onClick={onClick}>{children}</button>;
}
export function QueryError({error, onRetry}: {error: unknown; onRetry?: () => void}) {
  return error ? <RecoveryNotice failure={failureFromError(error)} onRetry={onRetry}/> : null;
}
export interface Segment {label: string; kind: string; offset: number; duration: number | null; name?: string}
/** Which resource is held for which minutes of an appointment, relative to patient arrival. */
export function SegmentStrip({segments, total, detailed = false}: {segments: readonly Segment[]; total: number; detailed?: boolean}) {
  const {t} = useLocalization();
  const low = Math.min(0, ...segments.map(s => s.offset)), high = Math.max(total, ...segments.map(s => s.offset + (s.duration ?? total)));
  const span = Math.max(1, high - low), pct = (minute: number) => (minute - low) / span * 100;
  if (!detailed) return <div aria-hidden className="relative flex h-3.5 w-full flex-col justify-center gap-[2px]" title={segments.map(s => s.label).join(', ')}>
    {segments.slice(0, 6).map((s, i) => <div key={i} className="relative h-[3px] w-full rounded-full bg-[var(--surface-3)]"><div className="absolute h-full rounded-full" style={{insetInlineStart: `${pct(s.offset)}%`, width: `${Math.max(2, pct(s.offset + (s.duration ?? total)) - pct(s.offset))}%`, background: KIND_TONE[s.kind]}}/></div>)}
  </div>;
  return <div className="space-y-1.5" data-segment-strip>
    {segments.map((s, i) => {const length = s.duration ?? total; return <div key={i} className="grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3 text-xs">
      <div className="flex min-w-0 items-center gap-1.5"><KindIcon kind={s.kind} className="size-3.5 shrink-0"/><span className="truncate" title={s.name ?? s.label}>{s.name ?? s.label}</span></div>
      <div className="relative h-5 rounded-md bg-[var(--surface-2)]">
        {low < 0 ? <div aria-hidden className="absolute inset-y-0 border-s border-dashed border-[var(--border-strong)]" style={{insetInlineStart: `${pct(0)}%`}}/> : null}
        <div className="absolute inset-y-0.5 flex items-center rounded px-1.5 text-[0.65rem] font-semibold text-white" style={{insetInlineStart: `${pct(s.offset)}%`, width: `${Math.max(3, pct(s.offset + length) - pct(s.offset))}%`, background: KIND_TONE[s.kind]}}>
          <span className="truncate">{s.offset !== 0 ? `${s.offset > 0 ? '+' : ''}${s.offset}′ ` : ''}{length}′</span>
        </div>
      </div>
    </div>;})}
    {low < 0 ? <p className="ps-[12rem] text-[0.68rem] text-[var(--text-muted)]">{t('Dashed line marks patient arrival; segments left of it happen before the patient arrives.')}</p> : null}
  </div>;
}

/** Preference-bound list: effective result view, managed page size and its guarded update path (PREF-04). */
export function PagedCollection<T>({rows, resetKey, ...props}: Omit<CollectionViewProps<T>, 'view'> & {resetKey?: string}) {
  const {preferences, isLocked, allowedValues, update} = usePreferences();
  const [page, setPage] = React.useState(1), size = preferences.pageSize;
  React.useEffect(() => setPage(1), [resetKey, size]);
  const pages = Math.max(1, Math.ceil(rows.length / size)), current = Math.min(page, pages);
  return <div className="space-y-2">
    <CollectionView {...props} rows={rows.slice((current - 1) * size, current * size)} view={preferences.resultView === 'cards' ? 'cards' : 'table'}/>
    {rows.length > 10 ? <Pagination page={current} pageSize={size} total={rows.length} allowedPageSizes={allowedValues('pageSize')} pageSizeDisabled={isLocked('pageSize')} onPageChange={setPage} onPageSizeChange={next => {void update({pageSize: next}); setPage(1);}}/> : null}
  </div>;
}
