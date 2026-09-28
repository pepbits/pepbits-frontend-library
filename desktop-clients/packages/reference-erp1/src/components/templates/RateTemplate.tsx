'use client';
import { cx, todayISO, useFormat, Input, StatusBadge, DateInput, WorkList, Card, Frame, type PageDef, type Row } from '@pepbits/reference-keystone-core';
import { useState } from 'react';
import { X } from 'lucide-react';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const SPAN = 365; // days either side of today shown on the validity bar

function validity(row: Row, on = todayISO()) {
  if (row.effectiveFrom && row.effectiveFrom > on) return 'Upcoming';
  if (row.effectiveTo && row.effectiveTo < on) return 'Expired';
  return 'Active';
}

function ValidityBar({ row }: { row: Row }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate } = useFormat();
  const t0 = Date.now() - SPAN * 864e5;
  const pos = (iso?: string, fallback = 1) => (iso ? Math.max(0, Math.min(1, (+new Date(`${iso}T00:00:00`) - t0) / (2 * SPAN * 864e5))) : fallback);
  const a = pos(row.effectiveFrom, 0);
  const b = pos(row.effectiveTo, 1);
  const v = validity(row);
  return (
    <div className="relative h-2 w-28 rounded-full bg-surface-3" title={referenceT("{value0} to {value1}", {value0: fmtDate(row.effectiveFrom), value1: row.effectiveTo ? fmtDate(row.effectiveTo) : 'open-ended'})}>
      <span className={cx('absolute top-0 h-2 rounded-full', v === 'Active' ? 'bg-ok' : v === 'Upcoming' ? 'bg-info' : 'bg-line-strong')} style={{ left: `${a * 100}%`, width: `${Math.max(2, (b - a) * 100)}%` }} />
      <span className="absolute -top-0.5 h-3 w-0.5 bg-accent" style={{ left: '50%' }} />
    </div>
  );
}

/** Effective-dated prices, taxes and fees. Filter to what applied on any date. */
export default function RateTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate } = useFormat();
  const [asOf, setAsOf] = useState('');
  return (
    <Frame>
      <Card className="flex-1">
        <WorkList
          def={def}
          inlineEdit
          newLabel="Add rate"
          extraParams={{ asOf: asOf || undefined }}
          renderers={{ effectiveTo: (r) => <span className="tnum text-ink-2">{r.effectiveTo ? fmtDate(r.effectiveTo) : referenceT("Open-ended")}</span> }}
          extraColumns={[
            { key: 'validity', label: 'Validity', render: (r) => <div className="flex items-center gap-2.5"><StatusBadge value={validity(r, asOf || undefined)} /><ValidityBar row={r} /></div> },
          ]}
          toolbarExtra={
            <div className="flex items-center gap-1.5">
              <label htmlFor="asof" className="whitespace-nowrap text-[length:calc(12.5px*var(--fs-scale))] text-ink-3"><ReferenceText message="Valid on" /></label>
              <DateInput id="asof" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-36" />
              {asOf ? (
                <button onClick={() => setAsOf('')} className="rounded p-1 text-ink-3 hover:text-ink" aria-label={referenceT("Show all dates")}><X size={14} /></button>
              ) : (
                <button onClick={() => setAsOf(todayISO())} className="whitespace-nowrap text-[length:calc(12.5px*var(--fs-scale))] text-brand hover:underline"><ReferenceText message="Today" /></button>
              )}
            </div>
          }
        />
      </Card>
    </Frame>
  );
}
