'use client';
import {CardGrid} from '@pepbits/ops-ui';

import {DiagnosticButton} from '@pepbits/reference-diagnostics';
import { useEffect, useState } from 'react';
import {useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { RefreshCw, Search } from 'lucide-react';
import { useApi, useDebounced, useMaster } from '../../../lib/hooks';
import { cls, dueIn } from '../../../lib/format';
import { Badge, Button, Card, Empty, ErrorNote, Flag, Input, Loading, PageHeader, Select } from '../../../components/ui';
import { ResultPanel } from '../../../components/ResultPanel';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const STATUS_SETS = [
  { value: 'ACCESSIONED,IN_ANALYZER,OUTSOURCED,RESULTED,AMENDING', label: 'All open work' },
  { value: 'ACCESSIONED,IN_ANALYZER,OUTSOURCED', label: 'Awaiting results' },
  { value: 'RESULTED,AMENDING', label: 'Resulted, not validated' },
  { value: 'AMENDING', label: 'Amendments' },
];

export default function ResultsPage() {
 const referenceT = useReferenceLocalization().t;

  const sp = useSearchParams();
  const [status, setStatus] = useState(STATUS_SETS[0].value);
  const [departmentId, setDept] = useState('');
  const [analyzerId, setAnalyzer] = useState('');
  const [priority, setPriority] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<any[]>('/results/worklist', { status, departmentId, analyzerId, priority, q: dq });
  const depts = useMaster('departments');
  const analyzers = useMaster('analyzers');
  const [sel, setSel] = useState<number | null>(sp.get('ot') ? Number(sp.get('ot')) : null);

  useEffect(() => { if (!sel && data?.length) setSel(data[0].id); }, [data, sel]);

  return (
    <div>
      <PageHeader title={referenceT("Result entry")} subtitle={referenceT("Worklist of accessioned tests. Analyzer results arrive automatically; enter or correct manual results here.")}
        actions={<Button icon={RefreshCw} onClick={reload} loading={loading}><ReferenceText message="Refresh" /></Button>} />
      <ErrorNote error={error} />
      <CardGrid className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <Card bodyClass="p-0" className="flex max-h-[calc(100vh-170px)] flex-col">
          <div className="space-y-2 border-b border-line p-3">
            <div className="relative"><Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-mute" /><Input className="pl-8" placeholder={referenceT("Sample, order, MRN, name or test")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={status} onChange={(e) => setStatus(e.target.value)} options={STATUS_SETS} />
              <Select value={priority} onChange={(e) => setPriority(e.target.value)} placeholder={referenceT("Any priority")} options={[{ value: 'STAT', label: 'STAT only' }, { value: 'ROUTINE', label: 'Routine' }]} />
              <Select value={departmentId} onChange={(e) => setDept(e.target.value)} placeholder={referenceT("All departments")} options={depts.map((d) => ({ value: d.id, label: d.name }))} />
              <Select value={analyzerId} onChange={(e) => setAnalyzer(e.target.value)} placeholder={referenceT("All analyzers")} options={analyzers.map((a) => ({ value: a.id, label: a.name }))} />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && !data ? <Loading /> : !data?.length ? <Empty title={referenceT("Worklist is clear")} hint={referenceT("Accessioned tests appear here.")} /> : data.map((r) => {
              const due = dueIn(r.dueAt);
              return (
                <DiagnosticButton key={r.id} onClick={() => setSel(r.id)} className={cls('block w-full border-b border-line px-3 py-2.5 text-left', sel === r.id ? 'bg-lab-50 shadow-[inset_3px_0_0_#0E7C7B]' : 'hover:bg-paper')}>
                  <div className="flex items-center gap-1.5">
                    <span className="flex-1 truncate text-sm font-medium">{r.test?.name}</span>
                    {r.order?.priority === 'STAT' && <Badge value="STAT" />}
                    <Badge value={r.status} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
                    <span className="truncate">{r.patient?.fullName}</span>
                    <span className="font-mono text-xs2 text-ink-mute">{r.sample?.sampleNo}</span>
                    <span className={cls('ml-auto whitespace-nowrap text-xs2', due.overdue ? 'font-medium text-flag-crit' : 'text-ink-mute')}>{due.text}</span>
                  </div>
                  {r.resultCount > 0 && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs2 text-ink-mute">
                      {r.resultCount}<ReferenceText message="result(s)" />{r.criticalCount > 0 && <Flag flag="HH" />}
                      {r.abnormalCount > 0 && <span className="text-flag-high">{r.abnormalCount} <ReferenceText message="abnormal" /></span>}
                    </div>
                  )}
                </DiagnosticButton>
              );
            })}
          </div>
        </Card>
        <Card bodyClass="p-0">
          {sel ? <ResultPanel orderTestId={sel} onChanged={reload} /> : <Empty title={referenceT("Select a test from the worklist")} />}
        </Card>
      </CardGrid>
    </div>
  );
}
