'use client';
import { useLocalization } from '@pepbits/ops-ui';
import { useState } from 'react';
import { useRouter } from '../../lib/navigation';
import { recordPath } from '../../lib/registry';
import { useKeystoneVariant } from '../../lib/variant';
import type { ListResponse, PageDef, Row } from '../../lib/types';
import { useFormat } from '../../lib/format';
import { WorkList } from '../worklist/WorkList';
import { Card, Frame, Stat } from './shared';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** Read-only register: KPI strip from live totals, grouping, totals row and export. */
export default function ReportTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const { t } = useLocalization();
  const { fmtCompact, fmtCurrency, fmtNumber } = useFormat();
  const [res, setRes] = useState<ListResponse | null>(null);
  const router = useRouter();
  const { ownerDef, records } = useKeystoneVariant();
  // ERP2 opens the owning record page from a report row; ERP1 reports are read-only lists.
  const source = records && def.view ? ownerDef(def.entity) : undefined;
  const money = def.fields.filter((f) => f.type === 'currency').slice(0, 3);
  const qty = money.length < 3 ? def.fields.filter((f) => f.type === 'number').slice(-1) : [];
  const tones = ['brand', 'ok', 'warn', 'danger'] as const;
  return (
    <Frame>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label={referenceT("Records in view")} value={res ? fmtNumber(res.total) : '…'} hint={referenceT("After search and filters")} />
        {[...money, ...qty].slice(0, 3).map((f, i) => (
          <Stat key={f.key} label={t('Total {field}', {field: t(f.label)})} value={res ? (f.type === 'currency' ? fmtCompact(res.totals[f.key]) : fmtNumber(res.totals[f.key])) : '…'} tone={tones[i + 1]} hint={res && res.total ? t('Avg {amount} per row', {amount: f.type === 'currency' ? fmtCompact(res.totals[f.key] / res.total) : fmtNumber(Math.round(res.totals[f.key] / res.total))}) : undefined} />
        ))}
      </div>
      <Card className="min-h-[440px] flex-1">
        <WorkList def={def} readOnly showTotals groupable defaultSize={50} onLoaded={setRes} onOpen={source ? (r) => router.push(recordPath(source, r.id)) : undefined} renderers={Object.fromEntries(def.fields.filter((f) => f.type === 'currency').map((f) => [f.key, (r: Row) => (Number(r[f.key]) ? <span className="tnum">{fmtCurrency(r[f.key])}</span> : <span className="text-ink-3">—</span>)]))} />
      </Card>
    </Frame>
  );
}
