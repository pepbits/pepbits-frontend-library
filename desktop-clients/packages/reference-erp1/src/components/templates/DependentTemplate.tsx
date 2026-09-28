'use client';
import { cx, useList, useMediaQuery, Input, Select, Skeleton, WorkList, Card, Frame, type PageDef } from '@pepbits/reference-keystone-core';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** Child records filtered by a parent picked on the left (e.g. states by country). */
export default function DependentTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const p = def.parent!;
  const [parent, setParent] = useState<string | null>(null);
  const [pq, setPq] = useState('');
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const parents = useList(p.entity, { size: 500 });
  const counts = useList(def.entity, { size: 1, facet: p.key });
  const names = useMemo(() => (parents.data?.rows ?? []).map((r) => ({ name: String(r.name), code: String(r.code ?? ''), n: counts.data?.facets[String(r.name)] ?? 0 })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)), [parents.data, counts.data]);
  const shown = names.filter((x) => `${x.name} ${x.code}`.toLowerCase().includes(pq.toLowerCase()));
  const total = counts.data?.total ?? 0;
  const fields = def.fields.filter((f) => !(parent && f.key === p.key) && f.list !== false);

  return (
    <Frame className="md:flex-row">
      {isDesktop ? (
        <Card className="flex w-64 shrink-0 flex-col xl:w-72">
          <div className="border-b border-line p-2.5">
            <div className="mb-2 flex items-center justify-between px-0.5">
              <span className="text-[length:calc(13px*var(--fs-scale))] font-semibold"><ReferenceText message={p.label} /></span>
              <span className="text-[length:calc(12px*var(--fs-scale))] text-ink-3 tnum">{names.length}</span>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <Input value={pq} onChange={(e) => setPq(e.target.value)} placeholder={referenceT("Find {value0}", {value0: referenceT(p.label)})} className="pl-8" />
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
            <li>
              <button onClick={() => setParent(null)} className={cx('flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[length:calc(13px*var(--fs-scale))]', !parent ? 'bg-brand-soft font-medium text-brand-ink' : 'hover:bg-surface-2')}>
                <span>{referenceT("All {parent} records", {parent: referenceT(p.label)})}</span>
                <span className="text-[length:calc(12px*var(--fs-scale))] tnum text-ink-3">{total}</span>
              </button>
            </li>
            {!parents.data && Array.from({ length: 10 }, (_, i) => <li key={i} className="px-2.5 py-2"><Skeleton className="w-3/4" /></li>)}
            {shown.map((x) => (
              <li key={x.name}>
                <button onClick={() => setParent(x.name)} className={cx('flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[length:calc(13px*var(--fs-scale))]', parent === x.name ? 'bg-brand-soft font-medium text-brand-ink' : 'hover:bg-surface-2', !x.n && 'text-ink-3')}>
                  <span className="w-7 shrink-0 text-[length:calc(11.5px*var(--fs-scale))] text-ink-3">{x.code}</span>
                  <span className="flex-1 truncate">{x.name}</span>
                  <span className={cx('rounded px-1.5 text-[length:calc(11.5px*var(--fs-scale))] tnum', x.n ? 'bg-surface-3 text-ink-2' : 'text-ink-3')}>{x.n}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Select value={parent ?? ''} onChange={(e) => setParent(e.target.value || null)} aria-label={p.label}>
          <option value="">{referenceT("All {parent} records", {parent: referenceT(p.label)})}</option>
          {names.map((x) => <option key={x.name} value={x.name}>{x.name} ({x.n})</option>)}
        </Select>
      )}
      <Card className="flex min-h-[480px] min-w-0 flex-1 flex-col">
        <WorkList
          key={parent ?? 'all'}
          def={def}
          fields={fields}
          fixedFilters={parent ? { [p.key]: [parent] } : undefined}
          newDefaults={parent ? { [p.key]: parent } : undefined}
          inlineEdit
          newLabel="Add row"
        />
      </Card>
    </Frame>
  );
}
