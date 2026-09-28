'use client';
import { Link, useRouter, cx, useFetch, useShortcutsEnabled, Badge, ErrorNote, IconButton, Skeleton, type PageDef, type Row, useNeighbours as useSlugNeighbours } from '@pepbits/reference-keystone-core';
import { useReducedMotion } from '@pepbits/reference-keystone-core';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { pagePath, recordPath } from '../../lib/registry';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export type Mode = 'view' | 'edit' | 'new';
export interface RecordProps { def: PageDef; id?: string; mode: Mode }

/* ───────── list ↔ record memory for previous / next (core, module-scoped) ───────── */
export { rememberIds } from '@pepbits/reference-keystone-core';
export function useNeighbours(def: PageDef, id?: string) {
  return useSlugNeighbours(def.slug, id);
}

export function useRecord(def: PageDef, id?: string) {
  const { data, loading, error, reload, setData } = useFetch<Row>(id ? `/api/entities/${def.entity}/${id}` : null);
  return { row: data, loading: loading && !data, error, reload, setRow: setData };
}

/** Warn before leaving the tab with unsaved edits. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
}

/** Ctrl/Cmd + S runs the given save handler. */
export function useSaveShortcut(onSave: (() => void) | null) {
  const shortcuts = useShortcutsEnabled();
  useEffect(() => {
    if (!onSave || !shortcuts) return;
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); onSave(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onSave, shortcuts]);
}

/* ───────── chrome ───────── */
export function RecordBar({ def, id, mode, children, dirty }: { def: PageDef; id?: string; mode: Mode; children?: ReactNode; dirty?: boolean }) {
 const referenceT = useReferenceLocalization().t;

  const router = useRouter();
  const nb = useNeighbours(def, id);
  const go = (to: string | null) => to && router.push(recordPath(def, to));
  return (
    <div className="sticky top-0 z-20 flex min-h-12 flex-wrap items-center gap-2 border-b border-line bg-surface/95 px-3 py-1.5 backdrop-blur md:px-5">
      <Link href={pagePath(def)} className="inline-flex items-center gap-1.5 rounded-md py-1 pl-1.5 pr-2.5 text-[length:calc(13px*var(--fs-scale))] font-medium text-ink-2 hover:bg-surface-3 hover:text-ink" title={referenceT("Back to {value0}", {value0: def.title})}>
        <ArrowLeft size={16} />
        <span className="hidden sm:inline"><ReferenceText message={def.title} /></span>
      </Link>
      {mode === 'view' && nb.index >= 0 && nb.total > 1 && (
        <div className="flex items-center gap-0.5 border-l border-line pl-2">
          <IconButton icon={ChevronLeft} size="sm" label={referenceT("Previous record")} disabled={!nb.prev} onClick={() => go(nb.prev)} />
          <span className="px-1 text-[length:calc(12px*var(--fs-scale))] text-ink-3 tnum">{nb.index + 1} <ReferenceText message="of" /> {nb.total}</span>
          <IconButton icon={ChevronRight} size="sm" label={referenceT("Next record")} disabled={!nb.next} onClick={() => go(nb.next)} />
        </div>
      )}
      {mode !== 'view' && <Badge tone={mode === 'new' ? 'brand' : 'warn'} className="ml-1">{mode === 'new' ? referenceT("Creating") : referenceT("Editing")}</Badge>}
      {dirty && <span className="hidden text-[length:calc(12px*var(--fs-scale))] text-warn sm:inline"><ReferenceText message="Unsaved changes" /></span>}
      <span className="flex-1" />
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={cx('mx-auto w-full space-y-4 px-3 py-4 md:px-5 md:py-5', wide ? 'max-w-[1680px]' : 'max-w-[1440px]')}>{children}</div>;
}

export function Section({ id, title, description, children, actions, bodyClass }: { id?: string; title: ReactNode; description?: ReactNode; children: ReactNode; actions?: ReactNode; bodyClass?: string }) {
  return (
    <section id={id} className="scroll-mt-16 rounded-xl border border-line bg-surface">
      <header className="flex items-start gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[length:calc(13.5px*var(--fs-scale))] font-semibold text-ink">{typeof title === 'string' ? <ReferenceText message={title} /> : title}</h2>
          {description && <p className="mt-0.5 text-[length:calc(12.5px*var(--fs-scale))] text-ink-3">{description}</p>}
        </div>
        {actions}
      </header>
      <div className={bodyClass ?? 'p-5'}>{children}</div>
    </section>
  );
}

/** Sticky in-page navigation that follows scroll position. */
export function SectionNav({ items }: { items: { id: string; label: string; flag?: boolean }[] }) {
  const reducedMotion = useReducedMotion();
 const referenceT = useReferenceLocalization().t;

  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.id);
    }, { rootMargin: '-80px 0px -55% 0px' });
    items.forEach((i) => { const el = document.getElementById(i.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [items]);
  return (
    <nav className="sticky top-16 hidden self-start lg:block" aria-label={referenceT("Sections")}>
      <ul className="space-y-0.5">
        {items.map((i) => (
          <li key={i.id}>
            <button onClick={() => document.getElementById(i.id)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })}
              className={cx('relative flex w-full items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-left text-[length:calc(13px*var(--fs-scale))] transition-colors', active === i.id ? 'bg-surface font-medium text-ink shadow-sm' : 'text-ink-3 hover:text-ink')}>
              {active === i.id && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-accent" />}
              <span className="flex-1 truncate"><ReferenceText message={i.label} /></span>
              {i.flag && <span className="h-1.5 w-1.5 rounded-full bg-danger" title={referenceT("Needs attention")} />}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function StatStrip({ items }: { items: { label: string; value: ReactNode; tone?: string }[] }) {
  if (!items.length) return null;
  return (
    <dl data-reference-result className="grid gap-px overflow-hidden rounded-lg border border-line bg-line" style={{ gridTemplateColumns: `repeat(${Math.min(4, items.length)}, minmax(0, 1fr))` }}>
      {items.map((s) => (
        <div key={s.label} className="bg-surface px-4 py-2.5">
          <dt className="truncate text-[length:calc(11.5px*var(--fs-scale))] text-ink-3"><ReferenceText message={s.label} /></dt>
          <dd className={cx('truncate text-[length:calc(16px*var(--fs-scale))] font-semibold tracking-tight tnum', s.tone)}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RecordLoading({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  if (error) return <Page><ErrorNote message={error} onRetry={onRetry} /></Page>;
  return (
    <Page>
      <div className="rounded-xl border border-line bg-surface p-5"><Skeleton className="mb-3 h-5 w-48" /><Skeleton className="w-80" /></div>
      <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
        <div className="hidden space-y-2 lg:block">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-6" />)}</div>
        <div className="space-y-4">{[1, 2].map((i) => <div key={i} className="rounded-xl border border-line bg-surface p-5"><Skeleton className="mb-4 w-32" /><div className="grid grid-cols-3 gap-4">{[1, 2, 3, 4, 5, 6].map((j) => <Skeleton key={j} className="h-8" />)}</div></div>)}</div>
      </div>
    </Page>
  );
}
