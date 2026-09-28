'use client';
import { useFormat, Progress, WorkList, Card, Frame, type PageDef } from '@pepbits/reference-keystone-core';
import { nounOf } from '../../lib/registry';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



/** Self-service requests: balances at a glance, then the full worklist. Apply and review on separate pages. */
export default function RequestTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtCurrency, fmtNumber } = useFormat();
  const money = (def.balances?.[0]?.total ?? 0) > 100;
  return (
    <Frame>
      {def.balances && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {def.balances.map((b) => {
            const left = b.total - b.used;
            const pct = (b.used / b.total) * 100;
            return (
              <div key={b.label} className="rounded-lg border border-line bg-surface px-3.5 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[length:calc(12px*var(--fs-scale))] text-ink-3"><ReferenceText message={b.label} /></span>
                  <span className="text-[length:calc(11.5px*var(--fs-scale))] text-ink-3 tnum">{money ? fmtCurrency(b.used) : b.used} <ReferenceText message="used" /></span>
                </div>
                <div className="mt-0.5 text-[length:calc(18px*var(--fs-scale))] font-semibold tracking-tight tnum">{money ? fmtCurrency(left) : fmtNumber(left)} <span className="text-[length:calc(12px*var(--fs-scale))] font-normal text-ink-3"><ReferenceText message="left of" /> {money ? fmtCurrency(b.total) : b.total}</span></div>
                <Progress value={pct} tone={pct > 80 ? 'danger' : pct > 55 ? 'warn' : 'brand'} className="mt-1.5" />
              </div>
            );
          })}
        </div>
      )}
      <Card className="min-h-[420px] flex-1">
        <WorkList def={def} newLabel={def.entity === 'leave-requests' ? 'Apply for leave' : `New ${nounOf(def)}`} />
      </Card>
    </Frame>
  );
}
