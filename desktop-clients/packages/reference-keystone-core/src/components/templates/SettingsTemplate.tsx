'use client';
import { useReducedMotion } from '../../lib/session';
import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import type { PageDef, Row } from '../../lib/types';
import { cx } from '../../lib/format';
import { useFetch, useEntityApi } from '../../lib/client';
import { Button, ErrorNote, Skeleton, useToast } from '../ui';
import { RecordForm } from '../form/RecordForm';
import { Card, Frame } from './shared';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** Single-record settings: jump between sections, save once, see what changed. */
export default function SettingsTemplate({ def }: { def: PageDef }) {
  const reducedMotion = useReducedMotion();
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const toast = useToast();
  const sections = def.sections ?? [];
  const { data, loading, error, reload } = useFetch<Row>(`/api/entities/${def.entity}/1`);
  const [draft, setDraft] = useState<Partial<Row>>({});
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => { if (data) setDraft(data); }, [data]);
  const changed = data ? Object.keys(draft).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(data[k])) : [];

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(Number((vis.target as HTMLElement).dataset.i));
    }, { root, rootMargin: '0px 0px -60% 0px' });
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await entityApi.update(def.entity, '1', draft);
      toast(referenceT(changed.length === 1 ? "Saved {count} change" : "Saved {count} changes", {count: changed.length}));
      reload();
    } catch (e) { toast((e as Error).message, 'danger'); } finally { setSaving(false); }
  };

  return (
    <Frame className="md:flex-row">
      <Card className="hidden w-60 shrink-0 self-start md:block">
        <nav className="p-1.5">
          {sections.map((s, i) => {
            const dirty = s.fields.some((f) => changed.includes(f.key));
            return (
              <button key={s.title} onClick={() => refs.current[i]?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })}
                className={cx('relative flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[length:calc(13px*var(--fs-scale))]', active === i ? 'bg-brand-soft font-medium text-brand-ink' : 'text-ink-2 hover:bg-surface-2')}>
                {active === i && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-accent" />}
                <span className="flex-1">{referenceT(s.title)}</span>
                {dirty && <span className="h-1.5 w-1.5 rounded-full bg-warn" title={referenceT("Unsaved changes")} />}
              </button>
            );
          })}
        </nav>
      </Card>

      <Card className="relative flex min-h-[480px] min-w-0 flex-1 flex-col">
        {error && <ErrorNote message={error} onRetry={reload} />}
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
          {sections.map((s, i) => (
            <section key={s.title} ref={(el) => { refs.current[i] = el; }} data-i={i} className="grid scroll-mt-2 gap-4 border-b border-line px-5 py-5 last:border-0 xl:grid-cols-[240px_minmax(0,1fr)]">
              <div>
                <h2 className="text-[length:calc(14px*var(--fs-scale))] font-semibold">{referenceT(s.title)}</h2>
                <p className="mt-0.5 text-[length:calc(12.5px*var(--fs-scale))] text-ink-3"><ReferenceText message={s.description} /></p>
              </div>
              {loading && !data ? (
                <div className="grid grid-cols-2 gap-4">{s.fields.map((f) => <Skeleton key={f.key} className="h-8" />)}</div>
              ) : (
                <RecordForm fields={s.fields} value={draft} onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} columns={2} />
              )}
            </section>
          ))}
          <div className="h-16" />
        </div>
        {changed.length > 0 && (
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-lg bg-rail px-4 py-2.5 text-[length:calc(13px*var(--fs-scale))] text-white shadow-pop anim-pop">
            <span className="flex-1">{referenceT(changed.length === 1 ? "{count} unsaved change" : "{count} unsaved changes", {count: changed.length})}</span>
            <Button variant="ghost" icon={RotateCcw} className="!text-rail-ink hover:!bg-rail-3" onClick={() => data && setDraft(data)}><ReferenceText message="Discard" /></Button>
            <Button variant="primary" icon={Save} loading={saving} onClick={save}><ReferenceText message="Save changes" /></Button>
          </div>
        )}
      </Card>
    </Frame>
  );
}
