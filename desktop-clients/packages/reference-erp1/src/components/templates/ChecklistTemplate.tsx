'use client';
import { cx, useFormat, useMediaQuery, useEntityApi, Button, Drawer, Empty, Input, Progress, StatusBadge, useToast, WorkList, Card, Frame, type PageDef, type Row } from '@pepbits/reference-keystone-core';
import { Table, TableContainer } from '@pepbits/ops-ui';
import { useEffect, useState } from 'react';
import { CircleCheck, CircleX, ClipboardCheck, PauseCircle, Save } from 'lucide-react';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


type Check = { parameter: string; spec: string; observed: string; result: string; remarks: string };
const RESULT_STYLE: Record<string, string> = { Pass: 'bg-ok text-white border-ok', Fail: 'bg-danger text-white border-danger', NA: 'bg-ink-3 text-white border-ink-3' };

function Sheet({ def, row, onSaved }: { def: PageDef; row: Row | null; onSaved: (r: Row) => void }) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const { fmtDate, fmtValue } = useFormat();
  const toast = useToast();
  const [checks, setChecks] = useState<Check[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { setChecks(((row?.checks as Check[]) ?? []).map((c) => ({ ...c }))); setDirty(false); }, [row]);
  if (!row) return <Empty icon={ClipboardCheck} title={referenceT("Pick an inspection")} body="Select an inspection on the left to record results." className="h-full" />;

  const set = (i: number, patch: Partial<Check>) => { setChecks((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c))); setDirty(true); };
  const done = checks.filter((c) => c.result).length;
  const fails = checks.filter((c) => c.result === 'Fail').length;
  const passes = checks.filter((c) => c.result === 'Pass').length;
  const complete = done === checks.length;
  const locked = row.status === 'Passed' || row.status === 'Failed';
  const verdict = !complete ? referenceT(checks.length - done === 1 ? "{count} parameter still to check" : "{count} parameters still to check", { count: checks.length - done }) : fails ? referenceT(fails === 1 ? "{count} parameter out of spec. Reject or hold for rework." : "{count} parameters out of spec. Reject or hold for rework.", { count: fails }) : referenceT("Every parameter is within spec. Ready to accept.");

  const persist = async (status?: string) => {
    setBusy(status ?? 'save');
    try {
      const saved = await entityApi.update(def.entity, row.id, { checks, ...(status ? { status } : {}) });
      toast(status ? referenceT('{record} marked {status}', {record: row.code, status: referenceT(status)}) : referenceT('Results saved'));
      setDirty(false);
      onSaved(saved);
    } catch (e) { toast((e as Error).message, 'danger'); } finally { setBusy(null); }
  };
  const meta = def.fields.filter((f) => !['code', 'status'].includes(f.key));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[length:calc(16px*var(--fs-scale))] font-semibold tracking-tight">{row.code}</h2>
          <StatusBadge value={row.status} />
          {dirty && <span className="text-[length:calc(12px*var(--fs-scale))] text-warn"><ReferenceText message="Unsaved results" /></span>}
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 xl:grid-cols-5">
          {meta.map((f) => (
            <div key={f.key} className="min-w-0">
              <dt className="text-[length:calc(11.5px*var(--fs-scale))] text-ink-3"><ReferenceText message={f.label} /></dt>
              <dd className="truncate text-[length:calc(13px*var(--fs-scale))]">{f.type === 'date' ? fmtDate(row[f.key]) : fmtValue(f, row[f.key])}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={(done / Math.max(1, checks.length)) * 100} tone={fails ? 'danger' : complete ? 'ok' : 'brand'} className="flex-1" />
          <span className="whitespace-nowrap text-[length:calc(12px*var(--fs-scale))] text-ink-2 tnum">{done}/{checks.length} <ReferenceText message="checked," /> {passes} <ReferenceText message="pass," /> {fails} <ReferenceText message="fail" /></span>
        </div>
      </div>
      <TableContainer className="min-h-0 flex-1 overflow-auto">
        <Table className="w-full min-w-[640px] border-separate border-spacing-0 text-[length:calc(13px*var(--fs-scale))]">
          <thead className="sticky top-0 z-10">
            <tr className="text-left text-[length:calc(12px*var(--fs-scale))] text-ink-2">
              <th className="w-8 border-b border-line bg-surface-2 px-3 py-1.5 font-medium">#</th>
              <th className="border-b border-line bg-surface-2 px-2 py-1.5 font-medium"><ReferenceText message="Parameter" /></th>
              <th className="w-40 border-b border-line bg-surface-2 px-2 py-1.5 font-medium"><ReferenceText message="Observed" /></th>
              <th className="w-44 border-b border-line bg-surface-2 px-2 py-1.5 font-medium"><ReferenceText message="Result" /></th>
              <th className="w-48 border-b border-line bg-surface-2 px-2 py-1.5 font-medium"><ReferenceText message="Remarks" /></th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c, i) => (
              <tr key={c.parameter} className={cx(c.result === 'Fail' && 'bg-danger-soft/40')}>
                <td className="border-b border-line px-3 py-2 text-ink-3 tnum">{i + 1}</td>
                <td className="border-b border-line px-2 py-2">
                  <div className="font-medium">{c.parameter}</div>
                  <div className="text-[length:calc(12px*var(--fs-scale))] text-ink-3">{c.spec}</div>
                </td>
                <td className="border-b border-line px-2 py-2"><Input value={c.observed} readOnly={locked} onChange={(e) => set(i, { observed: e.target.value })} className="h-7 text-[length:calc(12.5px*var(--fs-scale))]" placeholder={referenceT("Reading")} /></td>
                <td className="border-b border-line px-2 py-2">
                  <div className="inline-flex overflow-hidden rounded-md border border-line">
                    {['Pass', 'Fail', 'NA'].map((r) => (
                      <button key={r} disabled={locked} onClick={() => set(i, { result: c.result === r ? '' : r, observed: c.observed || (r === 'Pass' ? 'Within spec' : r === 'Fail' ? 'Out of spec' : '') })} className={cx('h-7 w-12 border-l border-line text-[length:calc(12px*var(--fs-scale))] font-medium first:border-l-0 disabled:cursor-not-allowed', c.result === r ? RESULT_STYLE[r] : 'bg-surface text-ink-2 hover:bg-surface-3')}>
                        {r === 'NA' ? referenceT("N/A") : r}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="border-b border-line px-2 py-2"><Input value={c.remarks} readOnly={locked} onChange={(e) => set(i, { remarks: e.target.value })} className="h-7 text-[length:calc(12.5px*var(--fs-scale))]" placeholder={referenceT("Optional")} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableContainer>
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2 px-4 py-2.5">
        <p className={cx('flex-1 text-[length:calc(12.5px*var(--fs-scale))]', !complete ? 'text-ink-3' : fails ? 'text-danger' : 'text-ok')}>{locked ? `Closed as ${String(row.status).toLowerCase()}.` : verdict}</p>
        {!locked && (
          <>
            <Button icon={Save} disabled={!dirty} loading={busy === 'save'} onClick={() => persist()}><ReferenceText message="Save" /></Button>
            <Button icon={PauseCircle} loading={busy === 'On hold'} onClick={() => persist('On hold')}><ReferenceText message="Hold" /></Button>
            <Button variant="danger" icon={CircleX} disabled={!complete || !fails} loading={busy === 'Failed'} onClick={() => persist('Failed')}><ReferenceText message="Reject" /></Button>
            <Button variant="primary" icon={CircleCheck} disabled={!complete || fails > 0} loading={busy === 'Passed'} onClick={() => persist('Passed')}><ReferenceText message="Accept" /></Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Inspection sheets: pick a lot, mark each parameter, then accept, hold or reject. */
export default function ChecklistTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const isWide = useMediaQuery('(min-width: 1024px)');
  const [sel, setSel] = useState<Row | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const sheet = <Sheet def={def} row={sel} onSaved={(r) => { setSel(r); setReloadKey((k) => k + 1); }} />;
  return (
    <Frame className={cx(isWide && 'flex-row')}>
      <Card className={cx('flex flex-col', isWide ? 'w-[340px] shrink-0 xl:w-[380px]' : 'flex-1')}>
        <WorkList def={def} compact selectedId={sel?.id} reloadKey={reloadKey} onOpen={setSel} onLoaded={(res) => { if (isWide && !sel && res.rows[0]) setSel(res.rows[0]); }} />
      </Card>
      {isWide ? <Card className="min-w-0 flex-1">{sheet}</Card> : (
        <Drawer open={Boolean(sel)} onClose={() => setSel(null)} title={referenceT("Inspection sheet")} width="xl">
          <div className="-mx-5 -my-4 h-[calc(100dvh-58px)]">{sheet}</div>
        </Drawer>
      )}
    </Frame>
  );
}
