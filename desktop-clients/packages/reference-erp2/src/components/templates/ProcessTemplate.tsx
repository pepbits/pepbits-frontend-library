'use client';
import { useFormat, WorkList, Card, Frame, Stat, type ListResponse, type PageDef, type Row } from '@pepbits/reference-keystone-core';
import { useState } from 'react';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** Batch jobs: run history is the worklist; "Start new run" opens the run page. */
export default function ProcessTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtCompact, fmtDate } = useFormat();
  const [res, setRes] = useState<ListResponse | null>(null);
  const last: Row | undefined = res?.rows[0];
  const failed = res?.facets.Failed ?? 0;
  return (
    <Frame>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label={referenceT("Last run")} value={last ? String(last.period) : '…'} hint={last ? `${last.code} on ${fmtDate(last.runAt)}` : undefined} tone="brand" />
        <Stat label={referenceT("Processed in last run")} value={last ? fmtCompact(last.gross) : '…'} hint={last ? `${last.employees} records` : undefined} />
        <Stat label={referenceT("Runs on record")} value={res ? res.total : '…'} hint={referenceT("All periods")} />
        <Stat label={referenceT("Failed runs")} value={res ? failed : '…'} tone={failed ? 'danger' : 'ok'} hint={failed ? 'Open one to see what stopped it' : 'Every run completed'} />
      </div>
      <Card className="min-h-[420px] flex-1">
        <WorkList def={def} showTotals newLabel="Start new run" onLoaded={setRes} />
      </Card>
    </Frame>
  );
}
