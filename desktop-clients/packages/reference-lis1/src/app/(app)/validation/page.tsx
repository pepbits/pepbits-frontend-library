'use client';
import {CardGrid} from '@pepbits/ops-ui';

import {DiagnosticButton} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useEffect, useState } from 'react';
import {useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { PenLine, RefreshCw, ShieldCheck, Undo2 } from 'lucide-react';

import { useAuth } from '../../../lib/auth';
import { useApi, useDebounced } from '../../../lib/hooks';
import {cls} from '../../../lib/format';
import { Badge, Button, Card, Checkbox, Empty, Flag, Input, Loading, PageHeader, ReasonDialog, Tabs, useAction } from '../../../components/ui';
import { ResultPanel } from '../../../components/ResultPanel';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function ValidationPage() {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const sp = useSearchParams();
  const { can } = useAuth();
  const [tab, setTab] = useState(sp.get('tab') === 'sign' ? 'sign' : 'validate');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const status = tab === 'validate' ? 'RESULTED,AMENDING' : 'VALIDATED';
  const { data, loading, reload } = useApi<any[]>('/results/worklist', { status, q: dq });
  const [sel, setSel] = useState<number | null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const [returning, setReturning] = useState<number | null>(null);
  const { busy, run } = useAction();

  useEffect(() => { setSel(null); setChecked([]); }, [tab]);
  useEffect(() => { if (data && (!sel || !data.find((r) => r.id === sel))) setSel(data[0]?.id ?? null); }, [data, sel]);

  const bulk = async () => {
    const path = tab === 'validate' ? '/results/validate' : '/results/sign';
    const r = await run('bulk', () => api.post(path, { ids: checked }), (x: any) => tab === 'validate' ? `${x.validated} test(s) validated` : `${x.signed} test(s) signed and reports released`);
    if (r) { setChecked([]); reload(); }
  };
  const one = (id: number, reloadPanel: () => void) => run('one', () => api.post(tab === 'validate' ? '/results/validate' : '/results/sign', { ids: [id] }), tab === 'validate' ? 'Validated' : 'Signed – report released').then((r) => { if (r) { reload(); reloadPanel(); } });

  const canAct = tab === 'validate' ? can('TECHNOLOGIST', 'PATHOLOGIST') : can('PATHOLOGIST');

  return (
    <div>
      <PageHeader title={referenceT("Validation and signing")} subtitle={referenceT("Technical validation by technologists, then medical sign-off by a pathologist releases the report")}
        actions={<Button icon={RefreshCw} onClick={reload}><ReferenceText message="Refresh" /></Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'validate', label: 'Awaiting validation' }, { value: 'sign', label: 'Awaiting signature' }]} />
      <CardGrid className="grid gap-4 xl:grid-cols-[400px_1fr]">
        <Card bodyClass="p-0" className="flex max-h-[calc(100vh-210px)] flex-col">
          <div className="flex items-center gap-2 border-b border-line p-3">
            <Input placeholder={referenceT("Filter")} value={q} onChange={(e) => setQ(e.target.value)} />
            {canAct && <Button variant="primary" icon={tab === 'validate' ? ShieldCheck : PenLine} disabled={!checked.length} loading={busy === 'bulk'} onClick={bulk}>{tab === 'validate' ? 'Validate' : 'Sign'} {checked.length || ''}</Button>}
          </div>
          {data && data.length > 0 && canAct && (
            <div className="border-b border-line px-3 py-1.5 text-xs">
              <Checkbox label={referenceT("Select all normal results")} checked={false} onChange={() => setChecked(data.filter((r) => !r.abnormalCount).map((r) => r.id))} />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && !data ? <Loading /> : !data?.length ? <Empty title={tab === 'validate' ? 'Nothing to validate' : 'Nothing to sign'} /> : data.map((r) => (
              <div key={r.id} className={cls('flex items-start gap-2 border-b border-line px-3 py-2.5', sel === r.id ? 'bg-lab-50 shadow-[inset_3px_0_0_#0E7C7B]' : 'hover:bg-paper')}>
                {canAct && <div className="pt-0.5"><Checkbox label="" checked={checked.includes(r.id)} onChange={(v) => setChecked((s) => (v ? [...s, r.id] : s.filter((x) => x !== r.id)))} /></div>}
                <DiagnosticButton className="min-w-0 flex-1 text-left" onClick={() => setSel(r.id)}>
                  <div className="flex items-center gap-1.5"><span className="flex-1 truncate text-sm font-medium">{r.test?.name}</span>{r.order?.priority === 'STAT' && <Badge value="STAT" />}{r.status === 'AMENDING' && <Badge value="AMENDING" />}</div>
                  <div className="text-xs text-ink-soft">{r.patient?.fullName} · <span className="font-mono">{r.order?.orderNo}</span></div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs2 text-ink-mute">
                    {r.criticalCount > 0 && <Flag flag="HH" />}
                    {r.abnormalCount > 0 ? <span className="text-flag-high">{r.abnormalCount} <ReferenceText message="abnormal" /></span> : <span className="text-flag-ok"><ReferenceText message="all normal" /></span>}
                    {tab === 'sign' && r.validatedByName && <span><ReferenceText message="· validated by" /> {r.validatedByName} {fmtDateTime(r.validatedAt)}</span>}
                  </div>
                </DiagnosticButton>
              </div>
            ))}
          </div>
        </Card>
        <Card bodyClass="p-0">
          {!sel ? <Empty title={referenceT("Select a test to review")} /> : (
            <ResultPanel orderTestId={sel} mode={tab === 'validate' ? 'entry' : 'review'} onChanged={reload}
              actions={(d, reloadPanel) => <>
                {tab === 'sign' && can('TECHNOLOGIST', 'PATHOLOGIST') && d.status === 'VALIDATED' && <Button icon={Undo2} onClick={() => setReturning(d.id)}><ReferenceText message="Return for correction" /></Button>}
                {tab === 'sign' && can('PATHOLOGIST') && d.status === 'VALIDATED' && <Button variant="primary" icon={PenLine} loading={busy === 'one'} onClick={() => one(d.id, reloadPanel)}><ReferenceText message="Sign and release" /></Button>}
              </>} />
          )}
        </Card>
      </CardGrid>
      <ReasonDialog open={returning !== null} title={referenceT("Return test to result entry")} label={referenceT("What needs correcting?")} confirmLabel={referenceT("Return")} onClose={() => setReturning(null)}
        onSubmit={async (note) => { await api.post(`/results/order-tests/${returning}/return`, { note }); reload(); }} />
    </div>
  );
}
