'use client';
import { cls } from '../lib/format';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';


const STEPS = ['ORDERED', 'COLLECTED', 'ACCESSIONED', 'RESULTED', 'VALIDATED', 'SIGNED'];
const LABEL: Record<string, string> = { ORDERED: 'Order', COLLECTED: 'Drawn', ACCESSIONED: 'In lab', RESULTED: 'Result', VALIDATED: 'Valid', SIGNED: 'Signed' };
/** Where each status sits on the journey (analyzer/outsourced sit between accession and result). */
const POS: Record<string, number> = { ORDERED: 0, BILLED: 0, COLLECTED: 1, ACCESSIONED: 2, IN_ANALYZER: 2.5, OUTSOURCED: 2.5, RESULTED: 3, AMENDING: 3, VALIDATED: 4, SIGNED: 5 };

/** Compact six-segment workflow rail for a single test. */
export function StatusRail({ status, compact }: { status: string; compact?: boolean }) {
  if (status === 'CANCELLED') return <span className="text-xs text-ink-mute line-through"><ReferenceText message="Cancelled" /></span>;
  const pos = POS[status] ?? 0;
  return (
    <div className="flex items-center gap-0.5" title={status.replace('_', ' ').toLowerCase()}>
      {STEPS.map((s, i) => {
        const done = i <= pos;
        const partial = i === Math.ceil(pos) && pos % 1 !== 0;
        return (
          <div key={s} className="flex flex-col items-center">
            <span className={cls('block h-1.5 rounded-sm', compact ? 'w-4' : 'w-8',
              status === 'AMENDING' && i === 3 ? 'bg-flag-high' : partial ? 'bg-lab-100' : done ? (i === 5 ? 'bg-flag-ok' : 'bg-lab-600') : 'bg-line')} />
            {!compact && <span className={cls('mt-0.5 text-[9px] leading-none', done ? 'text-ink-soft' : 'text-ink-mute/70')}>{LABEL[s]}</span>}
          </div>
        );
      })}
    </div>
  );
}
