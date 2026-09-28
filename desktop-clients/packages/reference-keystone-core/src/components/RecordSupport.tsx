'use client';
/*
 * Record activity and documents from GET /api/entities/:entity/:id/support. Loading,
 * failure (with retry) and empty states are shown as they are; nothing is invented.
 * `compact` selects the ERP2 record-page spacing, otherwise the ERP1 drawer spacing.
 * Files the user picks (LocalAttachments) stay separate and are never uploaded.
 */
import { FileText } from 'lucide-react';
import { useReferenceHost } from '@pepbits/reference-host';
import { useEntitySupport } from '../lib/api';
import { useFormat, cx } from '../lib/format';
import { Skeleton, ErrorNote, LocalAttachments } from './ui';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



function Pending({ rows }: { rows: number }) {
 const referenceT = useReferenceLocalization().t;

  const { preferences } = useReferenceHost();
  return <div aria-busy="true" className="space-y-2">{preferences.loadingSkeletons === false && <p role="status"><ReferenceText message="Loading record details…" /></p>}{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div>;
}

export function RecordActivity({ entity, id, compact }: { entity: string; id: string; compact?: boolean }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate } = useFormat();
  const support = useEntitySupport(entity, id);
  if (support.status === 'error') return <ErrorNote message={`Activity could not be loaded. ${support.error ?? ''}`.trim()} onRetry={support.retry} />;
  if (!support.data) return <Pending rows={3} />;
  const items = support.data.activities;
  if (!items.length) return <p className="text-[length:calc(12.5px*var(--fs-scale))] text-ink-3"><ReferenceText message="No activity recorded for this record yet." /></p>;
  return (
    <ol className={cx('relative border-l border-line', compact ? 'ml-1.5 pl-4' : 'ml-2 pl-5')}>
      {items.map((a, i) => (
        <li key={i} className={cx('relative last:pb-0', compact ? 'pb-3.5' : 'pb-4')}>
          <span className={cx('absolute top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand', compact ? '-left-[21px]' : '-left-[25px]')} />
          <div className={cx('text-[length:calc(13px*var(--fs-scale))] text-ink', compact && 'leading-snug')}>{a.text}</div>
          <div className={cx('text-ink-3', compact ? 'text-[length:calc(11.5px*var(--fs-scale))]' : 'text-[length:calc(12px*var(--fs-scale))]')}>{a.who}, {fmtDate(a.when)}</div>
        </li>
      ))}
    </ol>
  );
}

export function RecordDocuments({ entity, id, compact, includeLocalAttachments = true }: { entity: string; id: string; compact?: boolean; includeLocalAttachments?: boolean }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate } = useFormat();
  const support = useEntitySupport(entity, id);
  const list = support.status === 'error'
    ? <ErrorNote message={`Documents could not be loaded. ${support.error ?? ''}`.trim()} onRetry={support.retry} />
    : !support.data ? <Pending rows={2} />
    : !support.data.documents.length ? <p className="text-[length:calc(12.5px*var(--fs-scale))] text-ink-3"><ReferenceText message="No documents are stored for this record." /></p>
    : (
      <ul className="divide-y divide-line rounded-lg border border-line">
        {support.data.documents.map((d) => (
          <li key={d.name} className={cx('flex items-center px-3 py-2', compact ? 'gap-2.5' : 'gap-3')}>
            <FileText size={compact ? 15 : 16} className="shrink-0 text-ink-3" />
            <span className={cx('flex-1 truncate', compact ? 'text-[length:calc(12.5px*var(--fs-scale))]' : 'text-[length:calc(13px*var(--fs-scale))]')}>{d.name}</span>
            <span className={cx('text-ink-3', compact ? 'text-[length:calc(11.5px*var(--fs-scale))]' : 'text-[length:calc(12px*var(--fs-scale))]')}>{d.size}</span>
            {!compact && d.when && <span className="hidden text-[length:calc(12px*var(--fs-scale))] text-ink-3 sm:inline">{fmtDate(d.when)}</span>}
          </li>
        ))}
      </ul>
    );
  return compact
    ? <div className="space-y-2">{list}{includeLocalAttachments && <LocalAttachments compact />}</div>
    : <div className="space-y-3">{includeLocalAttachments && <LocalAttachments />}{list}</div>;
}
